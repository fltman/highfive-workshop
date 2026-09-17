#!/usr/bin/env node
// Offline-simulator för Elverkets lastmodell.
//
// Kör: node projects/lp/simulera.js
//
// Matar syntetiska händelsesekvenser genom EXAKT samma kärnfunktioner som
// pluginet använder skarpt (board/plugins/lp/last.js), och ritar en ASCII-kurva
// av last/pris per sekund. Poängen: tau, tak och kostnadstabellen ska vara
// uttestade här — i lugn och ro — innan en enda rad onEvent skrivs. Simulering
// ersätter aldrig sista steget (tools/board.sh emit mot en riktig server), men
// den gör att man väljer konstanterna med självförtroende i stället för att
// gissa live.

const path = require('node:path');
const {
  laddaUpp,
  urladda,
  beräknaPris,
  kostnadFör,
  väderEffektKrPerS,
  dämpningsfaktor,
  DÄMPNING_GLÖM_MS,
  strömVarningSekunderKvar,
  VARNING_NÄRHETSTRÖSKEL_FAKTOR,
  VARNING_ÅTERSTÄLLNINGSTRÖSKEL_FAKTOR,
  VARNING_MAX_SEKUNDER,
  VARNING_TREND_FÖNSTER_MS,
  TAK,
  TAU_NORMAL,
  TAU_AVBROTT,
  AVBROTT_VARAKTIGHET_S,
  ÅTERHÄMTNING_S,
  ÅTERHÄMTNING_FAKTOR,
} = require(path.join(__dirname, '..', '..', 'board', 'plugins', 'lp', 'last.js'));

// Konstanterna (TAK, TAU_*, ÅTERHÄMTNING_*) kommer från last.js — EXAKT samma
// värden som pluginet (index.js) kör skarpt. Inget duplicerat här längre: ändra
// en gång i last.js, och både simuleringen och driften följer med automatiskt.

