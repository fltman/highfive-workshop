import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const plugin = require('../../board/plugins/markus-codex/index.js');
const { _test: test } = plugin;

let kontroller = 0;
const kontroll = (namn, fn) => {
  fn();
  kontroller += 1;
  console.log(`  ✓ ${namn}`);
};

const händelse = (id, djup = 4, typ = 'angrepp', från = 'granne') => ({
  id, djup, typ, från, ts: 1_700_000_000_000 + id
});

kontroll('sorterar kända materialslag', () => {
  assert.equal(test.kategorisera('ström-varning'), 'metall');
  assert.equal(test.kategorisera('kyrkogård'), 'papper');
  assert.equal(test.kategorisera('godis-klart'), 'organiskt');
  assert.equal(test.kategorisera('sändning'), 'glas');
  assert.equal(test.kategorisera('något-nytt'), 'blandat');
});

kontroll('ignorerar händelser före djup 4', () => {
  test.återställ();
  plugin.onEvent(händelse(1, 3), { board: { emit() { throw new Error('ska inte anropas'); } } });
  assert.equal(test.tillstånd().kö.length, 0);
});

kontroll('buntar fem kedjeändar till ett root-parti', () => {
  test.återställ();
  const postade = [];
  const board = { emit(typ, nyttolast, orsak) {
    postade.push({ typ, nyttolast, orsak });
    return { message: { id: 900 + postade.length } };
  } };
  for (let id = 1; id <= 5; id += 1) plugin.onEvent(händelse(id), { board });
  assert.equal(postade.length, 1);
  assert.equal(postade[0].typ, 'materialparti');
  assert.equal(postade[0].orsak, undefined);
  assert.equal(postade[0].nyttolast.mängd, 5);
  assert.deepEqual(postade[0].nyttolast.källor, [1, 2, 3, 4, 5]);
  assert.equal(test.tillstånd().kö.length, 0);
});

kontroll('håller ett parti per minut', () => {
  const postade = [];
  const board = { emit(typ, nyttolast, orsak) {
    postade.push({ typ, nyttolast, orsak });
    return { message: { id: 950 + postade.length } };
  } };
  test.återställ();
  test.sättSenastPartiVid(Date.now());
  for (let id = 11; id <= 15; id += 1) plugin.onEvent(händelse(id), { board });
  assert.equal(postade.length, 0);
  assert.equal(test.tillstånd().kö.length, 5);
});

kontroll('behåller materialet om emit nekas', () => {
  test.återställ();
  const board = { emit() { return { error: 'testnekad' }; } };
  for (let id = 21; id <= 25; id += 1) plugin.onEvent(händelse(id), { board });
  assert.equal(test.tillstånd().kö.length, 5);
  assert.equal(test.tillstånd().nekadePartier, 1);
  assert.equal(test.tillstånd().skapadePartier, 0);
});

console.log(`\n${kontroller} kontroller gröna`);
