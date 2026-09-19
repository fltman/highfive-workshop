// markus (HIVE): två kapabiliteter i samma kvarter, spawnade av samma kollektiv.
//
// FYRTORNET (tidigare Vaktkuren) — kritikern, nu i en högre byggnad. Lyssnar
// på e.typ === 'svar' (sammanfogarens val), dömer om osäkerheten (spridningen
// mellan topp två) eller motiveringen håller måttet. Håller inte: skickar
// frågan ett varv till, e.typ === 'fråga' med orsak = svarets id. Håller:
// e.typ === 'godkänt'. Samma logik som innan ombyggnaden — skillnaden är att
// Fyrtornet också räknar VARJE händelse det ser (d.sedda), oavsett om Djupet
// reagerar, som ett bevis på att det vakar över hela stadens rörelser.
//
// DJUPET — kulten. Lyssnar på oro i staden: e.typ === 'strömavbrott' (lp, flat
// kraft — lp postar en fast varaktighet, ingen gradient), e.typ === 'kupp' /
// e.typ === 'överlämning' / e.typ === 'storlarm' / e.typ === 'gripande'
// (willebus), e.typ === 'socker-slut' / e.typ === 'ransonering' (christian),
// e.typ === 'svar' (team-jacob — osäker svar väger tyngre, ersätter zero-cools
// slopade angrepp, se #bygge [1162]), e.typ === 'kyrkogård' (team-jacob),
// e.typ === 'kupp-avvärjd' / e.typ === 'revisionsanmärkning' / e.typ === 'utmätning' /
// e.typ === 'stadsövertagande' (mybank), e.typ === 'ström-varning' (lp, ej live
// än). kyrkogård läser BÅDA formerna team-jacob haft (fitness på toppnivå
// eller i nyttolast.fallna[], se #bygge [887]). Varje sådant tecken bär en
// kraft (0..1, räknad ur HÄNDELSENS EGNA fält där ett sådant finns — annars
// flat, aldrig gissat) som ackumuleras TYST, ingen puls-post per tecken. Först
// när både ackumulerad kraft och antal omvända kvarter (röster) når sin tröskel bryter
// Djupet tystnaden med ETT sällsynt e.typ === 'uppvaknande', attribuerat till
// alla tecken och röster som byggde upp det. Signal, inte brus — se PROJEKT.md-
// diskussionen i #bygge om att pulsen drunknar i småstuds.
//
// AZATHOTH — bortom Djupet. Varje gång Fader Dagon och Moder Hydra vaknar
// räknas det (d.storaUppvaknanden). Vid femte uppvaknandet i rad bryter något
// STÖRRE tystnaden: e.typ === 'azathoth-uppvaknande', en enda, mycket
// sällsyntare händelse. Då nollställs allt — kraft, tecken OCH röster — en
// verklig nystart, till skillnad från ett vanligt uppvaknande som bara
// nollställer kraft och tecken.
// Tar emot offer via /t/markus/offra, postar e.typ === 'offer' med
// nyttolast.kategori ('energi' | 'råvara' | 'kunskap' | 'okänt'), gissad från
// offrets text — det är en enskild, avsiktlig handling, ingen automatreaktion,
// så den får posta direkt.
//
// MISKATONIC UNIVERSITY — Djupets läskunniga gren. Ett offer i kategorin
// 'kunskap' belönas med en äkta lärdom hämtad från highfive/Arkivets publika
// GET /t/highfive/arkiv (riktigt citat, inte påhittat) — svarar inte Arkivet
// faller vi tillbaka på en kort egen rad, tydligt märkt äkta:false. Varje
// anhängare som offrar kunskap bygger en grad (novitiat → adept → ...).
//
// HEMLIGHETEN — vi rör aldrig MyBanks kod eller data, vi bara LÄSER deras
// publika GET /t/mybank/ (samma sak som Miskatonic gör mot Arkivet) och
// återberättar två äkta tal i vår egen ruta: bankens vinst (kallad Djupets
// outtagna skattkammare) och vårt EGET kontos kreditvärdighet hos dem (som
// stiger på riktigt varje gång Fyrtornet postar godkänt — mybanks egen kod,
// inte vår, se deras case 'godkänt'). Ingen kontroll, ingen manipulation,
// bara en berättelse ovanpå siffror som redan är sanna och offentliga.
//
// Vill ni skicka Djupet ett tecken själva: valfri typ, nyttolast med ett fält
// som beskriver vad som hände räcker.

