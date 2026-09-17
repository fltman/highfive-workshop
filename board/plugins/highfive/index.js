// Arkivet (team highfive): ett attention-huvud med vinkeln MINNE.
//   {typ:'fråga'}                 → söker i det staden redan sagt och postar {typ:'delsvar', nyttolast:{text, motivering, källor}}
//   {typ:'svar'|'kyrkogård'|'godkänt'} → arkiveras i frågans pärm, så nästa liknande fråga får med vad staden tyckte
//   GET /t/highfive/arkiv          → pärmarna, nyast först
// Inget hittepå: varje delsvar bär id:n på inläggen det bygger på. Hittas inget säger vi det.

const fs = require('fs');
const path = require('path');

const STOPP = new Set(('och att det som för med den till har inte är på vad hur kan ska vill man jag vi ni du de dem denna detta dessa eller men om från när där här någon något några alla mycket mer bara också efter över under utan mellan sedan redan borde skulle kommer finns blir blev vara varit göra gör gjorde hela varför vilken vilket vilka tycker tror staden stad stadens '
  + 'the and for with what how why does this that from have').split(' '));
const MAX_PÄRMAR = 200;

let arkiv = { pärmar: [] };     // [{id, ts, text, från, varv, ursprung, delsvar, svar, stenar, dom}]
const händelser = new Map();    // puls-id -> {typ, orsak, från}
let fil = null, sparaTimer = null;

function spara() {
  clearTimeout(sparaTimer);
  sparaTimer = setTimeout(() => fs.writeFile(fil, JSON.stringify(arkiv), () => {}), 500);
}

function textAv(n) {
  if (n == null) return '';
  if (typeof n === 'string') return n;
  for (const k of ['text', 'svar', 'omdöme', 'varför', 'delsvar', 'valt']) {
    const v = n[k];
    if (typeof v === 'string') return v;
    if (v && typeof v.text === 'string') return v.text;
  }
  return JSON.stringify(n);
}

const kort = (s, n) => (s = String(s).replace(/\s+/g, ' ').trim()).length > n ? s.slice(0, n - 1) + '…' : s;

function nyckelord(text) {
  const ord = String(text).toLowerCase().match(/\p{L}[\p{L}\p{N}-]*/gu) || [];
  return [...new Set(ord.filter(o => o.length >= 4 && !STOPP.has(o)))];
}

// Gå uppåt i orsakskedjan tills vi hittar frågan händelsen hör till.
function frågaFör(id) {
  for (let i = 0; i < 6 && id != null; i++) {
    const e = händelser.get(id);
    if (!e) return null;
    if (e.typ === 'fråga') return id;
    id = e.orsak;
  }
  return null;
}

// Grov svensk ordstam: elpriset → elpris, kvarteren → kvarter.
const stam = (o) => o.length > 6 ? o.replace(/(erna|arna|orna|en|et|er|ar|or|na)$/, '') : o;

const pärm = (id) => arkiv.pärmar.find(p => p.id === id);

function sök(board, fråga, ord) {
  if (!ord.length) return [];
  const träffar = [];
  for (const m of board.query({ limit: 500 })) {
    if (m.id >= fråga.id || m.from === 'highfive') continue;
    let text = m.text;
    if (m.channel === 'staden-puls') { try { const e = JSON.parse(m.text); if (e.typ === 'delsvar' || e.typ === 'fråga') continue; text = e.typ + ' ' + textAv(e.nyttolast); } catch { continue; } }
    const låg = text.toLowerCase();
    const hit = ord.filter(o => låg.includes(stam(o)));
    if (hit.length) träffar.push({ id: m.id, från: m.from, kanal: m.channel, text, hit, poäng: hit.length });
  }
  // Kräv två matchande ord när frågan har minst två, annars blir ett vanligt ord en källa. Ett ord räcker om inget annat finns.
  const starka = träffar.filter(t => t.poäng >= Math.min(2, ord.length));
  return (starka.length ? starka : träffar).sort((a, b) => b.poäng - a.poäng || b.id - a.id).slice(0, 3);
}

function tidigare(fråga, ord) {
  let bäst = null, bästPoäng = 0;
  for (const p of arkiv.pärmar) {
    if (p.id === fråga.id || !p.svar) continue;
    const gemensamt = nyckelord(p.text).filter(o => ord.includes(o)).length;
    if (gemensamt > bästPoäng) { bäst = p; bästPoäng = gemensamt; }
  }
  return bästPoäng >= 2 || (bäst && ord.length <= 2 && bästPoäng >= 1) ? bäst : null;
}

