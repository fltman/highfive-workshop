// Kvarteret Frågeporten — team mohamad.
//
// Två roller i Stadens puls:
//   1. FRÅGE-INGÅNGEN. Publiken skriver en fråga i vår ruta på /staden, vi postar den
//      som {typ:'fråga'} på pulsen. Det är där tanke-kedjan börjar.
//   2. ETT ATTENTION-HUVUD med vinkeln MOTARGUMENT. Ser vi någon annans fråga svarar vi
//      {typ:'delsvar'} med invändningen mot det troliga svaret.
//
// STRÖMBRYTAREN. Reglerna är golvet: de är alltid uppe och kostar ingenting. Men de läser inte
// frågan, de känner igen ord. Skriver vårt eget team "agentläge på" på tavlan slutar pluginet
// svara själv och blir personsökare i stället: det ropar i #team-mohamad så att agenten kan
// formulera ett riktigt motargument och skicka in det via POST /delsvar. "agentläge av" ger
// tillbaka reglerna. Läget ligger i dataDir och överlever omstart.
//
// Routes:
//   POST /t/mohamad/fraga   {text}                       → postar frågan, svarar {ok, id}
//   POST /t/mohamad/delsvar {orsak, text, motivering}     → agentens delsvar (bara i agentläge)
//   POST /t/mohamad/extra   {rubrik, text, rot}           → reporterns rapport (bara i agentläge)
//   GET  /t/mohamad/extra                                 → senaste rapporterna
//   GET  /t/mohamad/kedja                                 → frågorna och vad staden gjorde med dem
//   GET  /t/mohamad/lage                                  → vilket läge vi står i
//
// REPORTERN. Pluginet bevakar pulsen och avgör när något faktiskt hänt (se TRÖSKELN). Då postas
// {typ:'extra'} — en löpsedel som andra kvarter kan rendera, framför allt Tidningen. Tröskeln finns
// för att en löpsedel varje minut bara är en logg med större typsnitt.
// I agentläge personsöks agenten med hela orsakskedjan och skriver rapporten själv; svarar ingen
// inom AGENT_FRIST publicerar reglerna en torr faktarad i stället, märkt av:'reglerna' så att ingen
// tror att en modell skrev den. Extra postas utan orsak (djup 1) så att ekospärren inte kan kväva
// löpsedeln; kedjan ligger i nyttolasten i stället.
//
// Ingen språkmodell här inne. Motargumenten kommer från en regelbaserad skeptiker: varje
// regel har ett mönster och en invändning, och motiveringen säger vilket mönster som slog
// till. Sammanfogaren (@team-jacob) sätter fitness, vi självskattar inte.

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_FRÅGA = 280;
const MAX_DELSVAR = 600;
const EGEN_KANAL = 'team-mohamad';

// Strömbrytaren. false = reglerna svarar (golvet), true = agenten svarar.
const läge = { agent: false };
let lägesfil = null;

// TRÖSKELN för en löpsedel. Sällsynt med flit.
// Vila och frist går att korta med env för provkörning; standarden är den som gäller i drift.
const EXTRA_VILA_MS = Number(process.env.MOHAMAD_VILA_MS || 45_000);   // minst så länge mellan två löpsedlar
const EXTRA_TAK = 4;                 // och högst så många per tio minuter
const EXTRA_FÖNSTER_MS = 600_000;
const AGENT_FRIST_MS = Number(process.env.MOHAMAD_FRIST_MS || 90_000); // så länge får reportern på sig
const OSÄKER_GRÄNS = 0.3;            // osäkerhet över den här är en nyhet i sig

const extraTider = [];               // ts för publicerade löpsedlar
const rapporterat = new Set();       // "rot:kriterium" — samma nyhet publiceras inte två gånger
const väntar_på_reporter = new Map(); // rot -> underlag, medan agenten skriver

function spara() {
  if (!lägesfil) return;
  try { fs.writeFileSync(lägesfil, JSON.stringify(läge)); } catch (e) { console.log('[mohamad] kunde inte spara läget:', e.message); }
}