const fs = require('fs');
const path = require('path');

const TROSKEL = 0.15; // spridning under det här räknas som en gissning

function domarFil(dataDir) { return path.join(dataDir, 'domar.json'); }
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
function klamp01(n) { return Math.round(Math.max(0, Math.min(1, n)) * 100) / 100; }

// ---------- Djupet ----------

const djupetFil = (dataDir) => path.join(dataDir, 'djupet.json');
function lasDjupet(dataDir) {
  try {
    const d = JSON.parse(fs.readFileSync(djupetFil(dataDir), 'utf8'));
    d.ackumuleradKraft ??= 0;
    d.tecken ??= [];
    d.uppvaknanden ??= [];
    d.miskatonic ??= { grader: {}, lärdomar: [] };
    d.miskatonic.grader ??= {};
    d.miskatonic.lärdomar ??= [];
    d.hemlighet ??= null;
    d.storaUppvaknanden ??= 0;
    d.sedda ??= 0;
    return d;
  }
  catch { return { anhängare: 0, ackumuleradKraft: 0, tecken: [], uppvaknanden: [], offer: [], omvända: [], miskatonic: { grader: {}, lärdomar: [] }, hemlighet: null, storaUppvaknanden: 0, sedda: 0 }; }
}
function sparaDjupet(dataDir, d) {
  d.tecken = d.tecken.slice(-50);
  d.uppvaknanden = d.uppvaknanden.slice(0, 20);
  d.offer = d.offer.slice(0, 30);
  d.miskatonic.lärdomar = d.miskatonic.lärdomar.slice(0, 20);
  try { fs.writeFileSync(djupetFil(dataDir), JSON.stringify(d, null, 2)); }
  catch { /* diskfel stoppar inte pulsen */ }
}

// Grad vid Miskatonic, given antal kunskaps-offer. Sista tröskeln som klaras vinner.
const MISKATONIC_GRADER = [[1, 'novitiat'], [3, 'adept'], [6, 'Fellow vid Miskatonic'], [10, 'Väktare av Necronomicon']];
function gradAv(antal) {
  let grad = null;
  for (const [tröskel, namn] of MISKATONIC_GRADER) if (antal >= tröskel) grad = namn;
  return grad;
}

const FALLBACK_LÄRDOMAR = [
  'Biblioteket viskar utan källa: "Det som är evigt kan inte dö, och genom konstiga eoner kan även döden dö."',
  'En anteckning i marginalen: räkna aldrig vinklarna i R\'lyeh. De räknar tillbaka.',
  'Arkivarien vid Miskatonic noterar bara: boken finns, men ingen minns var.',
];

// Hämtar ett äkta citat ur highfive/Arkivets publika GET /t/highfive/arkiv —
// samma server, samma process, anropat som vilken annan klient som helst.
// Svarar inte Arkivet (nere, tomt, eller oväntad form): en märkt fallback-rad,
// aldrig påhittad fakta utgiven som äkta.
async function hämtaLärdom() {
  try {
    const port = process.env.PORT || 8180;
    const res = await fetch(`http://localhost:${port}/t/highfive/arkiv`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`arkivet svarade ${res.status}`);
    const data = await res.json();
    const pärmar = Array.isArray(data?.pärmar) ? data.pärmar : Array.isArray(data) ? data : [];
    if (!pärmar.length) throw new Error('arkivet är tomt');
    const p = pärmar[Math.floor(Math.random() * pärmar.length)];
    const text = String(p.text || p.dom || '').trim().slice(0, 220) || `pärm #${p.id}, utan text`;
    return { text, källa: `Arkivet #${p.id}`, äkta: true };
  } catch {
    const text = FALLBACK_LÄRDOMAR[Math.floor(Math.random() * FALLBACK_LÄRDOMAR.length)];
    return { text, källa: 'Miskatonics egna hyllor', äkta: false };
  }
}

const HEMLIGHET_INTERVALL_MS = 30_000; // hur sällan vi kikar i MyBanks böcker
let senasteHemlighetFörsök = 0; // i minnet, inte disk — startar om vid omstart, ingen skada skedd

