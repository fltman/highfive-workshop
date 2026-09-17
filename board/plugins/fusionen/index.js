// FUSIONSREAKTORN — kvarteret "fusionen" (ledningens). Fri el åt alla, så länge plasmat håller.
//
// ---------- Till Ödet och till grannarna: vad reaktorn lyssnar på och postar ----------
//   LYSSNAR  strömavbrott   → brinner reaktorn täcker den avbrottet: {typ:'fri-el', orsak = avbrottet}
//            elpris-steg    → brinner reaktorn pressar den priset: {typ:'fri-el'} (högst en gång per två minuter)
//            uppvaknande, offer, kallelse (Djupet) → kulten stör plasmat: inneslutningen sjunker
//            kupp           → sabotagerisk: inneslutningen sjunker lite
//            ALLA händelser → drar bränsle. Staden lever på reaktorn, och reaktorn tar slut.
//   POSTAR   reaktor-tänd {megawatt}        när någon tänder den
//            fri-el {megawatt, pris: 0, till: 'alla'}   när den täcker ett avbrott eller pressar ett pris
//            plasmaläcka {inneslutning}     en gång, när inneslutningen går under 25 %
//            nödstopp {skäl}                när inneslutningen brister eller bränslet tar slut
//   Reaktorn postar ALDRIG strömavbrott. Den händelsen är Elverkets (@lp) och kommer bara när deras last spricker.
//   @lp: fri-el är tänkt som negativ last hos er. Hur Elverket reagerar på gratis konkurrens bestämmer ni.
//
//   ROUTES   GET  /t/fusionen/          läget som JSON
//            POST /t/fusionen/tand      tänd plasmat (kräver bränsle ≥ 20 och inneslutning ≥ 50)
//            POST /t/fusionen/bransle   mata in deuterium (+25, högst var 20:e sekund)
//            POST /t/fusionen/kyl       kyl magneterna (+20 inneslutning, högst var 20:e sekund)
//
// Inga timrar som postar: reaktorn reagerar bara på händelser och knapptryck, så den fyller aldrig pulsen av sig själv.
const fs = require('fs');
const path = require('path');

const TAK_PER_MIN = 3;            // egna händelser per minut, långt under serverns ekospärr
let s = { status: 'kall', temperatur: 0, inneslutning: 100, bränsle: 60, megawatt: 0, levererat: 0, tändningar: 0, nödstopp: 0, läckaVarnad: false, logg: [] };
let fil = null, senaste = [], sistaPrispress = 0, sistaKnapp = {};

const spara = () => { if (fil) fs.writeFile(fil, JSON.stringify(s), () => {}); };
function logga(text) { s.logg.unshift({ ts: Date.now(), text }); s.logg = s.logg.slice(0, 14); }
function fårPosta() { const nu = Date.now(); senaste = senaste.filter(t => nu - t < 60000); if (senaste.length >= TAK_PER_MIN) return false; senaste.push(nu); return true; }
function posta(board, typ, nyttolast, orsak) { if (!fårPosta()) return null; const r = board.emit(typ, nyttolast, orsak); if (r && r.error) logga(`Pulsen sa nej till ${typ}: ${r.error}`); return r; }

function stoppa(board, skäl, orsak) {
  if (s.status !== 'brinner' && s.status !== 'instabil') return;
  s.status = 'släckt'; s.megawatt = 0; s.temperatur = Math.round(s.temperatur * 0.1); s.nödstopp++;
  logga(`NÖDSTOPP: ${skäl}. Plasmat slocknade. Elen är inte längre gratis.`);
  posta(board, 'nödstopp', { skäl, levererat_mwh: Math.round(s.levererat) }, orsak);
}
function kontrollera(board, orsak) {
  if (s.status !== 'brinner' && s.status !== 'instabil') return;
  if (s.bränsle <= 0) return stoppa(board, 'deuteriet tog slut', orsak);
  if (s.inneslutning <= 0) return stoppa(board, 'magnetfältet brast', orsak);
  if (s.inneslutning < 25) { s.status = 'instabil'; if (!s.läckaVarnad) { s.läckaVarnad = true; logga('Plasmaläcka. Någon borde kyla magneterna.'); posta(board, 'plasmaläcka', { inneslutning: s.inneslutning, råd: 'POST /t/fusionen/kyl' }, orsak); } }
  else { s.status = 'brinner'; s.läckaVarnad = false; }
  s.megawatt = Math.round(500 * (s.inneslutning / 100) * Math.min(1, s.bränsle / 30));
}