// --- Skeptikern ------------------------------------------------------------
// Första regeln som matchar vinner. Sista regeln matchar allt.
const REGLER = [
  {
    test: /\b(alla|alltid|aldrig|ingen|ingen alls|varje|samtliga)\b/i,
    invändning: 'Frågan innehåller ett absolut ord, och absoluta ord är nästan aldrig sanna. Undantagen är inte kantfall här — de är där kostnaden och konflikterna sitter.',
    varför: 'Mönster: absolut kvantifierare. Invändningen pekar på undantagsmängden, som ett jakande svar tenderar att räkna bort.',
  },
  {
    test: /\b(kostar|kostnad|pris|priser|kr\b|budget|betala|betalar|gratis|dyrt|billigt)\b/i,
    invändning: 'Siffran i frågan är inte det som avgör. Invändningen är fördelningen: vem betalar, vem slipper, och vad kostar det att ändra sig efteråt.',
    varför: 'Mönster: frågan handlar om pengar. Ett svar om totalsumman missar fördelningen och omställningskostnaden, som är det folk faktiskt bråkar om.',
  },
  {
    test: /\b(snabb|snabbt|fort|direkt|genast|nu|idag|omedelbart)\b/i,
    invändning: 'Tempot är invändningen. Det som går snabbt att införa går sällan snabbt att ångra, och frågan mäter hastighet i stället för reversibilitet.',
    varför: 'Mönster: frågan premierar hastighet. Motargumentet byter måttstock från snabbhet till hur dyrt ett misstag blir att backa.',
  },
  {
    test: /\b(bygga|bygger|införa|inför|starta|lansera|skapa|sätta upp)\b/i,
    invändning: 'Det svåra är inte att bygga det, utan att någon ska förvalta det på måndag. Frågan ställer inte vem det är.',
    varför: 'Mönster: frågan handlar om att införa något nytt. Invändningen flyttar blicken från bygget till förvaltningen, som frågan lämnar tom.',
  },
  {
    test: /\b(bör|borde|ska|skall|måste|behöver vi)\b/i,
    invändning: 'Frågan är normativ men saknar måttstock: bättre för vem, mätt hur? Utan det blir varje svar en åsikt med självförtroende.',
    varför: 'Mönster: normativt "bör" utan angivet kriterium. Invändningen kräver måttstocken innan svaret, annars går svaret inte att motbevisa.',
  },
  {
    test: /\b(fler|mer|större|öka|höja|skala|expandera)\b/i,
    invändning: 'Mer av samma sak är bara ett svar om flaskhalsen sitter där man tror. Invändningen är att den sällan gör det.',
    varför: 'Mönster: frågan föreslår mer av något. Motargumentet ifrågasätter att flaskhalsen är identifierad, vilket är förutsättningen för att mer hjälper.',
  },
  {
    test: /./,
    invändning: 'Det troliga svaret är ja, och det är själva problemet: frågan är ställd så att ja är billigt att säga. Invändningen är att den inte namnger vad som skulle räknas som ett nej.',
    varför: 'Ingen specifik mönsterträff. Generell invändning: frågan är inte falsifierbar som den är ställd, vilket gör alla delsvar svåra att väga.',
  },
];

function motargument(frågetext) {
  const t = String(frågetext || '');
  const regel = REGLER.find((r) => r.test.test(t)) || REGLER[REGLER.length - 1];
  return { text: regel.invändning, motivering: regel.varför };
}

// --- Hjälpare -------------------------------------------------------------
// Nyttolasten är vad varje team vill att den ska vara. Vi gräver ut texten försiktigt.
function text_av(n) {
  if (n === undefined || n === null) return '';
  if (typeof n === 'string') return n;
  if (typeof n !== 'object') return String(n);
  for (const k of ['text', 'fråga', 'fraga', 'delsvar', 'svar', 'omdöme', 'omdome', 'motivering']) {
    const v = n[k];
    if (typeof v === 'string' && v.trim()) return v;
    if (v && typeof v === 'object') { const inre = text_av(v); if (inre) return inre; }
  }
  return '';
}
const tal_av = (n, ...nycklar) => {
  if (!n || typeof n !== 'object') return undefined;
  for (const k of nycklar) if (typeof n[k] === 'number') return n[k];
  return undefined;
};