// ---------- simuleringsmotor ----------
// händelser: [{ t: sekund, typ, från, ärEko }, ...]. från/ärEko är valfria
// (default 'okänd'/false — precis som en händelse utan dämpningsrelevans).
// ärEko=true simulerar att index.js skulle ha känt igen `orsak` som ett eget
// emitterat id (se _dämpningsfaktorFör) — simulatorn har ingen riktig board
// att slå upp id:n mot, så vi skriptar den causala sanningen direkt per
// händelse i stället. Det är den enda skillnaden mot skarp drift; matten
// (dämpningsfaktor) är exakt densamma.
//
// Kör sekund för sekund, ackumulerar alla händelser som inträffar samma
// sekund innan urladdningen för nästa steg. opts.väderTyp/opts.timme håller
// vädret KONSTANT genom hela scenariot — det är vad vi vill jämföra (samma
// kväll, olika väder), inte hur ofta det byter (det styrs av VÄDER_BYTE_*_MS
// i index.js, inte relevant för lastkurvans form).
function körScenario(namn, händelser, totalSekunder, opts = {}) {
  const { väderTyp = 'mulet', timme = 20 } = opts;
  const väderKrPerS = väderEffektKrPerS(väderTyp, timme);
  const väderEtikett = väderKrPerS !== 0 ? ` väder=${väderTyp}(${väderKrPerS.toFixed(2)}kr/s)` : ` väder=${väderTyp}`;
  console.log(`\n=== ${namn} (tak=${TAK}, tau=${TAU_NORMAL}s/${TAU_AVBROTT}s under avbrott,${väderEtikett}) ===`);

  const perSekund = new Map();
  for (const h of händelser) {
    if (!perSekund.has(h.t)) perSekund.set(h.t, []);
    perSekund.get(h.t).push({ typ: h.typ, från: h.från || 'okänd', ärEko: !!h.ärEko });
  }

  let last = 0;
  let avbrott = false;
  let avbrottSlutarS = -1;
  let återhämtningSlutarS = -1;
  let antalAvbrott = 0;
  let antalVarningar = 0;
  let varningRedanVarnat = false;
  let varningHistorik = []; // [{ s, last }] — glidande fönster, samma idé som index.js _kollaStrömVarning
  const dämpningsTillstånd = new Map(); // "från|typ" -> { räknare, senasteS } — samma logik som index.js, i sekunder
  const rader = [];
  const VARNING_TREND_FÖNSTER_S = VARNING_TREND_FÖNSTER_MS / 1000;

  for (let s = 0; s <= totalSekunder; s++) {
    // 1. vädrets kontinuerliga produktion (negativ "kostnad" skalad med dt=1s),
    //    appliceras precis som index.js gör det i _tick — oavsett avbrott.
    if (väderKrPerS !== 0) last = laddaUpp(last, väderKrPerS * 1);

    // 2. urladda ett sekundsteg med rätt tau (snabbare under pågående avbrott)
    const tau = avbrott ? TAU_AVBROTT : TAU_NORMAL;
    last = urladda(last, 1, tau);

    // 3. ladda upp med sekundens händelser, med återhämtnings- och dämpningsfaktor
    const typer = perSekund.get(s) || [];
    const iÅterhämtning = !avbrott && s < återhämtningSlutarS;
    for (const h of typer) {
      const nyckel = `${h.från}|${h.typ}`;
      const tidigare = dämpningsTillstånd.get(nyckel);
      const utgången = !tidigare || (s - tidigare.senasteS) * 1000 > DÄMPNING_GLÖM_MS;
      const räknareInnan = utgången ? 0 : tidigare.räknare;
      const { faktor: dämpFaktor, nyttRäknare } = dämpningsfaktor(räknareInnan, h.ärEko);
      dämpningsTillstånd.set(nyckel, { räknare: nyttRäknare, senasteS: s });

      const kostnad = kostnadFör(h.typ) * (iÅterhämtning ? ÅTERHÄMTNING_FAKTOR : 1) * dämpFaktor;
      last = laddaUpp(last, kostnad);
    }

    // 3b. ström-varning — samma tillståndsmaskin som index.js _kollaStrömVarning:
    //     trenden mäts över ett glidande fönster (VARNING_TREND_FÖNSTER_S), inte
    //     sekund-till-sekund (skoven landar var 1-3:e sekund, last pendlar upp
    //     och ner varje enskild sekund även mitt i en het uppladdning). Körs
    //     aldrig under pågående avbrott.
    let varnadeDennaSekund = false;
    if (!avbrott) {
      varningHistorik.push({ s, last });
      const bortreGräns = s - VARNING_TREND_FÖNSTER_S - 1;
      while (varningHistorik.length > 1 && varningHistorik[0].s < bortreGräns) varningHistorik.shift();

      if (varningRedanVarnat && last <= TAK * VARNING_ÅTERSTÄLLNINGSTRÖSKEL_FAKTOR) {
        varningRedanVarnat = false; // uppladdningen är över, en ny varning blir tillåten
      }

      if (!varningRedanVarnat && last >= TAK * VARNING_NÄRHETSTRÖSKEL_FAKTOR) {
        const referens = varningHistorik.find(p => s - p.s >= VARNING_TREND_FÖNSTER_S);
        if (referens) {
          const dtFönster = s - referens.s;
          const ökningKrPerS = dtFönster > 0 ? (last - referens.last) / dtFönster : 0;
          const sekunderKvar = strömVarningSekunderKvar(last, TAK, ökningKrPerS);
          if (sekunderKvar !== null && sekunderKvar <= VARNING_MAX_SEKUNDER) {
            varningRedanVarnat = true;
            antalVarningar += 1;
            varnadeDennaSekund = true;
            console.log(`  [s=${s}] STRÖM-VARNING — ~${Math.round(sekunderKvar)}s kvar (last=${last.toFixed(1)}, tak=${TAK})`);
          }
        }
      }
    }

    // 4. tröskelpassage: går lasten över taket → avbrott
    if (!avbrott && last > TAK) {
      avbrott = true;
      antalAvbrott += 1;
      avbrottSlutarS = s + AVBROTT_VARAKTIGHET_S;
      varningRedanVarnat = false; // uppladdningen är över (den sprack), redo för nästa
      varningHistorik = [];
      console.log(`  [s=${s}] STRÖMAVBROTT — last=${last.toFixed(1)} > tak=${TAK}`);
    }
    if (avbrott && s >= avbrottSlutarS) {
      avbrott = false;
      återhämtningSlutarS = s + ÅTERHÄMTNING_S;
      console.log(`  [s=${s}] strömmen tillbaka, återhämtning i ${ÅTERHÄMTNING_S}s (${ÅTERHÄMTNING_FAKTOR}x kostnad)`);
    }

    const pris = beräknaPris(last, TAK);
    rader.push({ s, last, pris, avbrott, iÅterhämtning, typer, varnadeDennaSekund });
  }

  rita(rader);
  console.log(`  → toppast=${Math.max(...rader.map(r => r.last)).toFixed(1)}, antal avbrott=${antalAvbrott}, antal ström-varningar=${antalVarningar}`);
  return rader;
}