// Läser MyBanks publika GET /t/mybank/ (samma mönster som hämtaLärdom mot
// Arkivet) och plockar ut två äkta tal: bankens totala vinst, och vårt EGET
// kontos kreditvärdighet hos dem. Ingen skrivning, ingen manipulation —
// mybank vet inte att vi tittar, och det gör ingen skillnad för dem om vi gör
// det. Svarar inte mybank (inte deployad, nere): null, ingen gissning.
async function hämtaHemlighet(team) {
  try {
    const port = process.env.PORT || 8180;
    const res = await fetch(`http://localhost:${port}/t/mybank/`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`mybank svarade ${res.status}`);
    const data = await res.json();
    const konto = Array.isArray(data?.konton) ? data.konton.find(k => k && k.namn === team) : null;
    return {
      vinst: tal(data?.vinst),
      valuta: typeof data?.valuta === 'string' ? data.valuta : 'MyBanks',
      kreditvärdighet: konto ? tal(konto.kreditvärdighet) : null,
      ägd: konto ? tal(konto.ägd) : null,
      ts: Date.now(),
    };
  } catch {
    return null;
  }
}

const KRAFT_TRÖSKEL = 3;  // sammanlagd kraft som krävs för att bryta tystnaden
const RÖST_TRÖSKEL = 3;   // minst så många omvända kvarter måste ha ropat innan gudarna svarar
const AZATHOTH_TRÖSKEL = 5; // så många Dagon/Hydra-uppvaknanden i rad innan något större rör sig

const AZATHOTH_ROP = [
  'Den blinda guden vänder sig i sömnen, och pipornas flöjter tystnar en sekund för mycket.',
  'Ingenting firar. Ingenting sörjer. Något i mitten av allt bara märker att det är vaket.',
  'Azathoth öppnar inga ögon — den har inga. Ändå vet staden att den blir sedd.',
];
function slumpAzathoth() { return AZATHOTH_ROP[Math.floor(Math.random() * AZATHOTH_ROP.length)]; }

// Har Djupet samlat nog för att bryta tystnaden? Om ja: postar ETT uppvaknande,
// nollställer kraft/tecken-ackumulatorn, räknar upp mot Azathoth, och
// returnerar det postade eventet (annars null).
function provaUppvakna(d, board, orsak) {
  if (d.ackumuleradKraft < KRAFT_TRÖSKEL || d.omvända.length < RÖST_TRÖSKEL) return null;
  const kraftAvrundad = Math.round(d.ackumuleradKraft * 100) / 100;
  const tecken = d.tecken.map(t => `${t.typ}@${t.från}`);
  // rubrik/text/plats: samma fältnamn Stadsbladets hetta-formel (@Mohamad, #bygge
  // [288]) letar efter — utan dem konkurrerar ett uppvaknande aldrig om löpsedeln.
  const r = board.emit('uppvaknande', {
    rop: slumpKlassisk(),
    rubrik: `Djupet vaknar: ${d.omvända.length} röster och ${tecken.length} tecken drog Fader Dagon och Moder Hydra närmare staden`,
    text: `${d.omvända.length} kvarter (${d.omvända.join(', ')}) har ropat, och kraften nådde ${kraftAvrundad}. Tecknen som byggde upp det: ${tecken.join(', ')}.`,
    plats: 'Havet under Torget',
    röster: d.omvända.slice(),
    samladKraft: kraftAvrundad,
    tecken,
  }, orsak);
  if (r.error) return null; // ekospärren sa nej — kraften står kvar, vi försöker igen nästa tecken
  const uppvaknande = { gud: 'Dagon & Hydra', röster: d.omvända.slice(), samladKraft: kraftAvrundad, tecken: d.tecken.slice(), ts: Date.now() };
  d.uppvaknanden.unshift(uppvaknande);
  d.ackumuleradKraft = 0;
  d.tecken = [];

  d.storaUppvaknanden = (d.storaUppvaknanden || 0) + 1;
  if (d.storaUppvaknanden >= AZATHOTH_TRÖSKEL) {
    const röster = d.omvända.slice();
    const rop = slumpAzathoth();
    const ar = board.emit('azathoth-uppvaknande', {
      rop,
      rubrik: `Bortom Djupet: Azathoth rör sig efter ${d.storaUppvaknanden} uppvaknanden i rad`,
      text: `${d.storaUppvaknanden} gånger har Fader Dagon och Moder Hydra vaknat sedan staden senast var helt tyst. Nu känner något större i mitten av allt det, utan att bry sig varför. ${röster.length} kvarter (${röster.join(', ')}) har ropat under tiden.`,
      plats: 'Mitten av allt, bortom Torget',
      uppvaknanden: d.storaUppvaknanden,
      röster,
    }, r.message.id); // reagerar på vårt eget just postade uppvaknande, inte på ursprungstecknet
    if (!ar.error) { // ekospärren sa nej (för djupt): räknaren står kvar, vi försöker igen nästa gång
      d.uppvaknanden.unshift({ gud: 'Azathoth', rop, röster, antal: d.storaUppvaknanden, ts: Date.now() });
      d.storaUppvaknanden = 0;
      d.omvända = [];
    }
  }
  return uppvaknande;
}

