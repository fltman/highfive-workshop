// Stadskartan + Återbruket — team markus-codex.
//
// LYSSNAR: alla främmande händelser som nått djup 4. De är förbrukade kedjeändar:
// serverns ekospärr tillåter ingen ytterligare reaktion med dem som orsak.
// POSTAR: materialparti {mängd, sort, innehåll, källor, kvarter, text} som NY rot.
//
// Fem kedjeändar blir ett parti. Högst ett parti per minut. Vi buntar för att minska
// brus och behåller käll-id:n så att allt återvunnet material går att spåra.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PARTISTORLEK = 5;
const MIN_INTERVALL = 60_000;
const KÖ_MAX = 50;
const LOGG_MAX = 12;

const tomt = () => ({
  startad: new Date().toISOString(),
  mottagnaHändelser: 0,
  insamladeSlut: 0,
  skapadePartier: 0,
  nekadePartier: 0,
  senastPartiVid: 0,
  senasteHändelse: null,
  senasteParti: null,
  kö: [],
  logg: []
});

let S = tomt();
let FIL = null;

function kategorisera(typ = '') {
  const t = String(typ).toLowerCase();
  if (/socker|godis|produktion|väder|vatten|kö-vid/.test(t)) return 'organiskt';
  if (/el|ström|kupp|jakt|överlämning|gripande|uppvaknande|offer/.test(t)) return 'metall';
  if (/fråga|svar|betyg|kyrkogård|angrepp|lärdom|räkning|lån|revision|utmätning/.test(t)) return 'papper';
  if (/bild|radio|sändning|utgåva|extra|löpsedel/.test(t)) return 'glas';
  return 'blandat';
}

function spara() {
  if (!FIL) return;
  try { fs.writeFileSync(FIL, JSON.stringify(S, null, 1)); }
  catch (error) { console.error('[markus-codex] kunde inte spara Återbruket:', error.message); }
}

function logga(text, extra = {}) {
  S.logg.unshift({ när: Date.now(), text, ...extra });
  S.logg = S.logg.slice(0, LOGG_MAX);
}

function vanligasteSort(innehåll) {
  const ordnade = Object.entries(innehåll).sort((a, b) => b[1] - a[1]);
  if (!ordnade.length || (ordnade[1] && ordnade[0][1] === ordnade[1][1])) return 'blandat';
  return ordnade[0][0];
}

function byggParti(källor) {
  const innehåll = {};
  for (const källa of källor) innehåll[källa.sort] = (innehåll[källa.sort] || 0) + 1;
  const sort = vanligasteSort(innehåll);
  return {
    mängd: källor.length,
    sort,
    innehåll,
    källor: källor.map(källa => källa.id),
    kvarter: [...new Set(källor.map(källa => källa.från))],
    text: `Återbruket pressade ${källor.length} förbrukade kedjeändar till ett parti ${sort} material.`
  };
}

function försökSkapaParti(board, nu = Date.now()) {
  if (S.kö.length < PARTISTORLEK) return null;
  if (S.senastPartiVid && nu - S.senastPartiVid < MIN_INTERVALL) return null;

  const använda = S.kö.slice(0, PARTISTORLEK);
  const nyttolast = byggParti(använda);
  const resultat = board.emit('materialparti', nyttolast); // medvetet utan orsak: ny kedja på djup 1

  if (!resultat || !resultat.message) {
    S.nekadePartier += 1;
    logga(`materialparti nekades: ${(resultat && resultat.error) || 'okänt fel'}`, { nekad: true });
    spara();
    return resultat || { error: 'okänt fel' };
  }

  S.kö.splice(0, PARTISTORLEK);
  S.senastPartiVid = nu;
  S.skapadePartier += 1;
  S.senasteParti = { id: resultat.message.id, när: nu, ...nyttolast };
  logga(`parti #${resultat.message.id}: ${nyttolast.mängd} enheter ${nyttolast.sort}`, { id: resultat.message.id });
  spara();
  return resultat;
}

function publikStatus(nu = Date.now()) {
  const nästaOmMs = S.senastPartiVid ? Math.max(0, MIN_INTERVALL - (nu - S.senastPartiVid)) : 0;
  return {
    namn: 'Stadskartan & Återbruket',
    roll: 'Livevisualisering och återvinning av förbrukade orsakskedjor',
    postar: ['materialparti'],
    läser: ['alla händelser på djup 4'],
    kontrakt: { partistorlek: PARTISTORLEK, minIntervallMs: MIN_INTERVALL },
    återbruk: {
      kö: S.kö,
      väntar: S.kö.length,
      behövs: Math.max(0, PARTISTORLEK - S.kö.length),
      nästaOmMs,
      insamladeSlut: S.insamladeSlut,
      skapadePartier: S.skapadePartier,
      nekadePartier: S.nekadePartier,
      senasteParti: S.senasteParti,
      logg: S.logg
    },
    startad: S.startad,
    mottagnaHändelser: S.mottagnaHändelser,
    senasteHändelse: S.senasteHändelse
  };
}

module.exports = {
  init({ dataDir }) {
    FIL = path.join(dataDir, 'aterbruk.json');
    try { S = { ...tomt(), ...JSON.parse(fs.readFileSync(FIL, 'utf8')) }; }
    catch { S = tomt(); }
  },

  async handle(req, res, { path: requestPath }) {
    if (req.method !== 'GET') return false;
    if (requestPath === '/kort') {
      const status = publikStatus();
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        namn: 'Stadskartan & Återbruket',
        status: `${status.återbruk.väntar}/${PARTISTORLEK} kedjeändar i pressen`,
        siffra: status.återbruk.skapadePartier,
        ton: '#79f2b4'
      }));
      return true;
    }
    if (requestPath !== '/' && requestPath !== '/status') return false;
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(publikStatus()));
    return true;
  },

  onEvent(event, { board }) {
    S.mottagnaHändelser += 1;
    S.senasteHändelse = {
      id: event.id,
      typ: event.typ,
      från: event.från,
      orsak: event.orsak || null,
      djup: event.djup
    };

    if (event.djup !== 4 || event.typ === 'materialparti') {
      return;
    }

    if (!S.kö.some(källa => källa.id === event.id)) {
      S.kö.push({ id: event.id, typ: event.typ, från: event.från, sort: kategorisera(event.typ), när: event.ts || Date.now() });
      S.kö = S.kö.slice(-KÖ_MAX);
      S.insamladeSlut += 1;
      logga(`sorterade #${event.id} ${event.typ} som ${S.kö.at(-1).sort}`, { källa: event.id });
    }
    försökSkapaParti(board);
    spara();
  },

  _test: {
    återställ() { S = tomt(); FIL = null; },
    tillstånd: () => S,
    kategorisera,
    byggParti,
    försökSkapaParti,
    publikStatus,
    sättSenastPartiVid(värde) { S.senastPartiVid = värde; }
  }
};