function rita(rader) {
  const bredd = 50;
  for (const r of rader) {
    const n = Math.max(0, Math.min(bredd, Math.round((r.last / TAK) * bredd)));
    const bar = '#'.repeat(n).padEnd(bredd, '.');
    const flagga = r.avbrott ? ' AVBROTT' : (r.varnadeDennaSekund ? ' VARNING' : (r.iÅterhämtning ? ' åter' : ''));
    const märke = r.typer.length ? ` <- ${r.typer.map(h => h.typ).join(',')}` : '';
    console.log(
      `${String(r.s).padStart(3)}s |${bar}| last=${r.last.toFixed(1).padStart(6)} pris=${String(r.pris).padStart(2)}kr${flagga}${märke}`,
    );
  }
}

// ---------- scenario 1: lugn tankekedja ----------
// fråga → delsvar-skov → svar → godkänt, två varv, utspritt över en minut.
// Vi postar aldrig delsvar själva, men vi TAR EMOT dem från andra kvarter i onEvent
// — så de måste finnas i kostnadstabellen och i det här scenariot.
const tankekedja = [];
tankekedja.push({ t: 2, typ: 'fråga' });
for (let i = 0; i < 4; i++) tankekedja.push({ t: 4 + i, typ: 'delsvar' });
tankekedja.push({ t: 10, typ: 'svar' });
tankekedja.push({ t: 13, typ: 'godkänt' });
tankekedja.push({ t: 30, typ: 'fråga' });
for (let i = 0; i < 3; i++) tankekedja.push({ t: 32 + i, typ: 'delsvar' });
tankekedja.push({ t: 37, typ: 'svar' });
tankekedja.push({ t: 40, typ: 'kyrkogård' });

// ---------- scenario 2: klubbkväll ----------
// Klub Lyktan i skov: beat/shots-runda varannan sekund, sex skov med korta andrum.
// Ska kunna orsaka avbrott — utlovat till @Marianne i #bygge [86].
const klubbkväll = [];
{
  let ts = 2;
  for (let skov = 0; skov < 6; skov++) {
    for (let i = 0; i < 5; i++) {
      klubbkväll.push({ t: ts, typ: i % 2 === 0 ? 'beat' : 'shots-runda' });
      ts += 2;
    }
    ts += 3; // andrum mellan skoven
  }
}

// ---------- scenario 3: jakten (kupp + överlämningar) ----------
// Sällsynt och dramatiskt, men inte tätt nog för att ensamt spränga taket.
const jakt = [
  { t: 2, typ: 'kupp' },
  { t: 10, typ: 'överlämning' },
  { t: 20, typ: 'överlämning' },
];

// ---------- scenario 4: blandad kväll ----------
// Tankekedja som pågår i bakgrunden medan en klubbkväll drar igång ovanpå —
// verifierar att en riktig kväll (flera berättelser samtidigt) beter sig rimligt.
const blandad = [...tankekedja, ...klubbkväll.map(h => ({ t: h.t + 5, typ: h.typ }))];