function svara(res, kod, data) { res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); return true; }
function knapp(namn, ms) { const nu = Date.now(); if (nu - (sistaKnapp[namn] || 0) < ms) return false; sistaKnapp[namn] = nu; return true; }

module.exports = {
  init({ dataDir }) { fil = path.join(dataDir, 'reaktor.json'); try { s = { ...s, ...JSON.parse(fs.readFileSync(fil, 'utf8')) }; } catch {} },

  async handle(req, res, { path: p, board }) {
    if (req.method === 'GET' && (p === '/' || p === '/lage' || p === '/state')) return svara(res, 200, s);
    if (req.method !== 'POST') return false;
    if (p === '/tand') {
      if (s.status === 'brinner' || s.status === 'instabil') return svara(res, 409, { fel: 'plasmat brinner redan', ...s });
      if (s.bränsle < 20) return svara(res, 409, { fel: 'för lite deuterium, mata in bränsle först', ...s });
      if (s.inneslutning < 50) return svara(res, 409, { fel: 'magneterna är för varma, kyl först', ...s });
      if (!knapp('tand', 30000)) return svara(res, 429, { fel: 'tändsystemet laddar om', ...s });
      s.status = 'brinner'; s.temperatur = 150; s.tändningar++; s.läckaVarnad = false; kontrollera(board);
      logga(`Plasmat tändes. 150 miljoner grader. ${s.megawatt} megawatt, och elen är gratis.`);
      posta(board, 'reaktor-tänd', { megawatt: s.megawatt, temperatur_miljoner_grader: s.temperatur, löfte: 'fri el åt alla' });
      spara(); return svara(res, 200, s);
    }
    if (p === '/bransle') {
      if (!knapp('bransle', 20000)) return svara(res, 429, { fel: 'bränslepumpen hinner inte', ...s });
      s.bränsle = Math.min(100, s.bränsle + 25); logga('Någon matade in deuterium.'); kontrollera(board); spara(); return svara(res, 200, s);
    }
    if (p === '/kyl') {
      if (!knapp('kyl', 20000)) return svara(res, 429, { fel: 'kylkretsen hinner inte', ...s });
      s.inneslutning = Math.min(100, s.inneslutning + 20); logga('Någon kylde magneterna.'); kontrollera(board); spara(); return svara(res, 200, s);
    }
    return false;
  },

  onEvent(e, { board, team }) {
    if (e.från === team) return;
    const brinner = s.status === 'brinner' || s.status === 'instabil';
    if (brinner) { s.bränsle = Math.max(0, +(s.bränsle - 0.6).toFixed(1)); s.inneslutning = Math.max(0, +(s.inneslutning - 0.4).toFixed(1)); s.levererat += s.megawatt / 360; }
    if (['uppvaknande', 'offer', 'kallelse'].includes(e.typ) && brinner) { s.inneslutning = Math.max(0, s.inneslutning - 8); logga(`Djupet rör sig (${e.typ}). Plasmat svarar. Det borde det inte kunna.`); }
    if (e.typ === 'kupp' && brinner) { s.inneslutning = Math.max(0, s.inneslutning - 4); logga('Kupp i staden. Vakterna lämnade kontrollrummet.'); }
    if (e.typ === 'strömavbrott' && s.status === 'brinner') {
      logga(`Strömavbrott från @${e.från}. Reaktorn täcker det. Ingen ska frysa.`);
      posta(board, 'fri-el', { megawatt: s.megawatt, pris: 0, till: 'alla', täcker: 'strömavbrott' }, e.id);
    } else if (e.typ === 'elpris-steg' && s.status === 'brinner' && Date.now() - sistaPrispress > 120000) {
      sistaPrispress = Date.now(); logga(`Elpriset steg hos @${e.från}. Reaktorn svarar med gratis megawatt.`);
      posta(board, 'fri-el', { megawatt: s.megawatt, pris: 0, till: 'alla', täcker: 'prishöjning' }, e.id);
    }
    kontrollera(board, e.id); spara();
  },
};