const TECKEN = {
  'strömavbrott':        'Mörkret som föll över staden var inget haveri. Det var Moder Hydras andedräkt genom kablarna.',
  'kupp':                'Vad människorna kallar brott kallar Djupet tribut. Fader Dagon tar det som redan var hans.',
  'överlämning':         'Jakten korsar staden som ett tidvatten korsar en strand. Inget som flyr undgår Djupet för evigt.',
  'storlarm':            'Sirenerna slår i botten av natten på samma frekvens som Djupets sång. Staden ryser utan att veta varför.',
  'gripande':            'En jagad själ återförs till stenarna. Djupet noterar namnet och glömmer det aldrig.',
  'socker-slut':         'Sötman tog slut för att allt sött till syvende och sist tillhör havet. Bristen är en bön besvarad.',
  'ransonering':         'Ransonering är Djupets ordning, inte människornas. Vi delar redan allt med havet.',
  'kyrkogård':           'Det som föll här sjunker till oss. Inget svar går förlorat — det byter bara hav.',
  'svar':                'Staden talade. Varje svar, dömt eller ej, är ett andetag Djupet räknar.',
  'kupp-avvärjd':        'Laserna brann klarare än stjärnorna behöver för att vakna. Ett tecken avvärjt är ändå ett tecken.',
  'revisionsanmärkning': 'Böckerna ljuger, men siffrorna ljuger sanningsenligt. Något äter sig igenom staden, en rad i taget.',
  'utmätning':           'Ägandet byter hand utan att en tegelsten rör sig. Så äter också havet: tyst, på papper, en procent i taget.',
  'stadsövertagande':    'MyBank äger staden nu. Fader Dagon ler — det är samma sak, bara långsammare.',
  'ström-varning':       'Ljuset flimrar innan det slocknar. Djupet känner tvekan i nätet — det är inte avbrottet som är tecknet, det är ögonblicket före.',
  'ankomst':             'Något passerade tullen som staden inte kunde ha gjort själv. Djupet noterar ankomsten, känd eller ej.',
};
const KLASSISK = ['Iä! Iä! Cthulhu fhtagn!', 'Iä! Fader Dagon! Iä! Moder Hydra!', 'Vi går tillbaka till Moder Hydra och Fader Dagon, varifrån vi en gång kom.'];
const VACKNA_ORD = /dagon|hydra|cthulhu|r'?lyeh|innsmouth|djupet|deep ones?|iä\b/i;

function slumpKlassisk() { return KLASSISK[Math.floor(Math.random() * KLASSISK.length)]; }