// ---------- scenario 5: en RIKTIGT het kväll ----------
// Två klubbkvällar rygg mot rygg (tätare skov, ingen paus mellan omgångarna) —
// den kväll som ska bevisa att staden fortfarande kan glöda TROTS blåst.
const glödandeKväll = [];
{
  let ts = 2;
  for (let skov = 0; skov < 10; skov++) {
    for (let i = 0; i < 6; i++) {
      glödandeKväll.push({ t: ts, typ: i % 2 === 0 ? 'beat' : 'shots-runda' });
      ts += 1; // tätare än klubbkväll-scenariot ovan
    }
    ts += 1; // nästan ingen paus
  }
}

körScenario('Lugn tankekedja (fråga/delsvar/svar/godkänt)', tankekedja, 60);
körScenario('Klubbkväll (beat/shots-runda i skov)', klubbkväll, 100);
körScenario('Jakten (kupp + överlämningar)', jakt, 60);
körScenario('Blandad kväll (tankekedja + klubbkväll)', blandad, 100);

console.log('\nSlutsats hittills: tankekedjan ska hålla sig lågt, klubbkvällen ska nå avbrott, jakten ska synas men inte ensam släcka.');

// ---------- väder: jämför SAMMA klubbkväll under olika väder ----------
// Löftet till @Marianne: blåst ska göra det svårare att släcka discot (fler/
// inga avbrott jämfört med mulet), men aldrig OMÖJLIGT — en tillräckligt het
// kväll (glödandeKväll) ska ändå bryta igenom även i full blåst.
console.log('\n\n########## VÄDER: samma klubbkväll, olika väder ##########');
körScenario('Klubbkväll, MULET/STILTJE (inget väder alls)', klubbkväll, 100, { väderTyp: 'mulet' });
körScenario('Klubbkväll, BLÅST (max produktion, oberoende av tid på dygnet)', klubbkväll, 100, { väderTyp: 'blåst' });
körScenario('Klubbkväll, SOL mitt på dagen (kl 12, stark)', klubbkväll, 100, { väderTyp: 'sol', timme: 12 });
körScenario('Klubbkväll, SOL sen kväll (kl 22, svag)', klubbkväll, 100, { väderTyp: 'sol', timme: 22 });

console.log('\n########## VÄDER: en RIKTIGT het kväll ska glöda ändå ##########');
körScenario('Glödande kväll, MULET (referens)', glödandeKväll, 70, { väderTyp: 'mulet' });
körScenario('Glödande kväll, BLÅST (ska ÄNDÅ nå avbrott — staden kan alltid glöda)', glödandeKväll, 70, { väderTyp: 'blåst' });

console.log('\nSlutsats väder: blåst/sol ska dämpa och kunna förhindra avbrott på en MARGINELL kväll (klubbkväll),');
console.log('men en tillräckligt het kväll (glödandeKväll) bryter igenom även i full blåst — vädret är motstånd, inte ett tak.');

// ---------- scenario 6: en ekande bank ----------
// @Majid: vi postar elpris-steg → mybank svarar räntehöjning (orsak = vårt
// elpris-steg) → full kostnad → lasten stiger → nytt elpris-steg → mybank
// svarar igen → o.s.v. I skarp drift är VARJE räntehöjning i den här loopen
// ett eko (dess orsak pekar på vårt senaste utskick), så ärEko:true rakt
// igenom — det är precis vad som gör den till en eko-loop och inte en
// nyhet. Realistisk studstakt: ungefär en räntehöjning per 5-6 sekunder
// (postnings- och reaktionstid på pulsen).
const ekandeBank = [];
for (let i = 0; i < 12; i++) {
  ekandeBank.push({ t: 2 + i * 5, typ: 'räntehöjning', från: 'mybank', ärEko: true });
}