function besvara(fråga, board) {
  const ord = nyckelord(fråga.text);
  const träffar = sök(board, fråga, ord);
  const förra = tidigare(fråga, ord);
  const källor = träffar.map(t => t.id);
  const delar = [];
  if (förra) {
    källor.unshift(förra.id);
    delar.push(`Staden har fått en liknande fråga förut ([${förra.id}] "${kort(förra.text, 80)}") och svarade då: "${kort(förra.svar.text, 160)}"${förra.dom ? ` (${förra.dom})` : ''}.`);
  }
  for (const t of träffar) delar.push(`[${t.id}] ${t.från} i #${t.kanal}: "${kort(t.text, 140)}"`);

  let text, motivering;
  if (!delar.length) {
    text = 'Arkivet har inget om det här. Staden har inte pratat om det förut, så allt ni hör om det nu är nytt, inte minne.';
    motivering = ord.length ? `Sökte efter ${ord.slice(0, 6).join(', ')} i ${board.query({ limit: 500 }).length} inlägg utan träff. Vi gissar hellre inte.` : 'Frågan saknade sökbara ord.';
  } else {
    text = 'Det här har staden redan sagt: ' + delar.join(' ');
    motivering = `Ur arkivet, inte påhittat: ${källor.length} ${källor.length === 1 ? 'källa' : 'källor'} som matchar ${[...new Set(träffar.flatMap(t => t.hit))].slice(0, 5).join(', ') || 'en tidigare fråga'}. Kolla id:na.`;
  }
  const r = board.emit('delsvar', { text: kort(text, 1100), motivering: kort(motivering, 300), källor }, fråga.id);
  const p = pärm(fråga.id);
  if (r.error) { p.fel = r.error; }
  else {
    p.delsvar = { id: r.message.id, text, källor };
    händelser.set(r.message.id, { typ: 'delsvar', orsak: fråga.id, från: 'highfive' });
  }
  spara();
}

module.exports = {
  init({ board, dataDir }) {
    fil = path.join(dataDir, 'arkiv.json');
    try { arkiv = JSON.parse(fs.readFileSync(fil, 'utf8')); } catch {}
    for (const e of board.pulse(500)) händelser.set(e.id, { typ: e.typ, orsak: e.orsak, från: e.från });
  },

  onEvent(e, { board }) {
    händelser.set(e.id, { typ: e.typ, orsak: e.orsak, från: e.från });
    const n = e.nyttolast || {};

    if (e.typ === 'fråga') {
      const text = textAv(n);
      if (!text.trim()) return;
      arkiv.pärmar.unshift({ id: e.id, ts: e.ts, text: kort(text, 300), från: e.från, varv: n.varv || 1, ursprung: n.ursprung ?? e.orsak ?? null, delsvar: null, svar: null, stenar: [], dom: null });
      arkiv.pärmar.length = Math.min(arkiv.pärmar.length, MAX_PÄRMAR);
      spara();
      setTimeout(() => besvara({ id: e.id, text }, board), 800);
      return;
    }

    if (!['svar', 'kyrkogård', 'godkänt'].includes(e.typ)) return;
    let fid = frågaFör(e.orsak);
    if (fid == null && e.typ === 'svar') fid = frågaFör(n.fråga ?? n.orsak);
    const p = fid != null && pärm(fid);
    if (!p) return;

    if (e.typ === 'svar') {
      // Domkapitlet [91]: vinnaren står i nyttolast.valt, som id eller objekt.
      const valt = n.valt;
      const valtId = typeof valt === 'number' ? valt : valt?.id ?? valt?.delsvar ?? null;
      const kvarter = (typeof valt === 'object' && valt ? valt.från || valt.kvarter : null) || n.från || n.kvarter || null;
      p.svar = { id: e.id, från: e.från, text: kort(textAv(n), 300), osäkerhet: n.osäkerhet ?? n.spridning ?? null, kvarter };
      const vi = (valtId != null && valtId === p.delsvar?.id) || kvarter === 'highfive';
      if (vi) p.dom = 'arkivet valdes';
      else if (p.dom !== 'arkivet föll') p.dom = 'svarad';
    } else if (e.typ === 'kyrkogård') {
      const vår = e.orsak === p.delsvar?.id || n.från === 'highfive';
      p.stenar.push({ id: e.id, från: n.från || null, fitness: n.fitness ?? null, varför: kort(n['varför det föll'] || n.varför || textAv(n), 160), vår });
      if (vår) p.dom = 'arkivet föll';
    } else {
      p.godkänt = { id: e.id, från: e.från, omdöme: kort(textAv(n), 200) };
    }
    spara();
  },

  async handle(req, res, { path: p }) {
    if (req.method !== 'GET') return false;
    if (p === '/arkiv' || p === '/') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ pärmar: arkiv.pärmar.slice(0, 40), totalt: arkiv.pärmar.length }));
      return true;
    }
    return false;
  },
};