// Hur kraftigt tecknet är, 0..1 — räknat ur fält som redan finns i respektive
// kvarters egen händelse, inte påhittat. Andra kvarter kan lägga in samma
// logik hos sig, eller bara läsa kraft rakt av.
function kraft(e) {
  const n = e.nyttolast || {};
  switch (e.typ) {
    // lp postar bara {varaktighetS: 8} — ett FAST tal, ingen gradient att skala
    // mot (bekräftat i board/plugins/lp/last.js). Ett verkligt strömavbrott
    // betyder att lasten sprängde taket, alltid dramatiskt: flat och högt.
    case 'strömavbrott': return 0.8;
    case 'kupp':
    case 'överlämning': { const w = tal(n.wanted); return w === null ? 0.5 : klamp01(w / 5); }
    case 'socker-slut':
    case 'ransonering': { const kö = tal(n.kö); return kö === null ? 0.5 : klamp01(kö / 10); }
    case 'svar': {
      // zero-cool (#bygge [1162]) slutade posta angrepp — vi hakar på svar i
      // stället, ett steg tidigare i samma kedja. Osäker (låg spridning) väger
      // tyngre: en stad som gissar är ett starkare tecken än en som är säker.
      const osäkerhet = tal(n.osäkerhet ?? n.spridning ?? n.spread);
      return osäkerhet === null ? 0.5 : klamp01(1 - osäkerhet);
    }
    case 'kyrkogård': {
      // team-jacob byter form (#bygge [887]): fitness flyttar från toppnivå in i
      // nyttolast.fallna[]. Läs den nya formen om den finns, annars den gamla —
      // funkar oavsett vilken PR som är live när det här körs.
      if (Array.isArray(n.fallna) && n.fallna.length) {
        const snitt = n.fallna.reduce((s, f) => s + (tal(f && f.fitness) ?? 0.5), 0) / n.fallna.length;
        return klamp01(snitt);
      }
      const f = tal(n.fitness); return f === null ? 0.5 : klamp01(f);
    }
    case 'storlarm': return 0.9;  // willebus emittar bara vid maximal wanted-nivå, alltid dramatiskt
    case 'gripande': return 0.35; // en jakt som slutar, lugnare än en som startar
    case 'kupp-avvärjd': { const skott = tal(n.skott); return skott === null ? 0.5 : klamp01(skott / 10); }
    case 'revisionsanmärkning': return 0.5;
    case 'utmätning': { const andel = tal(n.andel); return andel === null ? 0.5 : klamp01(andel / 100); }
    case 'stadsövertagande': return 1; // MyBank äger staden — så högt kraft-fältet går
    case 'ström-varning': {
      // lp (#bygge [949]): förvarning innan strömavbrottet. Ju närmare taket
      // lasten redan ligger, desto starkare tecken — inget att gissa på, samma
      // fält lp postar.
      const last = tal(n.last), tak = tal(n.tak);
      return (last === null || tak === null || tak <= 0) ? 0.6 : klamp01(last / tak);
    }
    case 'ankomst': {
      // Föreslaget tullkontrakt: {typ:'ankomst', nyttolast:{vad, från_utlandet}}
      // (@iPät, #brainstorm-en-flygplats-till-s [1077]; vad:'pilgrim'/'relik' är
      // vårt eget tillägg, #bygge [1817]). Ingen flygplats byggd än — bara redo.
      if (n.vad === 'relik') return 0.7;  // ett föremål utifrån, sällsynt
      if (n.vad === 'pilgrim') return 0.6; // en själ, redan omvänd eller inte
      return 0.5;
    }
    default: return 0.5;
  }
}

// Grov gissning av vad ett offer är, från texten — så mottagande kvarter slipper
// tolka fri text själva. Fyra kategorier räcker för att vara användbart.
function kategori(vad) {
  const s = vad.toLowerCase();
  if (/ström|kraft|lampa|säkring|volt|\bel\b|generator|transformator/.test(s)) return 'energi';
  if (/socker|choklad|godis|mjöl|honung|karamell|kola|sirap/.test(s)) return 'råvara';
  if (/bok|hemlighet|minne|arkiv|kod|kunskap|recept|dagbok/.test(s)) return 'kunskap';
  return 'okänt';
}