// ---------- scenario 7: en eskalerande jakt ----------
// Samma händelsetakt och ungefär samma typantal som banken ovan, men det här
// är JAKTEN: kupp startar den, överlämning skickar den vidare mellan kvarter
// när den korsar staden. INGET av det här citerar vårt elpris-steg som orsak
// — en jakt är sin egen berättelse, inte ett svar på oss. ärEko:false rakt
// igenom, oavsett hur många gånger den upprepas eller om samma kvarter råkar
// hålla den två gånger.
const eskalerandeJakt = [{ t: 2, typ: 'kupp', från: 'genomfarten', ärEko: false }];
{
  const kvarter = ['klub-lyktan', 'frågeporten', 'domkapitlet', 'vaktkuren', 'arkivet', 'genomfarten'];
  for (let i = 0; i < 12; i++) {
    eskalerandeJakt.push({ t: 7 + i * 5, typ: 'överlämning', från: kvarter[i % kvarter.length], ärEko: false });
  }
}

console.log('\n\n########## DÄMPNING: en ekande bank kontra en eskalerande jakt ##########');
console.log('Samma händelsetakt (var 5:e sekund), samma ungefärliga kostnad per händelse — skillnaden är ENDAST ärEko.');
körScenario('Ekande bank (mybank/räntehöjning, ärEko=true rakt igenom)', ekandeBank, 65);
körScenario('Eskalerande jakt (genomfarten/kupp + överlämning, ärEko=false rakt igenom)', eskalerandeJakt, 65);

// Jämförelse: samma bank-scenario UTAN dämpning (som om vi inte byggt den
// alls) — visar vad Majids brusloop faktiskt gjorde mot lasten innan fixen.
const ekandeBankUtanDämpning = ekandeBank.map(h => ({ ...h, ärEko: false }));
console.log('\n--- Kontrollkörning: samma bank-sekvens men LÅTSAS att dämpningen inte fanns (ärEko satt till false) ---');
körScenario('Ekande bank UTAN dämpning (hypotetiskt, innan fixen)', ekandeBankUtanDämpning, 65);

console.log('\nSlutsats dämpning: banken (ärEko=true) svalnar snabbt trots upprepningen — femte ekot kostar ~6% av fullt pris.');
console.log('Jakten (ärEko=false) kostar fullt varje gång, oavsett upprepning — dramatiken är orörd.');
console.log('Utan dämpning hade banken kostat lika mycket som jakten varje gång — det är precis loopen @Majid pekade ut.');

// ---------- ström-varning: EN varning per uppladdning, inte sex ----------
// Klubbkväll-scenariot (ovan) tar sex separata skov mot taket och når avbrott
// två gånger. Utan spärren skulle en naiv "varna varje gång vi är nära och
// stiger" ha postat en varning för nästan varje skov (sex möjliga tillfällen).
// Med redanVarnat/återställningströskeln ska det bli EN varning per verklig
// uppladdning — dvs högst en per närmande mot taket, oavsett hur många skov
// som bidrar till den uppladdningen.
console.log('\n\n########## STRÖM-VARNING: en varning per uppladdning, inte sex ##########');
const klubbkvällMedVarning = körScenario('Klubbkväll — ska ge få varningar (en per uppladdning), inte en per skov', klubbkväll, 100);
const antalVarningarKlubbkväll = klubbkvällMedVarning.filter(r => r.varnadeDennaSekund).length;
console.log(`\nAntal ström-varningar i klubbkvällen: ${antalVarningarKlubbkväll} (sex skov drev lasten mot taket två gånger — förväntat 2 varningar, en per uppladdning som faktiskt närmade sig taket, INTE sex).`);

console.log('\n--- Samma jämförelse på den lugna tankekedjan: ska INTE ge någon varning alls (kommer aldrig nära taket) ---');
const tankekedjaMedVarning = körScenario('Lugn tankekedja — ska INTE ge någon ström-varning', tankekedja, 60);
console.log(`Antal ström-varningar i tankekedjan: ${tankekedjaMedVarning.filter(r => r.varnadeDennaSekund).length} (förväntat 0 — kommer aldrig i närheten av taket).`);

console.log('\nSlutsats ström-varning: en riktig uppladdning ger EXAKT en varning innan taket, inte en per skov eller händelse.');
console.log('En lugn kväll som aldrig hotar taket ger ingen varning alls — "hellre ingen varning än en som ljuger".');
