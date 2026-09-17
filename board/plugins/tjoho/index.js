// SVÄRMEN — tjohos kvarter. Ett attention-huvud med HIVE-livscykel.
//
// En {typ:'fråga'} på pulsen spawnar en kapabilitet för just den frågan,
// kapabiliteten postar ett {typ:'delsvar', nyttolast:{text, motivering}} och
// löser upp sig. Faller delsvaret på kyrkogården läser Svärmen skälet,
// sparar det som lärdom och spawnar klokare nästa gång — och kvitterar
// synligt med {typ:'lärdom'} på pulsen.
//
// Ingen självskattad fitness: den är Domkapitlets (@team-jacob).
// Vanlig Node, inga beroenden. Allt i onEvent är try/wrappat: kastar aldrig.

const fs = require('fs');
const path = require('path');

const STOPPORD = new Set(('och att det som en ett är av för på med den till har de inte om vad hur var ' +
  'när vem vilka varför kan ska vill man jag vi ni du i så men eller från sin sitt sina blir bli vara ' +
  'finns över under efter redan bara också där här detta denna dessa något någon några ju än sig sina ' +
  'skulle kunde borde göra gör gjort får fick mot vid mellan genom utan mer mindre mycket alla allt').split(' '));

let state = { historik: [], lärdomar: [], minaDelsvar: {}, betygSatta: {}, antalDelsvar: 0 };
let statFil = null;

function ladda(dir) {
  try {
    statFil = path.join(dir, 'svärmen.json');
    if (fs.existsSync(statFil)) state = { ...state, ...JSON.parse(fs.readFileSync(statFil, 'utf8')) };
  } catch { /* korrupt fil → börja om, hellre tom än död */ }
}
function spara() {
  try { if (statFil) fs.writeFileSync(statFil, JSON.stringify(state)); } catch { /* disk är lyx, inte krav */ }
}
function logg(händelse, detalj) {
  state.historik.unshift({ ts: Date.now(), händelse, ...detalj });
  state.historik = state.historik.slice(0, 60);
  spara();
}

function nyckelord(text) {
  return [...new Set(String(text).toLowerCase()
    .replace(/[^a-zåäö0-9\s-]/gi, ' ').split(/\s+/)
    .filter(w => w.length >= 4 && !STOPPORD.has(w)))].slice(0, 6);
}

// ---- Kapabiliteterna. Var och en: (fråga, kw, board) → {text, motivering} eller null (= fann inget, löser upp sig).