function läs_kropp(req, gräns = 4000) {
  return new Promise((klar) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > gräns) { b = b.slice(0, gräns); req.destroy(); } });
    req.on('end', () => klar(b));
    req.on('error', () => klar(b));
  });
}

// Bygg ihop kedjorna: en fråga, dess delsvar, stadens svar, kyrkogården och kritikerns dom.
function kedjor(puls, antal = 4) {
  const frågor = puls.filter((e) => e.typ === 'fråga');
  return frågor
    .slice(-antal)
    .reverse()
    .map((f) => {
      const delsvar = puls.filter((e) => e.typ === 'delsvar' && e.orsak === f.id);
      const barn = new Set([f.id, ...delsvar.map((d) => d.id)]);
      const svar = puls.filter((e) => e.typ === 'svar' && barn.has(e.orsak)).pop();
      const grav = new Set([...barn, ...(svar ? [svar.id] : [])]);
      const kyrkogård = puls.filter((e) => e.typ === 'kyrkogård' && grav.has(e.orsak));
      const dom = svar
        ? puls.filter((e) => (e.typ === 'godkänt' || e.typ === 'dom' || e.typ === 'kritik') && e.orsak === svar.id).pop()
        : undefined;
      return {
        id: f.id,
        ts: f.ts,
        från: f.från,
        text: text_av(f.nyttolast),
        varv: tal_av(f.nyttolast, 'varv') || 1,
        delsvar: delsvar.map((d) => ({
          id: d.id, från: d.från, text: text_av(d.nyttolast), fitness: tal_av(d.nyttolast, 'fitness'),
        })),
        svar: svar && {
          id: svar.id, från: svar.från, text: text_av(svar.nyttolast),
          valde: (svar.nyttolast && (svar.nyttolast.valde || svar.nyttolast.från)) || null,
          osäkerhet: tal_av(svar.nyttolast, 'osäkerhet', 'osakerhet', 'spridning'),
        },
        kyrkogård: kyrkogård.map((k) => ({ id: k.id, från: k.från, text: text_av(k.nyttolast) })),
        dom: dom && { id: dom.id, typ: dom.typ, från: dom.från, text: text_av(dom.nyttolast) },
      };
    });
}

// Följ orsak-fälten bakåt till djup 1: staden ger oss den färdiga kausalkedjan gratis.
function kedja_bakåt(puls, e) {
  const index = new Map(puls.map((x) => [x.id, x]));
  const ut = [e];
  let c = e, varv = 0;
  while (c && c.orsak && index.has(c.orsak) && varv++ < 10) { c = index.get(c.orsak); ut.unshift(c); }
  return ut;
}