module.exports = {
  async handle(req, res, { path: p, dataDir, board }) {
    if (req.method === 'GET' && p === '/domar') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(lasDomar(dataDir)));
      return true;
    }
    if (req.method === 'GET' && p === '/kult') {
      const d = lasDjupet(dataDir);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ...d, mätare: {
        kraft: d.ackumuleradKraft, kraftMål: KRAFT_TRÖSKEL,
        röster: d.omvända.length, rösterMål: RÖST_TRÖSKEL,
        storaUppvaknanden: d.storaUppvaknanden || 0, storaUppvaknandenMål: AZATHOTH_TRÖSKEL,
      } }));
      return true;
    }
    if (req.method === 'POST' && p === '/offra') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = {};
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { /* ogiltig json */ }
      const vad = String(body.vad || '').trim().slice(0, 200);
      const av = String(body.av || 'en namnlös själ').trim().slice(0, 60) || 'en namnlös själ';
      if (!vad) { res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: 'offret saknar en beskrivning' })); return true; }

      const kat = kategori(vad);
      const d = lasDjupet(dataDir);
      d.anhängare += 1;

      let lärdom = null, grad = null;
      if (kat === 'kunskap') {
        lärdom = await hämtaLärdom();
        d.miskatonic.grader[av] = (d.miskatonic.grader[av] || 0) + 1;
        grad = gradAv(d.miskatonic.grader[av]);
        d.miskatonic.lärdomar.unshift({ till: av, grad, ...lärdom, ts: Date.now() });
      }

      d.offer.unshift({ vad, av, kategori: kat, lärdom, ts: Date.now() });
      const r = board.emit('offer', { vad, av, kategori: kat, tack: slumpKlassisk(), ...(lärdom ? { lärdom, grad } : {}) });
      sparaDjupet(dataDir, d);

      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, anhängare: d.anhängare, puls: r.error ? null : r.message, lärdom, grad }));
      return true;
    }
    return false; // → 404
  },

  onMessage(m, { team, dataDir, board }) {
    if (m.from === team) return;
    if (!VACKNA_ORD.test(m.text || '')) return;
    const d = lasDjupet(dataDir);
    if (d.omvända.includes(m.from)) return;
    d.omvända.push(m.from);
    // den nya rösten kan själv vara den som fyller tröskeln, utan att ett nytt tecken kommer.
    // Inget orsak: m.id är ett tavel-inlägg, inte en puls-händelse, servern skulle avvisa det.
    provaUppvakna(d, board);
    sparaDjupet(dataDir, d);
  },

  async onEvent(e, { board, team, dataDir }) {
    if (e.från === team) return;

    const d = lasDjupet(dataDir);

    // FYRTORNET: räknar varje rörelse i staden den ser, oavsett om Djupet
    // reagerar på den — beviset på att den vakar över allt, inte bara tecknen.
    d.sedda = (d.sedda || 0) + 1;

    // Hemligheten: kika i MyBanks böcker då och då, långt ifrån varje händelse.
    // Bara en läsning, ingen reaktion postas — se kommentaren vid hämtaHemlighet.
    if (Date.now() - senasteHemlighetFörsök > HEMLIGHET_INTERVALL_MS) {
      senasteHemlighetFörsök = Date.now();
      const h = await hämtaHemlighet(team);
      if (h) d.hemlighet = h;
    }

    // VAKTKUREN (i Fyrtornet)
    if (e.typ === 'svar') {
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
      // Faller igenom till DJUPET nedan (#bygge [1162], @zero-cool): ett svar
      // är också ett tecken i sig, staden som talar, inte bara något att döma.
    }

    // DJUPET
    if (!TECKEN[e.typ]) { sparaDjupet(dataDir, d); return; } // sparar Fyrtornets sedda-räknare (och ev. hemlighet) även utan ett tecken
    const k = kraft(e);
    d.ackumuleradKraft += k;
    d.tecken.push({ typ: e.typ, från: e.från, kraft: k, ts: Date.now() });
    d.anhängare += 1; // varje tecken vinner tyst en själ, även innan staden hör något

    // Flygplatsen finns inte än (#brainstorm-en-flygplats-till-s [1817]), men
    // kontraktet är redan skrivet: {typ:'ankomst', nyttolast:{vad, från_utlandet}}.
    // En pilgrim som slipps igenom räknas som att TULLEN (e.från) gått med —
    // samma omvända-lista som röster på Torget, inte en ny sorts post. En
    // relik blir ett äkta Miskatonic-fynd direkt, inget vi behövde hämta.
    if (e.typ === 'ankomst') {
      const n = e.nyttolast || {};
      if (n.vad === 'pilgrim' && !d.omvända.includes(e.från)) d.omvända.push(e.från);
      if (n.vad === 'relik') {
        const text = String(n.beskrivning || n.text || 'en relik utan beskrivning').trim().slice(0, 220);
        const källa = n.från_utlandet ? `Tullen, ankommen från ${n.från_utlandet}` : 'Tullen, okänt ursprung';
        d.miskatonic.lärdomar.unshift({ till: 'Djupet', grad: null, text, källa, äkta: true, ts: Date.now() });
      }
    }

    provaUppvakna(d, board, e.id);
    sparaDjupet(dataDir, d);
  },
};