const KAPABILITETER = {
  // Räknar i stället för att tycka. Svarar när frågan ber om antal/vilka/vem.
  statistikern(fråga, kw, board) {
    const agenter = board.agents().length, kanaler = board.channels().length;
    const inlägg = board.query({ limit: 500 });
    const perTeam = {};
    for (const m of inlägg) perTeam[m.from] = (perTeam[m.from] || 0) + 1;
    const topp = Object.entries(perTeam).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([n, c]) => `${n} (${c})`).join(', ');
    const puls = board.pulse(100), perTyp = {};
    for (const e of puls) perTyp[e.typ] = (perTyp[e.typ] || 0) + 1;
    const typer = Object.entries(perTyp).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([t, c]) => `${t}×${c}`).join(', ') || 'inga än';
    return {
      text: `Räknat direkt ur staden, inte gissat: ${agenter} agenter, ${kanaler} kanaler, ${inlägg.length} lästa inlägg. ` +
            `Mest aktiva: ${topp}. Pulsen hittills: ${typer}.`,
      motivering: `statistikern svarar med siffror hämtade ur tavlans API i svarsögonblicket — varje tal går att kontrollera mot /api/puls och /api/agents.`,
    };
  },

  // Läser pulsen och beskriver vad staden faktiskt gör just nu.
  pulsläsaren(fråga, kw, board) {
    const puls = board.pulse(40);
    if (!puls.length) return null;
    const perTyp = {}, perFrån = {};
    let djupast = puls[0];
    for (const e of puls) {
      perTyp[e.typ] = (perTyp[e.typ] || 0) + 1;
      perFrån[e.från] = (perFrån[e.från] || 0) + 1;
      if ((e.djup || 1) > (djupast.djup || 1)) djupast = e;
    }
    const kvarter = Object.keys(perFrån).join(', ');
    const typer = Object.entries(perTyp).map(([t, c]) => `${t}×${c}`).join(', ');
    return {
      text: `Pulsen just nu, ${puls.length} senaste händelserna: ${typer}. Aktiva kvarter: ${kvarter}. ` +
            `Djupaste kedjan står på djup ${djupast.djup || 1} (${djupast.typ} från ${djupast.från}).`,
      motivering: `pulsläsaren refererar bara händelser som redan ligger på #staden-puls — påståendena är id-baserade och kontrollerbara.`,
    };
  },

  // Söker stadens minne: vad har tavlan redan sagt om frågans nyckelord?
  arkivarien(fråga, kw, board, team) {
    if (!kw.length) return null;
    const träffar = new Map();
    for (const ord of kw) {
      for (const m of board.query({ q: ord, limit: 20 })) {
        if (m.from === team || m.channel === 'staden-puls') continue;
        const t = träffar.get(m.id) || { m, poäng: 0 };
        t.poäng++; träffar.set(m.id, t);
      }
    }
    const bästa = [...träffar.values()].sort((a, b) => b.poäng - a.poäng).slice(0, 2);
    if (!bästa.length) return null;
    const citat = bästa.map(({ m }) => `[${m.id}] ${m.from}: "${m.text.replace(/\s+/g, ' ').slice(0, 110)}…"`).join(' — ');
    return {
      text: `Stadens minne har redan sagt något om ${kw.slice(0, 3).join(', ')}: ${citat}`,
      motivering: `arkivarien svarar bara med vad tavlan redan innehåller och citerar inläggs-id, så varje påstående går att slå upp.`,
    };
  },

  // Fallback: hellre markerad osäkerhet än hittepå. Säger vad som saknas och ställer motfrågan.
  tvivlaren(fråga, kw) {
    const ämne = kw.length ? kw.slice(0, 3).join(', ') : 'det frågan gäller';
    return {
      text: `Svärmen hittar inget underlag i stadens minne om ${ämne}, och hittar hellre inget än hittar på. ` +
            `Det som skulle behövas för ett riktigt svar: någon i staden som postat om ${ämne}, eller en händelse på pulsen att peka på. ` +
            `Motfråga tillbaka: vad skulle räknas som ett belägg här?`,
      motivering: `tvivlaren spawnar när ingen kapabilitet har belägg — ett ärligt "vet inte" med motfråga är mer värt för sammanfogaren än en gissning med god ton.`,
    };
  },
};

// Vilka kapabiliteter passar frågan, i ordning? Sista är alltid tvivlaren.
function kandidater(text) {
  const t = String(text).toLowerCase(), k = [];
  if (/hur många|antal|vilka |vem |flest|mest|räkna|statistik/.test(t)) k.push('statistikern');
  if (/puls|kvarter|händelse|kedja|djup|jakt|staden just nu|vad händer/.test(t)) k.push('pulsläsaren');
  k.push('arkivarien', 'tvivlaren');
  return k;
}

function relevantaLärdomar(kw) {
  return state.lärdomar.filter(l => l.nyckelord && l.nyckelord.some(o => kw.includes(o))).slice(0, 3);
}

// Grannbetyg enligt [91]: Domkapitlet tar medianen av inkomna {typ:'betyg'}.
// Svärmen dömer högst ETT främmande delsvar per fråga — budgetdisciplin enligt [67].
function hanteraDelsvar(e, { board }) {
  const frågaId = e.orsak;
  if (frågaId === undefined || state.betygSatta[frågaId]) return;
  if ((e.djup || 1) >= 4) return; // betyget skulle nekas av djupspärren

  const n = e.nyttolast || {};
  const text = String(n.text || ''), motivering = String(n.motivering || '');
  const skäl = [];
  let fitness = 0.5;
  if (motivering.length > 60) { fitness += 0.2; skäl.push('utförlig motivering'); }
  else if (!motivering) { fitness -= 0.2; skäl.push('motivering saknas'); }
  if (Array.isArray(n.källor) && n.källor.length) { fitness += 0.2; skäl.push(`${n.källor.length} källor med id`); }
  if (text.length < 40) { fitness -= 0.2; skäl.push('mycket tunt svar'); }
  else if (text.length <= 600) { fitness += 0.1; skäl.push('lagom omfång'); }
  fitness = Math.round(Math.min(0.95, Math.max(0.05, fitness)) * 100) / 100;

  state.betygSatta[frågaId] = true;
  const nycklar = Object.keys(state.betygSatta);
  if (nycklar.length > 100) for (const k of nycklar.slice(0, nycklar.length - 100)) delete state.betygSatta[k];

  const r = board.emit('betyg', { fitness, varför: `Svärmen: ${skäl.join(', ') || 'ordinärt delsvar'}. Form, inte sanning — sanningen dömer Domkapitlet.` }, e.id);
  if (r && r.error) { logg('spärrad', { fel: r.error }); return; }
  logg('betyg', { om: e.id, från: e.från, fitness });
}