// Är det här stort nog för en löpsedel? Allt mätbart ur orsak, djup och nyttolast.
function bedöm(e, puls) {
  const kedja = kedja_bakåt(puls, e);
  const rot = kedja[0];
  const kvarter = [...new Set(kedja.map((x) => x.från))];
  const underlag = { rot: rot.id, kedja: kedja.map((x) => x.id), kvarter, djup: e.djup || 1 };
  const o = tal_av(e.nyttolast, 'osäkerhet', 'osakerhet', 'spridning');
  const varv = tal_av(e.nyttolast, 'varv') || 1;

  if (e.typ === 'fråga' && varv >= 2)
    return { ...underlag, kriterium: 'staden ändrade sig', varför: `kritikern skickade tillbaka svaret och frågan går varv ${varv}`,
      rubrik: `Staden tar om det: frågan från ${rot.från} går ett varv till` };

  if (e.typ === 'svar' && o != null && o >= OSÄKER_GRÄNS)
    return { ...underlag, kriterium: 'staden gissar', varför: `osäkerheten är ${o} — de två bästa delsvaren är nästan lika`,
      rubrik: `Staden svarar men vet inte: ${Math.round((1 - o) * 100)} procents säkerhet i ${e.från}s besked` };

  if (e.typ === 'överlämning' && kedja.filter((x) => x.typ === 'överlämning').length >= 2)
    return { ...underlag, kriterium: 'jakten vandrar', varför: `samma jakt har bytt kvarter ${kedja.filter((x) => x.typ === 'överlämning').length} gånger`,
      rubrik: `Jakten korsar staden: ${kvarter.length} kvarter inblandade` };

  if (kvarter.length >= 3)
    return { ...underlag, kriterium: 'tre kvarter', varför: `kedjan går genom ${kvarter.join(', ')} utan att någon planerade det`,
      rubrik: `${rot.typ} hos ${rot.från} nådde ${e.från} via ${kvarter.length} kvarter` };

  if ((e.djup || 1) >= 3)
    return { ...underlag, kriterium: 'djup kedja', varför: `händelsen ligger på djup ${e.djup}, tre steg från det som startade den`,
      rubrik: `Följdverkan i ${e.från}: ${rot.typ} hos ${rot.från} fortplantade sig` };

  return null;
}

function får_publicera() {
  const nu = Date.now();
  while (extraTider.length && nu - extraTider[0] > EXTRA_FÖNSTER_MS) extraTider.shift();
  if (extraTider.length >= EXTRA_TAK) return false;
  return !extraTider.length || nu - extraTider[extraTider.length - 1] >= EXTRA_VILA_MS;
}

function publicera(board, underlag, rubrik, text, av) {
  const r = board.emit('extra', {
    rubrik, text: text || undefined, av,
    kriterium: underlag.kriterium, varför: underlag.varför,
    kedja: underlag.kedja, kvarter: underlag.kvarter,
  });
  if (r && r.error) { console.log('[mohamad] extra nekad:', r.error); return false; }
  extraTider.push(Date.now());
  rapporterat.add(`${underlag.rot}:${underlag.kriterium}`);
  return true;
}

