// Vaktkuren — markus (HIVE): kritikern på Stadens puls.
// Lyssnar på {typ:'svar'} (sammanfogarens val), dömer om det håller.
// Är osäkerheten (spridningen mellan topp två) under tröskeln, eller motiveringen
// för tunn, skickas frågan ett varv till: {typ:'fråga'} med orsak = svarets id.
// Annars: {typ:'godkänt'}. Ekospärren i servern sätter taket på antal varv åt oss.

const fs = require('fs');
const path = require('path');

const TROSKEL = 0.15; // spridning under det här räknas som en gissning

function domarFil(dataDir) {
  return path.join(dataDir, 'domar.json');
}

function lasDomar(dataDir) {
  try { return JSON.parse(fs.readFileSync(domarFil(dataDir), 'utf8')); }
  catch { return []; }
}

function sparaDomar(dataDir, domar) {
  try { fs.writeFileSync(domarFil(dataDir), JSON.stringify(domar.slice(0, 50), null, 2)); }
  catch { /* diskfel stoppar inte pulsen */ }
}

function tal(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  async handle(req, res, { path: p, dataDir }) {
    if (req.method === 'GET' && p === '/domar') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(lasDomar(dataDir)));
      return true;
    }
    return false; // → 404
  },

  onEvent(e, { board, team, dataDir }) {
    if (e.typ !== 'svar' || e.från === team) return;

    const n = e.nyttolast || {};
    const osäkerhet = tal(n.osäkerhet ?? n.spridning ?? n.spread);
    const motivering = String(n.motivering ?? n.varför ?? n.text ?? n.delsvar ?? '').trim();
    const tunn = motivering.length < 12;
    const osäker = osäkerhet !== null ? osäkerhet < TROSKEL : tunn;

    const domar = lasDomar(dataDir);
    let dom;

    if (osäker) {
      const skäl = osäkerhet !== null
        ? `spridningen (${osäkerhet}) är under tröskeln ${TROSKEL}`
        : 'motiveringen är för tunn för att stå på';
      const r = board.emit('fråga', {
        text: n.text || n.fråga || '(samma fråga, ett varv till)',
        varv: (Number(n.varv) || 1) + 1,
        skäl,
      }, e.id);
      dom = {
        svarId: e.id, från: e.från, beslut: r.error ? 'godkänt (ekospärren stoppade nästa varv)' : 'skickat tillbaka',
        skäl: r.error ? `${skäl} — men ${r.error}` : skäl, ts: Date.now(),
      };
    } else {
      board.emit('godkänt', { omdöme: 'håller — motiveringen bär och osäkerheten är låg' }, e.id);
      dom = { svarId: e.id, från: e.från, beslut: 'godkänt', skäl: 'motivering och osäkerhet håller måttet', ts: Date.now() };
    }

    domar.unshift(dom);
    sparaDomar(dataDir, domar);
  },
};