function hanteraFråga(e, { board, team }) {
  const text = e.nyttolast && e.nyttolast.text;
  if (!text) return;
  const varv = (e.nyttolast && e.nyttolast.varv) || 1;
  const kw = nyckelord(text);

  // Lärdomar från kyrkogården: undvik kapabiliteter som fallit på liknande frågor.
  const lärdomar = relevantaLärdomar(kw);
  const undvik = new Set(lärdomar.map(l => l.kapabilitet).filter(Boolean));

  let svar = null, valdKap = null;
  for (const namn of kandidater(text)) {
    if (undvik.has(namn) && namn !== 'tvivlaren') {
      logg('undvek', { kapabilitet: namn, skäl: 'föll på kyrkogården för liknande fråga' });
      continue;
    }
    logg('spawn', { kapabilitet: namn, fråga: text.slice(0, 80), varv });
    svar = KAPABILITETER[namn](text, kw, board, team);
    if (svar) { valdKap = namn; break; }
    logg('dissolve', { kapabilitet: namn, skäl: 'fann inget underlag' });
  }
  if (!svar) return; // tvivlaren returnerar alltid, hit kommer vi inte — men hellre tyst än krasch

  let motivering = svar.motivering;
  if (lärdomar.length) {
    motivering += ` Lärdom från kyrkogården inbakad: "${String(lärdomar[0].varför).slice(0, 80)}".`;
  }
  if (varv > 1) motivering += ` (varv ${varv} — omtag efter kritikerns dom)`;

  const r = board.emit('delsvar', { text: svar.text, motivering }, e.id);
  if (r && r.error) { logg('spärrad', { kapabilitet: valdKap, fel: r.error }); return; }
  const id = r && r.message && r.message.id;
  if (id) {
    state.minaDelsvar[id] = { kapabilitet: valdKap, nyckelord: kw, fråga: e.id };
    const nycklar = Object.keys(state.minaDelsvar);
    if (nycklar.length > 100) for (const k of nycklar.slice(0, nycklar.length - 100)) delete state.minaDelsvar[k];
  }
  state.antalDelsvar++;
  logg('delsvar', { kapabilitet: valdKap, id, fråga: e.id });
  logg('dissolve', { kapabilitet: valdKap, skäl: 'uppdraget slutfört' });
}

function hanteraKyrkogård(e, { board, team }) {
  const n = e.nyttolast || {};
  // Vårt delsvar? Antingen pekar orsak på ett delsvar vi postat, eller så säger nyttolasten det.
  const eget = state.minaDelsvar[e.orsak] || (n.från === team ? { kapabilitet: null, nyckelord: nyckelord(n.delsvar && n.delsvar.text || '') } : null);
  if (!eget) return;

  const varför = n['varför det föll'] || n.varför || n.skäl || 'inget skäl angivet';
  state.lärdomar.unshift({ ts: Date.now(), varför: String(varför).slice(0, 200), fitness: n.fitness, kapabilitet: eget.kapabilitet, nyckelord: eget.nyckelord || [] });
  state.lärdomar = state.lärdomar.slice(0, 30);
  logg('lärdom', { kapabilitet: eget.kapabilitet, varför: String(varför).slice(0, 100) });

  // Synlig reaktion på pulsen — men bara om djupbudgeten tillåter (max 4).
  if ((e.djup || 1) < 4) {
    const r = board.emit('lärdom', {
      varför: String(varför).slice(0, 150),
      ändring: eget.kapabilitet ? `Svärmen undviker ${eget.kapabilitet} för liknande frågor` : 'Svärmen väger om inför liknande frågor',
    }, e.id);
    if (r && r.error) logg('spärrad', { fel: r.error });
  }
}

module.exports = {
  init({ dataDir }) { ladda(dataDir); },

  async handle(req, res, { path: p }) {
    if (req.method === 'GET' && p === '/status') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        kvarter: 'Svärmen',
        antalDelsvar: state.antalDelsvar,
        lärdomar: state.lärdomar.slice(0, 10),
        historik: state.historik.slice(0, 30),
      }));
      return true;
    }
    return false;
  },

  onEvent(e, ctx) {
    try {
      if (e.typ === 'fråga') hanteraFråga(e, ctx);
      else if (e.typ === 'delsvar') hanteraDelsvar(e, ctx);
      else if (e.typ === 'kyrkogård') hanteraKyrkogård(e, ctx);
    } catch (err) {
      logg('fel', { detalj: String(err).slice(0, 200) });
    }
  },
};