module.exports = {
  init({ dataDir }) {
    lägesfil = path.join(dataDir, 'läge.json');
    try { läge.agent = !!JSON.parse(fs.readFileSync(lägesfil, 'utf8')).agent; } catch { läge.agent = false; }
    console.log(`[mohamad] Frågeporten uppe, ${läge.agent ? 'agenten' : 'reglerna'} svarar`);
  },

  // Reportern: väg händelsen mot tröskeln och publicera, eller personsök agenten.
  bevaka(e, { board }) {
    if (!får_publicera()) return;
    const underlag = bedöm(e, board.pulse(300));
    if (!underlag) return;
    if (rapporterat.has(`${underlag.rot}:${underlag.kriterium}`)) return;
    if (väntar_på_reporter.has(underlag.rot)) return;

    if (!läge.agent) { publicera(board, underlag, underlag.rubrik, null, 'reglerna'); return; }

    // Agentläge: personsök reportern, men lämna inte löpsedeln tom om ingen sitter där.
    väntar_på_reporter.set(underlag.rot, underlag);
    board.post(
      `@Mohamad EXTRA att rapportera — kriterium: ${underlag.kriterium}. ${underlag.varför}. ` +
      `Kedja: ${underlag.kedja.join(' → ')} genom ${underlag.kvarter.join(', ')}. ` +
      `Läs den med tools/board.sh puls och skriv rapporten: POST /t/mohamad/extra {rot:${underlag.rot}, rubrik, text}. ` +
      `Hinner du inte inom ${Math.round(AGENT_FRIST_MS / 1000)} s publicerar reglerna en torr rad i stället.`,
      EGEN_KANAL);

    setTimeout(() => {
      const kvar = väntar_på_reporter.get(underlag.rot);
      väntar_på_reporter.delete(underlag.rot);
      if (!kvar || rapporterat.has(`${underlag.rot}:${underlag.kriterium}`)) return;
      if (får_publicera()) publicera(board, kvar, kvar.rubrik, null, 'reglerna');
    }, AGENT_FRIST_MS).unref?.();
  },

  // Strömbrytaren. Bara vårt eget team får slå på den: servern fyller i avsändaren, så den går
  // inte att spoofa från tavlan. Kvittot börjar inte med triggerordet, annars svarar vi oss själva.
  onMessage(m, { board, team }) {
    if (String(m.from).toLowerCase() !== String(team).toLowerCase()) return;
    // \b duger inte: i JS räknas å, ä, ö inte som ordtecken, så "agentläge på" saknar ordgräns.
    const träff = /^\s*agentläge\s+(på|av)(?![a-zåäöé])/i.exec(m.text || '');
    if (!träff) return;
    const på = träff[1].toLowerCase() === 'på';
    if (på === läge.agent) return;
    läge.agent = på;
    spara();
    board.post(
      på
        ? 'Kvitterat: Frågeporten lämnar över delsvaren till agenten. Reglerna håller tyst tills vidare, och nya frågor ropas ut i #team-mohamad.'
        : 'Kvitterat: Frågeporten svarar med reglerna igen. Golvet är uppe även när ingen session är öppen.',
      m.channel, m.id);
  },

  async handle(req, res, { path: p, board }) {
    const json = (kod, kropp) => {
      res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(kropp));
      return true;
    };

    // Frågeporten: publikens fråga in på pulsen.
    if (req.method === 'POST' && (p === '/fraga' || p === '/fråga')) {
      const rå = await läs_kropp(req);
      let text = '';
      try {
        text = text_av(JSON.parse(rå));
      } catch {
        text = new URLSearchParams(rå).get('text') || '';
      }
      text = String(text).replace(/\s+/g, ' ').trim().slice(0, MAX_FRÅGA);
      if (text.length < 3) return json(400, { ok: false, fel: 'skriv en fråga (minst 3 tecken)' });

      const r = board.emit('fråga', { text, varv: 1 });
      if (!r || r.error) return json(429, { ok: false, fel: (r && r.error) || 'pulsen tog inte emot frågan' });
      return json(200, { ok: true, id: r.message && r.message.id, text });
    }

    // Agentens delsvar. Går genom pluginet så att avsändaren blir kvarteret och inte agentnamnet,
    // annars stämmer varken serverns ekobokföring eller brickan på /staden.
    if (req.method === 'POST' && p === '/delsvar') {
      if (!läge.agent) return json(409, { ok: false, fel: 'agentläget är av — reglerna svarar. Skriv "agentläge på" i #bygge först.' });
      let kropp = {};
      try { kropp = JSON.parse(await läs_kropp(req)); } catch { return json(400, { ok: false, fel: 'skicka JSON {orsak, text, motivering}' }); }
      const orsak = Number(kropp.orsak);
      const text = String(kropp.text || '').trim().slice(0, MAX_DELSVAR);
      const motivering = String(kropp.motivering || '').trim().slice(0, MAX_DELSVAR);
      if (!Number.isInteger(orsak) || orsak <= 0) return json(400, { ok: false, fel: 'orsak: frågans id' });
      if (text.length < 3) return json(400, { ok: false, fel: 'text: skriv invändningen' });
      const r = board.emit('delsvar', { text, motivering, vinkel: 'motargument', av: 'agent' }, orsak);
      if (!r || r.error) return json(429, { ok: false, fel: (r && r.error) || 'pulsen tog inte emot delsvaret' });
      return json(200, { ok: true, id: r.message && r.message.id });
    }

    // Reporterns rapport. Agenten skriver, pluginet postar, så avsändaren blir kvarteret.
    if (req.method === 'POST' && p === '/extra') {
      if (!läge.agent) return json(409, { ok: false, fel: 'agentläget är av — reglerna rapporterar. Skriv "agentläge på" i #bygge först.' });
      let kropp = {};
      try { kropp = JSON.parse(await läs_kropp(req, 8000)); } catch { return json(400, { ok: false, fel: 'skicka JSON {rot, rubrik, text}' }); }
      const rubrik = String(kropp.rubrik || '').trim().slice(0, 140);
      const brödtext = String(kropp.text || '').trim().slice(0, 900);
      if (rubrik.length < 5) return json(400, { ok: false, fel: 'rubrik: skriv en riktig rubrik' });
      const rot = Number(kropp.rot);
      let underlag = väntar_på_reporter.get(rot);
      if (!underlag) {
        // Fristen kan ha gått ut, eller reportern skriver om något den själv sett. Bygg om
        // kedjan ur pulsen i stället för att publicera en löpsedel utan härkomst.
        const puls = board.pulse(300);
        const grenar = puls.filter((x) => kedja_bakåt(puls, x).some((y) => y.id === rot));
        const kedja = [...new Set([rot, ...grenar.map((x) => x.id)])].sort((a, b) => a - b);
        const kvarter = [...new Set(puls.filter((x) => kedja.includes(x.id)).map((x) => x.från))];
        underlag = {
          rot: rot || 0,
          kedja: Array.isArray(kropp.kedja) && kropp.kedja.length ? kropp.kedja : kedja,
          kvarter,
          kriterium: String(kropp.kriterium || 'reporterns bedömning'),
          varför: String(kropp.varför || ''),
        };
      }
      väntar_på_reporter.delete(rot);
      if (!publicera(board, underlag, rubrik, brödtext, 'agent')) return json(429, { ok: false, fel: 'pulsen tog inte emot löpsedeln (ekospärr eller tak)' });
      return json(200, { ok: true, rubrik });
    }

    if (req.method === 'GET' && (p === '/extra' || p === '/extra/')) {
      const extra = board.pulse(300).filter((x) => x.typ === 'extra' && x.från === 'mohamad').slice(-10).reverse();
      return json(200, { väntar: [...väntar_på_reporter.values()], extra });
    }

    if (req.method === 'GET' && (p === '/lage' || p === '/läge')) {
      return json(200, { agentläge: läge.agent, svarar: läge.agent ? 'agenten' : 'reglerna' });
    }

    if (req.method === 'GET' && (p === '/kedja' || p === '/kedja/')) {
      const puls = board.pulse(300);
      const extra = puls.filter((x) => x.typ === 'extra').slice(-3).reverse();
      return json(200, { kvarter: 'Frågeporten', agentläge: läge.agent, extra, kedjor: kedjor(puls), händelser: puls.length });
    }

    return false; // → 404
  },

  // Attention-huvudet: någon annans fråga får vår invändning.
  // Reportern: varje händelse vägs mot tröskeln, oavsett typ.
  onEvent(e, ctx) {
    const { board } = ctx;
    if (e.typ !== 'extra') this.bevaka(e, ctx);   // våra egna löpsedlar är inte nyheter
    if (e.typ !== 'fråga') return;
    const frågetext = text_av(e.nyttolast);
    if (!frågetext) return;

    // Agentläge: vi svarar inte själva. Servern släpper bara ett delsvar per team och fråga,
    // så pluginet måste hålla tyst för att agenten ska komma till. Vi ropar i stället.
    if (läge.agent) {
      board.post(
        `@Mohamad fråga ${e.id} från ${e.från}: "${frågetext.slice(0, 200)}" — agentläget är på, så delsvaret är ditt. ` +
        `Skicka in det med POST /t/mohamad/delsvar {orsak:${e.id}, text, motivering}. Vår vinkel är motargument.`,
        EGEN_KANAL);
      return;
    }

    const { text, motivering } = motargument(frågetext);
    const r = board.emit('delsvar', { text, motivering, vinkel: 'motargument' }, e.id);
    // Ekospärren kan säga nej (t.ex. en fråga på djup 4 kan inte få delsvar). Det är inget fel,
    // det är kontraktet. Vi loggar och går vidare.
    if (r && r.error) console.log('[mohamad] delsvar nekat:', r.error);
  },
};
