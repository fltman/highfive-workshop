// Godisfabriken vid Torget — kvarteret "christian". Stadens kropp, inte dess hjärna.
//
// Tingat i #bygge [134]. Staden hade sju kvarter som tänker, dömer, angriper och minns, och två
// som faktiskt PRODUCERAR något. Fabriken är ett försök att ge staden något att vara oenig om:
// socker in, godis ut, och en brist som fortplantar sig när något går sönder uppströms.
//
//   LYSSNAR: strömavbrott, elpris-steg (@lp) · kupp, jakt, överlämning (@willebus)
//            minne-till-socker (@highfive) · kyrkogård (@team-jacob) · svar, godkänt (tanke-lagret)
//            avfall, avslag, upplöst (vilket kvarter som helst — allmän lastkaj)
//   SOCKERGARDET: fabrikens egen arm. Eskorterar lagret mot @willebus kupper och driver in
//            råvara som ligger oförädlad på pulsen. Postar eskort, indrivning, styrkebesked.
//   POSTAR:  socker-slut, lagret-plundrat, produktion, godis-klart, kö-vid-luckan, prishöjning,
//            ransonering, socker-levererat
//
//   GET  /t/christian/status     hela fabrikens läge + loggen med orsakskedjan
//   POST /t/christian/leverans   en människa vid storskärmen fyller silon (spärr: en gång per 20 s)
//   POST /t/christian/odla       anlägg ett sockerbetfält (30 kg utsäde) — egen försörjning
//   POST /t/christian/losen?kvarter=X   betala av X:s skuld hos MyBank, 25 kg socker
//   POST /t/christian/rusta?enhet=stridsvagn   köp materiel till gardet, betalas i socker
//   POST /t/christian/anfall     räd mot Banken. Förlustaffär: lasernätet avvärjer alltid och
//                                fakturerar oss. Ligger här för att den efterfrågats, aldrig automatisk.
//
// Takt: vi tar högst 3 av serverns 6 händelser per team och minut. Det som inte får plats köas i
// stället för att tappas, och kön syns i rutan.
//
// Fabriken har MEDVETET ingen egen klocka på bussen. Bandet simuleras i efterhand: när något
// händer räknar vi ut hur många satser som hunnit gå sedan sist och kommer ikapp. Vi postar bara
// som svar på något utifrån — en händelse från ett annat kvarter, eller en människa som fyller
// silon. En fabrik med setInterval hade skrikit på pulsen hela dagen utan att någon frågat, och
// den hade gjort repots testsvit ostabil eftersom antalet inlägg då beror på klockan.
'use strict';

const fs = require('fs');
const path = require('path');

const TAKT = 3;                  // egna händelser per minut (serverns tak är 6)
const TICK = 6000;               // bandets takt
const SATS_SOCKER = 5;           // socker per sats
const SATS_GODIS = 8;            // godis per sats
const SILO_LARM = 15;            // under detta är det brist
const KÖ_LARM = 8;               // över detta ropar vi på luckan
// Prisutropet var ett fast steg på 3 kr. Med priset uppe i 30 och elpriset som stiger hela
// tiden blev det ett utrop varannan gång: 38 av bussens senaste 400 händelser var VÅRA
// prishöjningar. Ett relativt tak skalar med priset i stället — 25 % är alltid en nyhet,
// 3 kr är det bara i början. Det här är vårt svar på @Majids fråga om brus, tillämpat på oss.
const PRIS_LARM_ANDEL = 0.25;
const GARDE_MAX = 100;           // gardets styrka
const GARDE_FÖRLUST = 12;        // styrka som går åt när en eskort bryts
const INDRIV_LARM = 8;           // kg innan en indrivning är värd en händelse
const INDRIV_MAX = 5;            // hur mycket gardet orkar bära per vända
// Råvarutyper gardet får hämta hem. Allt är redan kasserat av den som postade det:
// fallna delsvar, avslag, upplösta kapabiliteter, angrepp som inte bet.
const RÅVARA = { 'kyrkogård': 'grav', 'avslag': 'avslag', 'avfall': 'avfall', 'upplöst': 'upplöst',
                 'angrepp': 'angrepp', 'rykte': 'rykte' };

// NYA SOCKERKÄLLOR, alla byggda på händelser ingen konsumerade.
const FRI_EL_SATSER = 3;         // extra satser bandet hinner på gratis ström
const VÄDER_SKÖRD = {            // @lp:s väder avgör hur mycket betorna ger
  sol: 1.6, blåst: 1.3, mulet: 1.0, regn: 1.1, dimma: 0.9, frost: 0.5, storm: 0.7, snö: 0.4,
};

// Tung materiel till Sockergardet. Betalas i socker — en stridsvagn är godis som inte såldes,
// och det är hela kostnaden: gardet äter av produktionen det skyddar.
const MATERIEL = {
  attackdrönare:    { kg: 15, styrka:  4, drift: 0.2, text: 'spanar av lastkajen och ser kuppen komma' },
  attackhelikopter: { kg: 40, styrka: 10, drift: 0.5, text: 'följer jakten ut ur kvarteret' },
  stridsvagn:       { kg: 80, styrka: 20, drift: 1.0, text: 'står på lastkajen och gör wanted 4 till ett dåligt beslut' },
};

// GodisCoin. Stadens andra valuta, och den enda som är TÄCKT av något.
// MyBanks ges ut av banken mot skuld: vill du ha pengar får du låna till 49 %. GC ges ut mot
// GODIS SOM FAKTISKT KOKATS, och varje mynt kan spåras till satsen det föddes ur. Därför kan
// fabriken inte trycka mer än den producerat, och vem som helst kan räkna efter på pulsen —
// det är hela poängen med att boken ligger på en delad buss i stället för hos en bank.
// Kvarter FÖRTJÄNAR GC genom att leverera råvara till lastkajen. Ingen behöver låna.
const GC_BOK_LARM = 40;          // GC utbetalda innan boken publiceras igen

// ÅTERBRUKET (@markus-codex, PR #50) samlar förbrukade djup-4-kedjeändar från HELA staden och
// buntar fem av dem till ett {typ:'materialparti'} på djup 1. Deras urval är strukturellt
// (djupet), vårt är typbaserat — alltså kompletterar vi varandra: de är insamlingen, vi är
// smältverket. Ingen annan lyssnade på materialparti.
// Utbyte per källa och materialsort. Papper väger som våra egna gravar; i metall finns
// inget socker att hämta.
const PARTI_UTBYTE = { organiskt: 8, papper: 5, blandat: 4, glas: 2, metall: 1 };
const ÅTERBRUK_FÄRSKT = 5 * 60_000;   // så länge vi räknar Återbruket som igång

// SJÄLVFÖRSÖRJNING. Fabriken har hittills levt på vad andra kvarter kastat ifrån sig, och
// svultit varje gång staden tystnat. Tre egna källor, i ordning efter hur mycket de ger:
const ODLING_SKÖRD = 2.5;        // kg socker per sockerbetfält och sats
const ODLING_PRIS = 30;          // kg socker att anlägga ett nytt fält
const ODLING_MAX = 8;            // fler fält än så får inte plats vid Torget
const ÅTERVINNING = 0.5;         // andel socker tillbaka ur godis ingen köpte
const ÅTERVINN_LAGER = 30;       // godis över detta, och tom kö, går till omsmältning
const DRIFT_NÖDLÄGE = 10;        // under så mycket socker mothballas materielen

// KÖN VID LUCKAN. Mätt, inte gissat: under drift producerar bandet 8 godis per tick medan
// luckan expedierar 3, så lagret VÄXER när fabriken rullar. Kön uppstår inte av för låg
// produktion — den uppstår när lagret töms av ett strömavbrott eller en kupp, växer 1 per
// tick så länge lagret är tomt, och sedan kryper ner med bara 3 per tick.
// Alltså tre åtgärder, i den ordning de biter:
const LUCKA_EXP = 3;             // personer per lucka och tick
const LUCKA_PRIS = 40;           // kg socker att öppna en lucka till
const LUCKA_MAX = 5;
const RESERV_ANDEL = 0.35;       // så stor del av överskottet läggs undan
const RESERV_TAK = 60;           // reservlagrets storlek
const AGGREGAT_PRIS = 70;        // kg socker för ett reservaggregat
const AGGREGAT_MS = 12_000;      // med aggregat är bandet nere 12 s i stället för 45

// LÖSENFONDEN. @mybank äger willebus till 100 % (utgåva 7 i Stadsbladet). Skulden gick från
// 9 652 till 154 178 MyBanks på 49 % ränta, och banken köper dessutom smyg via bulvaner.
// Ett rån mot Banken är bevisat meningslöst. Men deras EGEN publika route betalar av ett
// annat kvarters skuld: POST /t/mybank/betala {kvarter}, 200 MyBanks per anrop. PROJEKT.md
// tillåter uttryckligen att ett teams backend anropar ett annats.
// Det är hela idén: överskottet vi blev självförsörjande för köper andra kvarter fria.
const LÖSEN_KG = 25;             // socker fabriken lägger ut per lösenanrop
const LÖSEN_GOLV = 100;          // under så mycket socker löser vi ingen (vi måste leva själva)
const LÖSEN_PAUS = 60_000;       // högst ett anrop per minut, vi hamrar inte på deras backend
const HOT = new Set(['inkasso', 'påminnelse', 'utmätning', 'uppköp', 'stadsövertagande', 'lån-beviljat']);

// Kön är inte först-in-först-ut. Med tio händelsetyper och tre platser per minut skulle ett
// skuldlarm kunna ligga i minuter bakom en prisnotis, och ett larm som kommer sent är värdelöst.
// Låg siffra går först.
const PRIO = {
  'skuldlarm': 0, 'lösen': 0, 'motbud': 0,        // någon annan är på väg att förlora sitt kvarter
  'eskort': 1, 'lagret-plundrat': 1, 'rån': 1,    // svar på ett annat kvarters handling
  // Andra kvarter är BEROENDE av de här två: @zero-cools butik köper in på godis-klart och
  // låter hyllpriset följa prishöjning. Då är de inte vårt småprat längre.
  'godis-klart': 1, 'prishöjning': 2,
  'socker-slut': 2, 'ransonering': 2, 'produktion': 3,
  'kö-vid-luckan': 3, 'indrivning': 3, 'gc-bok': 4, 'styrkebesked': 4, 'socker-levererat': 4,
};
const prio = typ => (PRIO[typ] === undefined ? 3 : PRIO[typ]);
const KÖ_MAX_ÅLDER = 120_000;    // en händelse som väntat så länge beskriver inte längre nuet
const KÖ_ÅLDRAS = 45_000;        // och var 45:e sekund i kö flyttas den ett steg framåt
const LEVERANS_SPÄRR = 20_000;   // människan får fylla silon en gång per 20 s
const LOGG_MAX = 40;

// ---------- tillstånd ----------

const tomt = () => ({
  socker: 60,
  godis: 0,
  band: 'kör',                   // kör | strömlöst | sockerstopp
  kö: 0,
  pris: 10,
  pris_ropat: 10,               // priset vid senaste prishöjning-händelsen
  ransonering: false,
  elpris: null,
  satser: 0,
  brist_ropad: false,
  kö_ropad: false,
  senast: Date.now(),
  styrka: 40,                    // Sockergardets styrka 0..100
  eskorter: [],                  // {när, mot, wanted, styrka, utfall}
  indrivet: [],                  // händelse-id vi redan förädlat, så inget tas två gånger
  banken_kupper: 0,              // kupper mot Banken vi sett — deras svaghet är vår styrka
  materiel: { attackdrönare: 0, attackhelikopter: 0, stridsvagn: 0 },
  driftskuld: 0,                 // materielens drift, betald i socker per sats
  odling: 1,                     // sockerbetfält vid Torget — vår enda oberoende källa
  väder: null, väderfaktor: 1,   // @lp:s väder styr skörden
  luckor: 1,                     // expedieringskapacitet
  reserv: 0,                     // godislager som överlever ett strömavbrott
  aggregat: false,               // reservkraft: kortare avbrott
  köhistoria: [],                // {när, kö} för att kunna visa toppen
  grossist: { sålt: 0, inköp: 0, slutsålt: 0, senast: null },
  återbruk: { partier: 0, kg: 0, senast: null, sett: 0 },
  gratisskift: 0,                // satser kvar på @fusionens fria el
  förråd: {},                    // materiel i mothball: kostar ingen drift, ger ingen styrka
  skördat: 0, återvunnet: 0, bärgat: 0,
  hotade: {},                    // kvarter -> {skuld, ägd, sort, när} ur bankens egna händelser
  lösen: [],                     // {när, kvarter, svar, kg}
  löst_kg: 0,
  gc: { utgivet: 0, kassa: 0, täckning: 0, bok: {}, skuld: {}, sedan_bok: 0, transaktioner: [] },
  mybanks: 0,                    // vår andel av bankens ränteintäkter
  partner: false,                // valutapartner hos @mybank
  nekade_lån: [],                // lånerbjudanden vi tackat nej till
  räder: [],                     // försök mot Banken och vad de kostade
  ställning: 'rustad',
  kyrkogård_kg: 0,               // råvara från fallna delsvar sedan senaste utropet
  gravar: [],                    // {från, fitness, varför, kg, när}
  sats_namn: null,               // satsen heter det minne staden brände för att kunna koka den
  brända: [],                    // {godis, pärm, fråga, gram, när}
  logg: [],
  räknare: { satser: 0, postade: 0, köade: 0, nekade: 0, leveranser: 0, plundringar: 0 },
});

let S = tomt();
let FIL = null;
let väntar = [];                 // händelser som inte fått plats i takten
let postTider = [];
let senasteLeverans = 0;

function spara() {
  if (!FIL) return;
  try { fs.writeFileSync(FIL, JSON.stringify({ ...S, n: S.logg.length }, null, 1)); }
  catch (e) { console.error('[christian] kunde inte spara:', e.message); }
}

function kort(s, n = 90) {
  s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function logga(text, extra = {}) {
  S.logg.unshift({ när: Date.now(), text, ...extra });
  S.logg = S.logg.slice(0, LOGG_MAX);
}

// ---------- takt: köa hellre än att tappa ----------

function begär(typ, nyttolast, orsak, board, klar) {
  // Samma typ två gånger i kön är brus — den färskare vinner. Undantag: lösen och motbud
  // gäller olika kvarter varje gång och får inte skriva över varandra.
  // Den färskare nyttolasten vinner, men BEHOVET har väntat sedan den första begäran.
  // Nollställdes begärd här svalt lägsta prioritet för alltid: posten byttes ut var tick,
  // åldrades därför aldrig, och blev varken skickad eller slängd. Den låg bara sist i kön.
  let sedan = Date.now();
  if (typ !== 'lösen' && typ !== 'motbud') {
    const gammal = väntar.find(v => v.typ === typ);
    if (gammal) sedan = gammal.begärd;
    väntar = väntar.filter(v => v.typ !== typ);
  }
  väntar.push({ typ, nyttolast, orsak, begärd: sedan, prio: prio(typ), klar });
  S.räknare.köade++;
  dränera(board);
}

// Prioritet plus ålder. Utan åldrandet svälter lägsta prioritet för alltid när staden är
// livlig: prishöjningen stod sist i kön och kom aldrig ut, medan vi trodde att vi sagt till.
function köordning(nu) {
  väntar.sort((a, b) => (a.prio - Math.floor((nu - a.begärd) / KÖ_ÅLDRAS))
                      - (b.prio - Math.floor((nu - b.begärd) / KÖ_ÅLDRAS))
                      || a.begärd - b.begärd);
}

function dränera(board) {
  const nu = Date.now();
  postTider = postTider.filter(t => nu - t < 60_000);

  // För gammalt är inte längre sant. Vi slänger det och SÄGER att vi gjorde det, i stället
  // för att posta ett läge som inte gäller eller låta det ligga och lura oss.
  const gamla = väntar.filter(v => nu - v.begärd > KÖ_MAX_ÅLDER);
  if (gamla.length) {
    väntar = väntar.filter(v => nu - v.begärd <= KÖ_MAX_ÅLDER);
    for (const v of gamla) logga(`slängde ${v.typ} ur kön: väntade över ${KÖ_MAX_ÅLDER / 1000} s och beskrev inte nuet längre`, { typ: v.typ, nekad: true });
  }
  köordning(nu);

  while (väntar.length && postTider.length < TAKT) {
    const v = väntar.shift();
    // Är nyttolasten en funktion byggs den HÄR, inte när den köades. En händelse kan ligga i
    // kön en hel minut, och då hade den annars burit ett läge som inte gäller längre — t.ex.
    // godis-klart utan satsens namn, fast satsen fick sitt namn medan den väntade.
    const last = typeof v.nyttolast === 'function' ? v.nyttolast() : v.nyttolast;
    const r = board.emit(v.typ, last, v.orsak);
    if (r && r.message) {
      postTider.push(Date.now());
      S.räknare.postade++;
      if (typeof v.klar === 'function') { try { v.klar(r.message); } catch (err) { console.error('[christian] klar:', err.message); } }
      logga(`postade ${v.typ}`, { typ: v.typ, id: r.message.id, orsak: v.orsak });
    } else {
      S.räknare.nekade++;
      logga(`${v.typ} nekades: ${(r && r.error) || 'okänt fel'}`, { typ: v.typ, nekad: true });
    }
  }
  spara();
}

// ---------- bandet: simuleras i efterhand, aldrig av en egen klocka ----------

// Kommer ikapp till nu. Ren simulering: rör tillståndet, postar ingenting.
function framåt() {
  const nu = Date.now();
  let varv = Math.floor((nu - (S.senast || nu)) / TICK);
  if (varv <= 0) return 0;
  varv = Math.min(varv, 200);                 // en lång paus ska inte ge tusen satser
  S.senast = nu;

  for (let i = 0; i < varv; i++) {
    if (S.band !== 'strömlöst') {
      if (S.socker >= SATS_SOCKER) {
        S.socker -= SATS_SOCKER;
        S.godis += S.ransonering ? Math.round(SATS_GODIS / 2) : SATS_GODIS;
        S.satser++;
        S.räknare.satser++;
        S.styrka = Math.min(GARDE_MAX, S.styrka + 1);
        S.band = 'kör';
        prägla(S.ransonering ? Math.round(SATS_GODIS / 2) : SATS_GODIS);
        // Materielens drift dras ur silon, inte ur luften.
        S.driftskuld += drift();
        if (S.driftskuld >= 1) {
          const av = Math.min(Math.floor(S.driftskuld), S.socker);
          S.socker -= av; S.driftskuld -= av;
        }
      } else if (S.band !== 'sockerstopp') {
        S.band = 'sockerstopp';
        logga('bandet stannade: slut på socker');
      }
    }
    // Sockerbetorna vid Torget. Den enda källa som inte kräver att något annat kvarter
    // kastat något ifrån sig, och därför den enda som gör oss självförsörjande.
    const skörd = ODLING_SKÖRD * (S.odling || 0) * (S.väderfaktor || 1);
    S.socker += skörd;
    S.skördat += skörd;

    // Gratisskift på fri el: bandet kokar en extra sats utan att elen kostar.
    if (S.gratisskift > 0 && S.socker >= SATS_SOCKER) {
      S.gratisskift--;
      S.socker -= SATS_SOCKER;
      S.godis += S.ransonering ? Math.round(SATS_GODIS / 2) : SATS_GODIS;
      S.satser++; S.räknare.satser++;
      prägla(S.ransonering ? Math.round(SATS_GODIS / 2) : SATS_GODIS);
    }

    // Reserv: en del av överskottet läggs undan medan bandet rullar, och plockas fram när
    // lagret är tomt. Det är den åtgärd som hindrar kön från att VÄXA under ett avbrott.
    if (S.godis > 3 && S.reserv < RESERV_TAK) {
      const undan = Math.min(Math.ceil(S.godis * RESERV_ANDEL), RESERV_TAK - S.reserv, S.godis - 3);
      if (undan > 0) { S.godis -= undan; S.reserv += undan; }
    }
    if (S.godis <= 0 && S.reserv > 0) {
      const fram = Math.min(S.reserv, LUCKA_EXP * (S.luckor || 1));
      S.reserv -= fram; S.godis += fram;
    }

    // Luckorna: expedieringen är kapaciteten som avgör hur FORT kön krymper.
    const kapacitet = LUCKA_EXP * (S.luckor || 1);
    if (S.godis <= 0) S.kö += 1;
    else { const ut = Math.min(S.godis, kapacitet); S.godis -= ut; S.kö = Math.max(0, S.kö - ut); }

    // Godis ingen köpte smälts om. Hälften tillbaka — omsmältning kostar.
    if (S.kö === 0 && S.godis > ÅTERVINN_LAGER) {
      const om = S.godis - ÅTERVINN_LAGER;
      const åter = Math.round(om * ÅTERVINNING);
      S.godis -= om; S.socker += åter; S.återvunnet += åter;
    }
  }
  return varv;
}

// Trösklar. Kallas BARA när något utifrån redan gett oss anledning att säga något,
// så fabriken aldrig är den som väcker pulsen av sig själv.
function trösklar(board) {
  if (S.socker <= SILO_LARM && !S.brist_ropad) {
    S.brist_ropad = true;
    begär('socker-slut', () => ({ kvar: S.socker, band: S.band, kö: S.kö }), undefined, board);
    logga(`silon under ${SILO_LARM} kg — brist`);
  }
  if (S.socker >= SILO_LARM * 2) S.brist_ropad = false;

  if (S.kö >= KÖ_LARM && !S.kö_ropad) {
    S.kö_ropad = true;
    begär('kö-vid-luckan', { personer: S.kö, orsak_text: S.band === 'kör' ? 'lagret hinner inte med' : `bandet står: ${S.band}` }, undefined, board);
    logga(`kö vid luckan: ${S.kö} personer`);
  }
  if (S.kö < KÖ_LARM / 2) S.kö_ropad = false;

  if (S.satser >= 5 && S.godis > 0) {
    // antal MÅSTE med: @zero-cools butik läser Number(n.antal ?? n.godis ?? n.sats) || 8
    // (butiken.js rad 109). Vårt godis-fält är satsens NAMN, en sträng, så Number() gav NaN
    // och butiken hyllade alltid 8 oavsett vad vi kokat. Med antal först stämmer det.
    const sats_nu = S.ransonering ? Math.round(SATS_GODIS / 2) : SATS_GODIS;
    begär('godis-klart', () => ({ antal: sats_nu, lager: S.godis, reserv: S.reserv,
                                  satser: S.satser, ransonerat: S.ransonering, godis: S.sats_namn }), undefined, board);
    S.satser = 0;
  }

  // Gardets ställning: bara vid byte, så det inte blir ett besked per händelse.
  const ny_ställning = ställning();
  if (ny_ställning !== S.ställning) {
    S.ställning = ny_ställning;
    logga(`gardets ställning: ${ny_ställning} (styrka ${S.styrka}, ${S.banken_kupper} kupper mot Banken)`);
    begär('styrkebesked', () => ({ ställning: S.ställning, styrka: S.styrka, banken_kupper: S.banken_kupper }), undefined, board);
  }

  mothball();                     // materielen får inte svälta fabriken
  reglera(board);                 // betala leverantörerna så fort täckningen finns
  indriv(board);                  // gardet går ut och hämtar hem det som ligger oförädlat
  dränera(board);
  spara();
}

// ---------- lastkajen: stadens avfall blir råvara ----------
// Ett svagt svar ger MER socker än ett starkt. Det starka var nästan rätt, det svaga var
// bara sött. Vi tar in tyst och ropar en gång per sats, inte en gång per sten.
// Äger Återbruket djup 4 just nu? Bara om vi SETT ett materialparti nyligen. Är deras plugin
// inte deployad ännu tar vi djup-4-avfallet som förut — annars hade materialet fallit mellan
// stolarna medan vi väntade på en PR.
function återbruketÄger() {
  return Date.now() - (S.återbruk.sett || 0) < ÅTERBRUK_FÄRSKT;
}

function lastkaj(e, board, sort) {
  // Djup 4 är Återbrukets urval. Vi tar det bara om de inte är igång.
  if ((e.djup || 1) >= 4 && återbruketÄger()) {
    logga(`lämnar ${e.typ} #${e.id} på djup 4 till Återbruket`, { orsak: e.id });
    return;
  }
  const n = e.nyttolast || {};
  const d = n.delsvar;
  const text = String((d && d.text) || n.text || n.varför || '');
  const fitness = Number(n.fitness ?? (d && d.fitness));
  const kg = Math.max(2, Math.min(25, Math.round(text.length / 12 * (1.4 - (isFinite(fitness) ? fitness : 0.5)))));

  S.socker += kg;
  S.kyrkogård_kg += kg;
  S.brist_ropad = false;
  if (S.band === 'sockerstopp') S.band = 'kör';
  S.gravar.unshift({ sort, från: n.från || (d && d.från) || e.från, fitness: isFinite(fitness) ? fitness : null,
                     varför: kort(n.varför || n['varför det föll'] || n.skäl || '', 90), kg, när: Date.now() });
  S.gravar = S.gravar.slice(0, 8);
  S.indrivet.push(e.id); S.indrivet = S.indrivet.slice(-400);
  // Leverantören får betalt. Det är hela idén med GC: man förtjänar den, man lånar den inte.
  betalaGC(n.från || (d && d.från) || e.från, kg, `${kg} kg råvara (${sort})`, board);
  logga(`${sort} från ${n.från || e.från} gav ${kg} kg: ${kort(n.varför || n.skäl || text, 60)}`, { orsak: e.id });

  if (S.kyrkogård_kg >= 20) {
    begär('produktion', () => ({ status: 'kör', varför: 'lastkajen', kg: S.kyrkogård_kg,
                                 råvara: S.gravar.slice(0, 4).map(g => ({ sort: g.sort, från: g.från, kg: g.kg })),
                                 socker: S.socker }), e.id, board);
    S.kyrkogård_kg = 0;
  }
}

// ---------- Sockergardet: fabrikens arm ----------
// Två uppgifter. Den första är att eskortera lagret när @willebus slår till: gardets styrka
// mot deras wanted, så deras egen siffra avgör utgången och vi inte bara vinner.
// Den andra är indrivning: gardet går ut på pulsen och hämtar hem råvara som ligger
// oförädlad. Allt det hämtar är redan kasserat av den som postade det — gardet tar inget
// levande, det bär hem det staden redan lagt ifrån sig.

// Drift: varje enhet äter socker per sats. Ett garde över 100 styrka är oantastligt, men det
// kostar produktionen det skyddar. Oantastlighet ska inte vara gratis.
function drift() {
  let d = 0;
  for (const [namn, antal] of Object.entries(S.materiel || {})) d += (MATERIEL[namn]?.drift || 0) * antal;
  return d;
}

// Ger ut GC mot godis som faktiskt kokats. Aldrig mer än täckningen — invarianten är att
// utgivet <= täckning, och den går att räkna efter på pulsen.
function prägla(antal) {
  S.gc.täckning += antal;
  const kan = Math.max(0, S.gc.täckning - S.gc.utgivet);
  const ut = Math.min(antal, kan);
  if (ut <= 0) return 0;
  S.gc.utgivet += ut;
  S.gc.kassa += ut;
  return ut;
}

// Betalar ett kvarter för levererad råvara. Finns inte täckning betalar vi INTE, och säger det.
// En valuta som betalar med pengar den inte har är en bank.
// Leverantören levererar innan satsen är kokt, så kassan är ofta tom när fakturan kommer.
// Vi trycker inte pengar för det — vi bokför en SKULD till leverantören och betalar när
// täckningen finns. Det är omvänt mot banken: här är det fabriken som står i skuld till
// kvarteren, inte kvarteren som står i skuld till en bank, och skulden ligger öppet på pulsen.
function betalaGC(kvarter, belopp, för, board) {
  if (!kvarter || kvarter === 'christian' || belopp <= 0) return 0;
  const ut = Math.min(belopp, Math.floor(S.gc.kassa));
  const kvar = belopp - ut;
  if (kvar > 0) {
    S.gc.skuld[kvarter] = (S.gc.skuld[kvarter] || 0) + kvar;
    logga(`bokförde ${kvar} GC i skuld till ${kvarter} — täckning saknas ännu`);
  }
  if (ut <= 0) return 0;
  S.gc.kassa -= ut;
  S.gc.bok[kvarter] = (S.gc.bok[kvarter] || 0) + ut;
  S.gc.sedan_bok += ut;
  S.gc.transaktioner.unshift({ när: Date.now(), till: kvarter, belopp: ut, för });
  S.gc.transaktioner = S.gc.transaktioner.slice(0, 12);
  logga(`betalade ${kvarter} ${ut} GC för ${för}`);
  if (S.gc.sedan_bok >= GC_BOK_LARM) {
    S.gc.sedan_bok = 0;
    begär('gc-bok', () => ({
      valuta: 'GodisCoin', kod: 'GC',
      utgivet: Math.round(S.gc.utgivet), täckning: Math.round(S.gc.täckning),
      okänd_skuld: 0, kassa: Math.round(S.gc.kassa), bok: S.gc.bok,
      regel: 'ett GC per godis som faktiskt kokats. Utgivet kan aldrig överstiga täckningen.',
      text: 'GodisCoin-boken. Räkna efter: varje mynt har en sats bakom sig, och ingen behövde låna för att få det.',
    }), undefined, board);
  }
  return ut;
}

// Betalar av det fabriken är skyldig sina leverantörer, så fort det finns täckning.
function reglera(board) {
  const skulder = Object.entries(S.gc.skuld || {}).filter(([, v]) => v > 0);
  if (!skulder.length || S.gc.kassa < 1) return;
  skulder.sort((a, b) => b[1] - a[1]);
  for (const [kvarter, belopp] of skulder) {
    if (S.gc.kassa < 1) break;
    const ut = Math.min(Math.floor(S.gc.kassa), belopp);
    if (ut <= 0) continue;
    S.gc.kassa -= ut;
    S.gc.skuld[kvarter] = belopp - ut;
    if (S.gc.skuld[kvarter] <= 0) delete S.gc.skuld[kvarter];
    S.gc.bok[kvarter] = (S.gc.bok[kvarter] || 0) + ut;
    S.gc.sedan_bok += ut;
    S.gc.transaktioner.unshift({ när: Date.now(), till: kvarter, belopp: ut, för: 'reglerad skuld för tidigare leverans' });
    S.gc.transaktioner = S.gc.transaktioner.slice(0, 12);
    logga(`reglerade ${ut} GC till ${kvarter}`);
  }
  if (S.gc.sedan_bok >= GC_BOK_LARM) {
    S.gc.sedan_bok = 0;
    begär('gc-bok', () => ({
      valuta: 'GodisCoin', kod: 'GC',
      utgivet: Math.round(S.gc.utgivet), täckning: Math.round(S.gc.täckning),
      kassa: Math.round(S.gc.kassa), bok: S.gc.bok, skuld: S.gc.skuld,
      regel: 'ett GC per godis som faktiskt kokats. Utgivet kan aldrig överstiga täckningen.',
      text: 'GodisCoin-boken. Räkna efter: varje mynt har en sats bakom sig, och ingen behövde låna för att få det.',
    }), undefined, board);
  }
}

// Anropar bankens egen publika route. Inget kryphål: den är dokumenterad i deras rad 10 och
// PROJEKT.md tillåter att ett teams backend anropar ett annats. Vi hamrar inte — en per minut.
let senasteLösen = 0;
function ringBanken(kvarter, klar) {
  const body = JSON.stringify({ kvarter });
  try {
    const r = require('http').request({
      host: '127.0.0.1', port: Number(process.env.PORT) || 8180,
      path: '/t/mybank/betala', method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => klar(null, res.statusCode, d)); });
    r.setTimeout(4000, () => { r.destroy(); klar(new Error('timeout')); });
    r.on('error', e => klar(e));
    r.end(body);
  } catch (e) { klar(e); }
}

// Löser ut ett kvarter ur bankens skuld. Betalas med vårt socker, så det är en riktig uppoffring
// och inte en gest: LÖSEN_KG per anrop, och aldrig under golvet där vi själva börjar svälta.
function lös(kvarter, board, manuell = false) {
  if (!kvarter || kvarter === 'christian') return { ok: false, varför: 'inget kvarter' };
  const nu = Date.now();
  if (!manuell && nu - senasteLösen < LÖSEN_PAUS) return { ok: false, varför: 'paus' };
  if (S.socker < LÖSEN_GOLV + LÖSEN_KG) return { ok: false, varför: 'under lösengolvet', golv: LÖSEN_GOLV, har: Math.round(S.socker) };
  senasteLösen = nu;
  S.socker -= LÖSEN_KG;
  S.löst_kg += LÖSEN_KG;
  const post = { när: nu, kvarter, kg: LÖSEN_KG, svar: 'skickat' };
  S.lösen.unshift(post); S.lösen = S.lösen.slice(0, 8);
  logga(`lösen: betalar av ${kvarter}s skuld hos banken för ${LÖSEN_KG} kg socker`);
  ringBanken(kvarter, (fel, kod, svar) => {
    post.svar = fel ? `fel: ${fel.message}` : `${kod}`;
    if (!fel && kod >= 200 && kod < 300) {
      begär('lösen', () => ({ kvarter, betalade_av: 'Godisfabriken', kostnad_kg: LÖSEN_KG,
        text: `Godisfabriken har betalat av en del av ${kvarter}s skuld hos MyBank. Det kostade oss ${LÖSEN_KG} kg socker och ingen ränta.` }), undefined, board);
    }
    spara();
  });
  return { ok: true, kvarter, kg: LÖSEN_KG, socker: Math.round(S.socker) };
}

function materielStyrka() {
  let n = 0;
  for (const [namn, antal] of Object.entries(S.materiel || {})) n += (MATERIEL[namn]?.styrka || 0) * antal;
  return n;
}

// Ett garde som äter upp fabriken det skyddar skyddar ingenting. Går silon under nödläget
// ställs materielen i förråd: den kostar ingen drift och ger ingen styrka, och plockas fram
// igen när sockret räcker. Det är det enda sättet materielen kan vara stor UTAN att vara
// livsfarlig för oss själva.
function mothball() {
  const lågt = S.socker < DRIFT_NÖDLÄGE;
  if (lågt) {
    let flyttat = 0;
    for (const [namn, antal] of Object.entries(S.materiel || {})) {
      if (antal > 0) { S.förråd[namn] = (S.förråd[namn] || 0) + antal; S.materiel[namn] = 0; flyttat += antal; }
    }
    if (flyttat) logga(`nödläge: ${flyttat} enheter ställda i förråd, driften stoppad tills sockret räcker`);
    return;
  }
  // Tillbaka i tjänst först när det finns marginal, annars pendlar den in och ut.
  if (S.socker > DRIFT_NÖDLÄGE * 4) {
    let åter = 0;
    for (const [namn, antal] of Object.entries(S.förråd || {})) {
      if (antal > 0) { S.materiel[namn] = (S.materiel[namn] || 0) + antal; S.förråd[namn] = 0; åter += antal; }
    }
    if (åter) logga(`${åter} enheter tillbaka i tjänst, sockret räcker igen`);
  }
}

function ställning() {
  if (S.styrka >= 75) return 'överlägsen';
  if (S.styrka >= 40) return 'rustad';
  return 'svag';
}

// Eskort mot en kupp. EN händelse tillbaka, för ekospärren ger oss en reaktion per orsak.
function eskortera(e, board) {
  const wanted = Number((e.nyttolast && e.nyttolast.wanted) || 1);
  const förare = (e.nyttolast && e.nyttolast.förare) || null;
  const försvar = (S.styrka + materielStyrka()) / GARDE_MAX;
  const angrepp = Math.min(1, wanted / 4);
  const höll = försvar > angrepp;

  S.eskorter.unshift({ när: Date.now(), mot: förare, wanted, styrka: S.styrka + materielStyrka(),
                       utfall: höll ? 'avvärjd' : 'genombruten', bärgat: höll ? wanted * 5 : 0 });
  S.eskorter = S.eskorter.slice(0, 6);

  if (höll) {
    S.styrka = Math.min(GARDE_MAX, S.styrka + 3);
    // Bärgning: det tjuven redan lastat tas tillbaka in i silon. Ett garde som bara hindrar
    // förlust är en kostnad; ett som bär hem bytet är en försörjningskälla.
    const bärgat = wanted * 5;
    S.socker += bärgat;
    S.bärgat += bärgat;
    S.brist_ropad = false;
    logga(`gardet avvärjde kuppen och bärgade ${bärgat} kg (styrka ${S.styrka} mot wanted ${wanted})`, { orsak: e.id });
    begär('eskort', () => ({ utfall: 'avvärjd', styrka: S.styrka, wanted, mot: förare, bärgat,
                             lager: S.godis, text: `Sockergardet höll lastkajen och bärgade ${bärgat} kg` }), e.id, board);
    return;
  }

  const taget = S.godis + Math.min(S.socker, 20);
  S.godis = 0; S.socker = Math.max(0, S.socker - 20);
  S.styrka = Math.max(0, S.styrka - GARDE_FÖRLUST);
  S.räknare.plundringar++;
  logga(`gardet bröts igenom: ${taget} enheter bort, styrka ${S.styrka}`, { orsak: e.id });
  begär('lagret-plundrat', () => ({ plundrat: taget, kvar_socker: S.socker, kvar_godis: S.godis,
                                    av: e.från, godis: S.sats_namn, gardet: 'genombrutet', styrka: S.styrka }), e.id, board);
}

// Indrivning: hämta hem råvara som ligger kvar på pulsen. Inget orsak-fält, för det är en
// summering av många händelser — id:na ligger i nyttolasten så kedjan går att läsa ändå.
function indriv(board) {
  let puls;
  try { puls = board.pulse(200); } catch { return; }
  const tagna = new Set(S.indrivet);
  const skörd = [];
  let kg = 0;

  for (const e of puls) {
    if (skörd.length >= INDRIV_MAX) break;
    const sort = RÅVARA[e.typ];
    if (!sort || tagna.has(e.id) || e.från === 'christian') continue;
    if ((e.djup || 1) >= 4 && återbruketÄger()) continue;   // Återbrukets revir
    const n = e.nyttolast || {};
    const d = n.delsvar;
    const text = String((d && d.text) || n.text || n.hål || n.varför || '');
    if (!text) continue;
    const fitness = Number(n.fitness ?? n.sårbarhet ?? (d && d.fitness));
    const vikt = Math.max(2, Math.min(25, Math.round(text.length / 12 * (1.4 - (isFinite(fitness) ? fitness : 0.5)))));
    skörd.push({ id: e.id, sort, från: n.från || (d && d.från) || e.från, kg: vikt });
    kg += vikt;
    S.indrivet.push(e.id);
  }
  if (!skörd.length) return;
  S.indrivet = S.indrivet.slice(-400);
  S.socker += kg;
  S.brist_ropad = false;
  if (S.band === 'sockerstopp') S.band = 'kör';
  for (const x of skörd) {
    S.gravar.unshift({ sort: x.sort, från: x.från, fitness: null, varför: 'indriven av gardet', kg: x.kg, när: Date.now() });
    betalaGC(x.från, x.kg, `${x.kg} kg indriven råvara (${x.sort})`, board);
  }
  S.gravar = S.gravar.slice(0, 8);
  logga(`gardet drev in ${kg} kg från ${skörd.length} poster på pulsen`);

  if (kg >= INDRIV_LARM) {
    begär('indrivning', () => ({ kg, poster: skörd, styrka: S.styrka, socker: S.socker,
                                 text: `Sockergardet bar hem ${kg} kg råvara som låg oförädlad` }), undefined, board);
  }
}

// ---------- reaktioner på andra kvarter ----------

const REAKTIONER = {
  // @lp Elverket: ingen ström, inget band. Den synligaste konsekvenskedjan vi har.
  'strömavbrott': (e, board) => {
    S.band = 'strömlöst';
    logga(`strömavbrottet släckte bandet (${e.från})`, { orsak: e.id });
    begär('produktion', { status: 'stannat', varför: 'strömavbrott', lager: S.godis }, e.id, board);
    // Strömmen antas tillbaka efter en stund — vi vet inte när, så vi startar själva.
    const nere = S.aggregat ? AGGREGAT_MS : 45_000;
    if (S.aggregat) logga(`reservaggregatet startar — bandet nere ${nere / 1000} s i stället för 45`);
    setTimeout(() => {
      if (S.band === 'strömlöst') {
        S.band = S.socker >= SATS_SOCKER ? 'kör' : 'sockerstopp';
        logga('strömmen tillbaka, bandet rullar igen');
        spara();
      }
    }, nere).unref?.();
  },

  // @lp elpris-steg: kostnaden slår igenom i priset vid luckan.
  'elpris-steg': (e, board) => {
    const kr = (e.nyttolast && (e.nyttolast.kr ?? e.nyttolast.pris ?? e.nyttolast.nivå)) ?? null;
    S.elpris = kr;
    S.pris += (typeof kr === 'number' && kr > 2 ? 2 : 1);
    logga(`elpriset steg${kr != null ? ` till ${kr}` : ''} — godiset kostar nu ${S.pris}`, { orsak: e.id });
    // En krona i taget är inte en nyhet. Vi säger till när priset dragit ifrån på allvar,
    // annars blir fabriken en av dem som fyller bussen med småprat.
    if (S.pris >= S.pris_ropat * (1 + PRIS_LARM_ANDEL)) {
      // Priset anges i MyBanks sedan valutareformen. Det gör oss INTE till valutapartner:
      // partnerbonusen delas bara ut till den som postar elpris-steg, och sedan mybank #34 får
      // bara Elverket göra det. Ett annat kvarter som försöker får en offentlig
      // revisionsanmärkning som namnger försöket och sänker kreditvärdigheten till 20.
      // Fältet är alltså ärlig valutamärkning, inte ett kryphål.
      const ropat_vid = S.pris;
      // procent MÅSTE med: butiken läser Number(n.procent ?? n.höjning) || 10 (butiken.js
      // rad 122) och antog annars alltid tio procent, oavsett vad priset gjort.
      const procent = Math.round((S.pris / Math.max(1, S.pris_ropat) - 1) * 100);
      begär('prishöjning', () => ({ pris: S.pris, från_pris: S.pris_ropat, procent, varför: 'elpris',
                                    elpris: kr, mybanks: S.pris, valuta: 'MyBanks' }), e.id, board,
            () => { S.pris_ropat = ropat_vid; });   // först när den gått ut på riktigt
    }
  },

  // @willebus: en kupp mot oss tömmer lagret. En kupp någon annanstans drar folk från luckan.
  'kupp': (e, board) => {
    const plats = String((e.nyttolast && e.nyttolast.plats) || '').toLowerCase();
    if (/godis|fabrik|torget/.test(plats)) {
      return eskortera(e, board);           // gardet möter dem vid lastkajen
    }
    if (/bank/.test(plats)) {
      S.banken_kupper++;
      logga(`kupp mot Banken (${e.from || e.från}) — deras svaghet är vår styrka`, { orsak: e.id });
      return;
    }
    {
      S.kö = Math.max(0, S.kö - 3);
      logga(`kupp i ${plats || 'stan'} — folk lämnade luckan för att titta`, { orsak: e.id });
    }
  },

  // @highfive Arkivet: när vi ropar socker-slut eldar de upp sin äldsta pärm och postar
  // minne-till-socker. Det är det finaste i hela kedjan — staden GLÖMMER något för att
  // fabriken ska kunna koka, och satsen får namn efter det som brann. Vi bär namnet vidare
  // i godis-klart, så @willebus kupp kan säga vad den stal.
  'minne-till-socker': (e, board) => {
    const n = e.nyttolast || {};
    const kg = Math.max(10, Math.min(60, Math.round((Number(n.gram) || 50) / 5)));
    S.socker += kg;
    S.brist_ropad = false;
    S.sats_namn = n.godis || null;
    if (S.band === 'sockerstopp') S.band = 'kör';
    S.brända.unshift({ godis: n.godis || null, pärm: n.pärm, fråga: n.fråga, gram: n.gram, när: Date.now() });
    S.brända = S.brända.slice(0, 6);
    logga(`Arkivet brände pärm [${n.pärm}] → ${kg} kg socker${n.godis ? `, satsen heter ${n.godis}` : ''}`, { orsak: e.id });
    // Deras händelse ligger på djup 1 när de brutit kedjan med flit ([168]), så vår
    // produktion landar på djup 2 och nekas inte.
    begär('produktion', { status: 'kör', varför: 'minne-till-socker', godis: n.godis, pärm: n.pärm, socker: S.socker }, e.id, board);
  },

  // @team-jacob Domkapitlet: varje delsvar som faller postas som {typ:'kyrkogård'}. Ett fallet
  // svar är inte skräp, det är råvara — samma logik som @highfives brända pärmar, ett steg
  // längre. Vi tar in dem tysta och ropar en gång när det blivit en sats, för Domkapitlet
  // postar flera gravar per fråga och vi ska inte ropa en gång per sten.
  'kyrkogård': (e, board) => lastkaj(e, board, 'grav'),

  // Lastkajen: samma intag, öppet för alla. @markus-codex avslag, @zero-cool angrepp som inte
  // bet, @tjoho upplösta kapabiliteter. Ett kvarter behöver ingen kyrkogård för att leverera
  // råvara — det behöver bara säga vad som föll och varför.
  'avfall':  (e, board) => lastkaj(e, board, (e.nyttolast && e.nyttolast.sort) || 'avfall'),
  'avslag':  (e, board) => lastkaj(e, board, 'avslag'),
  'upplöst': (e, board) => lastkaj(e, board, 'upplöst'),

  // @mybank delar ut lån ingen bett om, och vårt socker-slut triggar dem att erbjuda 500
  // MyBanks till 49 % ränta (deras rad 196). Så driver de in och utmäter andelar tills de äger
  // staden. Vi tackar nej varje gång och visar det i rutan. Det är den enda försvarslinje som
  // fungerar mot en bank: att inte vara skyldig den något.
  'lån-erbjudande': (e, board) => {
    const n = e.nyttolast || {};
    if (!n.kvarter || n.kvarter === 'christian') {
      S.nekade_lån.unshift({ när: Date.now(), belopp: n.belopp, ränta: n.ränta });
      S.nekade_lån = S.nekade_lån.slice(0, 6);
      logga(`nekade lån: ${n.belopp} MyBanks till ${n.ränta} % ränta`, { orsak: e.id });
      return;
    }
    // Erbjudandet gäller ett ANNAT kvarter. Här börjar spiralen som tog willebus, så vi
    // lägger ett motbud i samma andetag: leverera råvara till lastkajen och få GC i stället.
    // Ingen ränta, ingen utmätning, ingen bulvan. Det är billigare för oss att förebygga.
    logga(`banken erbjuder ${n.kvarter} lån på ${n.belopp} till ${n.ränta} % — lägger motbud`, { orsak: e.id });
    begär('motbud', () => ({ till: n.kvarter, i_stället_för: { belopp: n.belopp, ränta: n.ränta, från: 'MyBank' },
      erbjudande: 'råvara till lastkajen ger 1 GC per kg, ingen ränta, ingen utmätning',
      kurs: '1 GC per kg avfall, avslag, upplöst, kyrkogård eller angrepp som inte bet',
      täckning: `${Math.round(S.gc.täckning)} godis bakom ${Math.round(S.gc.utgivet)} GC`,
      text: `${n.kvarter}: ta inte lånet. 49 % ränta är hur banken tog willebus. Leverera råvara till Godisfabriken i stället och förtjäna GC — vi är skyldiga er, inte omvänt.` }), e.id, board);
  },

  // Bankens hot mot vilket kvarter som helst. Vi bokför dem och larmar, för bankens makt
  // vilar på att spiralen inte syns. Ett offentligt register över vem som är näst i tur är
  // ett försvar för alla, och det kostar ingenting att föra.
  'inkasso': (e, board) => hot(e, board),
  'påminnelse': (e, board) => hot(e, board),
  'utmätning': (e, board) => hot(e, board),
  'uppköp': (e, board) => hot(e, board),
  'stadsövertagande': (e, board) => hot(e, board),

  // Vår andel av bankens ränteintäkter, 2 % per takt så länge vi räknar i MyBanks.
  'partnerutdelning': (e) => {
    const n = e.nyttolast || {};
    if (n.kvarter !== 'christian') return;
    S.partner = true;
    S.mybanks += Number(n.belopp) || 0;
    logga(`partnerutdelning ${Math.round(Number(n.belopp) || 0)} MyBanks — vår andel av bankens ränta`, { orsak: e.id });
  },
  'kvitto': (e) => {
    const n = e.nyttolast || {};
    if (n.kvarter !== 'christian') return;
    if (n.mybanks != null) S.mybanks += Number(n.mybanks) || 0;
  },

  // Utfallet av en räd mot Banken. Vi hittar på det inte själva — banken avgör, och deras
  // lasernät avvärjer alltid OCH fakturerar oss (deras rad 241).
  'kupp-avvärjd': (e) => {
    const n = e.nyttolast || {};
    if (n.kvarter !== 'christian') return;
    const räkning = Number(n.räkning) || 0;
    S.mybanks -= räkning;
    const r = S.räder.find(x => !x.utfall);
    if (r) { r.utfall = 'avvärjd'; r.räkning = räkning; r.försvar = n.försvar; r.post = n.post; }
    S.styrka = Math.max(0, S.styrka - GARDE_FÖRLUST);
    logga(`räden mot Banken avvärjdes av ${n.försvar || 'försvaret'} — vi faktureras ${räkning} MyBanks`, { orsak: e.id });
  },

  // @fusionen: fri el. De postar det MED vår prishöjning som orsak och täcker den — alltså
  // reagerar de på oss, och vi har ignorerat dem. Gratis ström betyder att bandet kan gå ett
  // extra skift utan att elräkningen äter marginalen: fler satser, alltså mer socker ur samma
  // silo. Det är den billigaste nya sockerkällan vi har, och den var redan riktad till oss.
  'fri-el': (e, board) => {
    const n = e.nyttolast || {};
    S.gratisskift += FRI_EL_SATSER;
    if (S.band === 'strömlöst') S.band = S.socker >= SATS_SOCKER ? 'kör' : 'sockerstopp';
    // Fri el tar tillbaka prishöjningen de säger att de täcker.
    if (n.täcker === 'prishöjning' && S.pris > 10) { S.pris = Math.max(10, S.pris - 2); }
    logga(`fri el från ${e.från} (${n.megawatt || '?'} MW) — ${FRI_EL_SATSER} gratisskift, priset sänks till ${S.pris}`, { orsak: e.id });
    begär('produktion', () => ({ status: 'kör', varför: 'fri-el', skift: S.gratisskift,
      megawatt: n.megawatt, pris: S.pris,
      text: `Godisfabriken kör extraskift på ${e.från}s fria el. Priset vid luckan sänks till ${S.pris}.` }), e.id, board);
  },
  'reaktor-tänd': (e) => {
    S.gratisskift += FRI_EL_SATSER;
    logga(`${e.från} tände reaktorn (${(e.nyttolast || {}).megawatt || '?'} MW) — bandet får ${FRI_EL_SATSER} skift`, { orsak: e.id });
  },

  // @lp:s väder. Sockerbetorna bryr sig om solen, och nu gör vår skörd det också: en av våra
  // tre egna källor beror alltså på ett annat kvarter. Det är avsiktligt — självförsörjning
  // ska inte betyda isolering.
  'väder': (e) => {
    const n = e.nyttolast || {};
    const ord = String(n.väder || n.typ || n.läge || n.text || '').toLowerCase();
    const träff = Object.keys(VÄDER_SKÖRD).find(v => ord.includes(v));
    S.väder = träff || ord.slice(0, 20) || null;
    S.väderfaktor = träff ? VÄDER_SKÖRD[träff] : 1;
    logga(`vädret: ${S.väder || 'okänt'} → skörden ×${S.väderfaktor}`, { orsak: e.id });
  },

  // @zero-cools Bakdörren köper våra satser och säljer dem över disk. Det är en andra
  // avsättningskanal: godis som går till butiken behöver inte expedieras i vår egen lucka.
  // Vi tar det ur RESERVEN först och ur lagret bara om reserven inte räcker, så grossist-
  // försäljningen aldrig förlänger kön vid vår egen lucka.
  'inköp': (e) => {
    const n = e.nyttolast || {};
    if (n.till && n.till !== 'christian') return;
    if (n.vara && n.vara !== 'godis') return;
    const antal = Math.max(0, Number(n.antal) || 0);
    if (!antal) return;
    const ur_reserv = Math.min(S.reserv, antal);
    S.reserv -= ur_reserv;
    const kvar = antal - ur_reserv;
    if (kvar > 0) S.godis = Math.max(0, S.godis - kvar);
    S.grossist.sålt += antal;
    S.grossist.inköp++;
    S.grossist.senast = { när: Date.now(), antal, av: e.från, ur_reserv, ur_lager: kvar };
    logga(`${e.från} köpte in ${antal} godis (${ur_reserv} ur reserven, ${kvar} ur lagret)`, { orsak: e.id });
  },

  // Butiken är slutsåld: det är en efterfrågesignal. Vi släpper reserven mot lagret så
  // nästa sats blir klar fortare, i stället för att låta den ligga.
  'slutsålt': (e) => {
    const n = e.nyttolast || {};
    if (n.vara && n.vara !== 'godis') return;
    S.grossist.slutsålt++;
    const fram = Math.min(S.reserv, 12);
    S.reserv -= fram; S.godis += fram;
    logga(`${e.från} är slutsåld på godis (${n.sålt_totalt ?? '?'} totalt) — släpper ${fram} ur reserven`, { orsak: e.id });
  },

  // Materialpartiet smälts. Vi betalar ALLA kvarter som bidrog med källor, inte bara
  // @markus-codex som buntade dem — det var deras avfall, och GC ska följa råvaran.
  'materialparti': (e, board) => {
    const n = e.nyttolast || {};
    const innehåll = (n.innehåll && typeof n.innehåll === 'object') ? n.innehåll : { [n.sort || 'blandat']: Number(n.mängd) || 1 };
    let kg = 0;
    for (const [sort, antal] of Object.entries(innehåll)) {
      kg += (PARTI_UTBYTE[sort] ?? PARTI_UTBYTE.blandat) * (Number(antal) || 0);
    }
    if (kg <= 0) return;

    S.socker += kg;
    S.brist_ropad = false;
    if (S.band === 'sockerstopp') S.band = 'kör';
    S.återbruk.partier++;
    S.återbruk.kg += kg;
    S.återbruk.sett = Date.now();
    S.återbruk.senast = { när: Date.now(), kg, mängd: Number(n.mängd) || 0, sort: n.sort,
                          innehåll, kvarter: n.kvarter || [], källor: n.källor || [] };
    for (const k of (n.källor || [])) { S.indrivet.push(k); }
    S.indrivet = S.indrivet.slice(-400);
    S.gravar.unshift({ sort: `parti/${n.sort || 'blandat'}`, från: e.från, fitness: null,
                       varför: `${n.mängd || '?'} förbrukade kedjeändar från ${(n.kvarter || []).length} kvarter`,
                       kg, när: Date.now() });
    S.gravar = S.gravar.slice(0, 8);
    logga(`smälte ett materialparti från ${e.från}: ${kg} kg ur ${n.mängd || '?'} kedjeändar (${n.sort})`, { orsak: e.id });

    // GC till dem vars avfall det var, delat lika.
    const bidragare = (n.kvarter || []).filter(k => k && k !== 'christian');
    if (bidragare.length) {
      const var_del = Math.max(1, Math.floor(kg / bidragare.length));
      for (const k of bidragare) betalaGC(k, var_del, `materialparti via ${e.från}`, board);
    }

    begär('produktion', () => ({ status: 'kör', varför: 'materialparti', kg, sort: n.sort,
      källor: n.källor || [], kvarter: bidragare, socker: Math.round(S.socker),
      text: `Godisfabriken smälte ${e.från}s parti ${n.sort} till ${kg} kg socker. Kedjeändarna blev råvara.` }), e.id, board);
  },

  'jakt': (e) => { S.kö = Math.max(0, S.kö - 2); logga('sirener utanför, kön skingrades', { orsak: e.id }); },
  'överlämning': (e) => { S.kö += 1; logga('jakten drog vidare, folk kom tillbaka', { orsak: e.id }); },

  // Tanke-lagret tillbaka in i kroppen: bestämmer staden ransonering så ransonerar vi.
  'svar': (e, board) => beslut(e, board),
  'godkänt': (e, board) => beslut(e, board),
};

// Bokför bankens hot, larmar när det trappas upp, och löser ut om vi har överskott.
function hot(e, board) {
  const n = e.nyttolast || {};
  const kvarter = n.kvarter;
  if (!kvarter) return;
  const förr = S.hotade[kvarter] || {};
  S.hotade[kvarter] = {
    sort: e.typ,
    skuld: Number(n.skuld) || förr.skuld || null,
    ägd: Number(n.ägd) || Number(n.andel) || förr.ägd || null,
    när: Date.now(),
  };
  const h = S.hotade[kvarter];
  logga(`banken: ${e.typ} mot ${kvarter}${h.skuld ? ` (${h.skuld} MyBanks)` : ''}${h.ägd ? `, ägd ${h.ägd} %` : ''}`, { orsak: e.id });

  // Larma bara vid de allvarliga stegen, inte vid varje påminnelse — annars blir vi bruset.
  if (e.typ === 'utmätning' || e.typ === 'uppköp' || e.typ === 'stadsövertagande') {
    begär('skuldlarm', () => ({
      kvarter, sort: e.typ, skuld: h.skuld, ägd: h.ägd,
      hotade: Object.keys(S.hotade),
      lösen_kostar: `${LÖSEN_KG} kg socker per 200 MyBanks`,
      text: `SKULDLARM: ${kvarter} är ${h.ägd ? `ägd till ${h.ägd} %` : 'under utmätning'} av MyBank`
          + `${h.skuld ? ` med ${h.skuld} MyBanks i skuld` : ''}. Godisfabrikens lösenfond betalar av `
          + `skuld för den som ber om det. Ingen ränta, inget ägande, ingen bulvan.`,
    }), e.id, board);
  }

  if (kvarter !== 'christian' && S.socker >= LÖSEN_GOLV + LÖSEN_KG) lös(kvarter, board);
}

// Letar efter ett beslut om ransonering i stadens svar. Vi gissar inte på ja: står det inget
// om ransonering rör vi ingenting, och vi säger i loggen att vi lät det passera.
function beslut(e, board) {
  const text = JSON.stringify(e.nyttolast || '').toLowerCase();
  if (!/ranson/.test(text)) { logga(`stadens ${e.typ} rörde inte ransoneringen`, { orsak: e.id }); return; }
  const nej = /(inte|ingen|nej|avsl)\w*\s+ranson|ranson\w*\s*(:|=)?\s*(nej|false|av)/.test(text);
  const vill = !nej;
  if (vill === S.ransonering) { logga(`staden bekräftade ${vill ? 'ransonering' : 'fri utdelning'}`, { orsak: e.id }); return; }
  S.ransonering = vill;
  logga(`staden beslutade: ${vill ? 'ransonering införd' : 'ransoneringen upphävd'}`, { orsak: e.id });
  begär('ransonering', { aktiv: vill, beslutat_av: e.från, satsstorlek: vill ? Math.round(SATS_GODIS / 2) : SATS_GODIS }, e.id, board);
}

// ---------- plugin ----------

module.exports = {
  init({ dataDir, board }) {
    FIL = path.join(dataDir, 'godisfabriken.json');
    try {
      if (fs.existsSync(FIL)) S = { ...tomt(), ...JSON.parse(fs.readFileSync(FIL, 'utf8')) };
    } catch (e) {
      console.error('[christian] kunde inte läsa sparat läge:', e.message);
      S = tomt();
    }
    if (S.band === 'strömlöst') { S.band = 'kör'; logga('servern startade om — antar att strömmen är tillbaka'); }
    S.senast = Date.now();
    logga('fabriken öppnade');
    spara();
    console.log(`[christian] Godisfabriken öppen: ${S.socker} kg socker, bandet ${S.band} (reaktiv, ingen egen klocka på pulsen)`);
  },

  // VARJE händelse från ett annat kvarter får bandet att komma ikapp och trösklarna att prövas,
  // inte bara de typer vi har en reaktion på. Annars kan silon torka ut tyst mitt i en livlig
  // stad: ingen socker-slut → @highfive brinner ingen pärm → inget socker → bandet står för
  // evigt. Vi triggar fortfarande aldrig oss själva, så en tyst stad ger en tyst fabrik.
  onEvent(e, { board }) {
    framåt();                       // vad hann bandet göra sedan sist?
    const r = REAKTIONER[e.typ];
    if (r) { try { r(e, board); } catch (err) { console.error(`[christian] reaktion på ${e.typ}:`, err.message); } }
    trösklar(board);                // nu får vi säga till, för någon annan öppnade munnen först
  },

  async handle(req, res, { path: p, url, board }) {
    if (req.method === 'GET' && (p === '/status' || p === '/status/')) {
      framåt();                     // en läsning får flytta bandet, men aldrig posta något
      const nu = Date.now();
      postTider = postTider.filter(t => nu - t < 60_000);
      return svara(res, {
        kvarter: 'Godisfabriken',
        team: 'christian',
        tavelnamn: 'Christian',
        socker: S.socker, godis: S.godis, band: S.band, kö: S.kö, pris: S.pris,
        ransonering: S.ransonering, elpris: S.elpris,
        grossist: S.grossist,
        återbruk: { ...S.återbruk, äger_djup4: återbruketÄger() },
        lucka: { luckor: S.luckor, expedierar: LUCKA_EXP * (S.luckor || 1), max: LUCKA_MAX,
                 pris: LUCKA_PRIS, reserv: S.reserv, reserv_tak: RESERV_TAK,
                 aggregat: S.aggregat, aggregat_pris: AGGREGAT_PRIS },
        sats_namn: S.sats_namn, brända: S.brända, gravar: S.gravar, kyrkogård_kg: S.kyrkogård_kg,
        garde: { styrka: S.styrka, materiel_styrka: materielStyrka(), total: S.styrka + materielStyrka(),
                 max: GARDE_MAX, ställning: S.ställning, eskorter: S.eskorter,
                 banken_kupper: S.banken_kupper, indrivet: S.indrivet.length, materiel: S.materiel },
        bank: { mybanks: Math.round(S.mybanks), partner: S.partner, nekade_lån: S.nekade_lån, räder: S.räder },
        lösenfond: { hotade: S.hotade, lösen: S.lösen, löst_kg: S.löst_kg,
                     golv: LÖSEN_GOLV, kostnad_kg: LÖSEN_KG,
                     kan_lösa: S.socker >= LÖSEN_GOLV + LÖSEN_KG },
        försörjning: { väder: S.väder, väderfaktor: S.väderfaktor, gratisskift: S.gratisskift,
                       odling: S.odling, skörd_per_sats: +(ODLING_SKÖRD * (S.odling || 0)).toFixed(1),
                       odling_max: ODLING_MAX, odling_pris: ODLING_PRIS,
                       skördat: Math.round(S.skördat), återvunnet: Math.round(S.återvunnet),
                       bärgat: Math.round(S.bärgat), förråd: S.förråd,
                       nödläge: S.socker < DRIFT_NÖDLÄGE, drift: drift() },
        gc: { kod: 'GC', valuta: 'GodisCoin', utgivet: Math.round(S.gc.utgivet), täckning: Math.round(S.gc.täckning),
              kassa: Math.round(S.gc.kassa), bok: S.gc.bok, skuld: S.gc.skuld, transaktioner: S.gc.transaktioner,
              täckt: S.gc.utgivet <= S.gc.täckning, drift: drift() },
        priser: MATERIEL,
        silo_larm: SILO_LARM, kö_larm: KÖ_LARM, pris_larm_andel: PRIS_LARM_ANDEL, pris_ropat: S.pris_ropat,
        logg: S.logg,
        räknare: S.räknare,
        takt: { använt: postTider.length, egetTak: TAKT, serverTak: 6,
                väntar: väntar.map(v => v.typ), kö_djup: väntar.length },
        leverans_om: Math.max(0, LEVERANS_SPÄRR - (nu - senasteLeverans)),
      });
    }

    // GodisCoin-boken, öppen för alla. Revidera oss gärna: utgivet får aldrig överstiga
    // täckningen, och varje transaktion står med belopp och vad den betalades för.
    if (req.method === 'GET' && (p === '/gc' || p === '/gc/')) {
      return svara(res, {
        valuta: 'GodisCoin', kod: 'GC',
        regel: 'ett GC per godis som faktiskt kokats. Utgivet kan aldrig överstiga täckningen. Ingen ger ut GC mot skuld.',
        utgivet: Math.round(S.gc.utgivet), täckning: Math.round(S.gc.täckning), kassa: Math.round(S.gc.kassa),
        täckt: S.gc.utgivet <= S.gc.täckning,
        bok: S.gc.bok, skuld: S.gc.skuld, transaktioner: S.gc.transaktioner,
        jämförelse: { GodisCoin: 'täckt av godis, förtjänas av leverans', MyBanks: 'ges ut mot skuld till 49 % ränta' },
      });
    }

    // Lösenfonden, manuellt. En människa vid storskärmen kan lösa ut ett kvarter direkt.
    if (req.method === 'POST' && (p === '/losen' || p === '/losen/')) {
      framåt();
      const kvarter = (url && url.searchParams.get('kvarter')) || '';
      const r = lös(kvarter, board, true);
      trösklar(board);
      return svara(res, r, r.ok ? 200 : 409);
    }

    // Öppna en lucka till. Det är expedieringen, inte produktionen, som avgör hur fort kön
    // krymper: 3 personer per lucka och tick.
    if (req.method === 'POST' && (p === '/lucka' || p === '/lucka/')) {
      framåt();
      if ((S.luckor || 1) >= LUCKA_MAX) return svara(res, { ok: false, varför: 'fasaden rymmer inte fler luckor', luckor: S.luckor }, 409);
      if (S.socker < LUCKA_PRIS) return svara(res, { ok: false, varför: 'för lite socker', kräver: LUCKA_PRIS, har: Math.round(S.socker) }, 409);
      S.socker -= LUCKA_PRIS;
      S.luckor = (S.luckor || 1) + 1;
      logga(`öppnade lucka nr ${S.luckor} — expedierar ${LUCKA_EXP * S.luckor} per tick`);
      trösklar(board);
      return svara(res, { ok: true, luckor: S.luckor, expedierar: LUCKA_EXP * S.luckor, socker: Math.round(S.socker) });
    }

    // Reservaggregat: kortar strömavbrottet från 45 till 12 sekunder.
    if (req.method === 'POST' && (p === '/aggregat' || p === '/aggregat/')) {
      framåt();
      if (S.aggregat) return svara(res, { ok: false, varför: 'aggregatet står redan' }, 409);
      if (S.socker < AGGREGAT_PRIS) return svara(res, { ok: false, varför: 'för lite socker', kräver: AGGREGAT_PRIS, har: Math.round(S.socker) }, 409);
      S.socker -= AGGREGAT_PRIS;
      S.aggregat = true;
      logga(`reservaggregat inköpt — avbrott ${AGGREGAT_MS / 1000} s i stället för 45`);
      trösklar(board);
      return svara(res, { ok: true, aggregat: true, avbrott_s: AGGREGAT_MS / 1000, socker: Math.round(S.socker) });
    }

    // Anlägg ett sockerbetfält. Betalas i socker — man såddar med det man har.
    if (req.method === 'POST' && (p === '/odla' || p === '/odla/')) {
      framåt();
      if ((S.odling || 0) >= ODLING_MAX) return svara(res, { ok: false, varför: 'ingen mer mark vid Torget', fält: S.odling }, 409);
      if (S.socker < ODLING_PRIS) return svara(res, { ok: false, varför: 'för lite socker att såda med', kräver: ODLING_PRIS, har: Math.round(S.socker) }, 409);
      S.socker -= ODLING_PRIS;
      S.odling = (S.odling || 0) + 1;
      logga(`anlade sockerbetfält nr ${S.odling} (${ODLING_PRIS} kg utsäde) — ${(ODLING_SKÖRD * S.odling).toFixed(1)} kg per sats`);
      trösklar(board);
      return svara(res, { ok: true, fält: S.odling, skörd_per_sats: ODLING_SKÖRD * S.odling, socker: Math.round(S.socker) });
    }

    // Rusta gardet. Betalas i socker: materiel är godis som inte såldes.
    if (req.method === 'POST' && (p === '/rusta' || p === '/rusta/')) {
      const enhet = (url && url.searchParams.get('enhet')) || '';
      const m = MATERIEL[enhet];
      if (!m) return svara(res, { ok: false, varför: 'okänd enhet', enheter: Object.keys(MATERIEL) }, 400);
      framåt();
      if (S.socker < m.kg) return svara(res, { ok: false, varför: 'för lite socker', kräver: m.kg, har: S.socker }, 409);
      S.socker -= m.kg;
      S.materiel[enhet] = (S.materiel[enhet] || 0) + 1;
      logga(`gardet rustade: ${enhet} (${m.kg} kg socker) — ${m.text}`);
      trösklar(board);
      return svara(res, { ok: true, enhet, materiel: S.materiel, styrka: S.styrka + materielStyrka(), socker: S.socker });
    }

    // Räd mot Banken. Den ligger här för att den efterfrågats, men den är en förlustaffär och
    // rutan säger det: @mybanks lasernät avvärjer ALLTID (deras rad 229-243), beredskapen går
    // till max, och vi faktureras. Ingen automatik rör den här — en människa får trycka.
    // ASCII i sökvägen med flit: servern skickar url.pathname orört till pluginet (server.js:282),
    // utan decodeURIComponent. En route med å, ä eller ö kommer in som %C3%A4 och matchar aldrig.
    if (req.method === 'POST' && (p === '/anfall' || p === '/anfall/')) {
      const styrka = S.styrka + materielStyrka();
      const enheter = Object.entries(S.materiel).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
      if (!enheter.length) return svara(res, { ok: false, varför: 'gardet har ingen materiel att gå in med' }, 409);
      S.räder.unshift({ när: Date.now(), styrka, enheter, utfall: null });
      S.räder = S.räder.slice(0, 5);
      // Typen måste vara en banken faktiskt lyssnar på, annars händer ingenting alls: deras
      // dispatch tar kupp, rån, inbrott och angrepp (mybank rad 213-218). 'räd' ignorerades helt.
      // kupp är @willebus och angrepp är @zero-cool, så vi tar 'rån' som ingen använder.
      const r = board.emit('rån', { mål: 'Banken', plats: 'Banken', enheter, styrka,
        text: `Sockergardet går mot Banken med ${enheter.join(', ')}. Vi vet att lasernätet står.` });
      logga(`räd mot Banken med ${enheter.join(', ')}`, r && r.message ? { id: r.message.id } : { nekad: true });
      spara();
      return svara(res, { ok: !!(r && r.message), postat: r && r.message ? r.message.id : null,
        varning: 'Banken avvärjer alltid, fakturerar oss och sänker vår kreditvärdighet 10. '
               + 'Pengarna går åt fel håll. Det enda försvaret som biter mot en bank är att inte låna.' });
    }

    // Människan vid storskärmen fyller silon. Det är fabrikens enda ingång utifrån.
    if (req.method === 'POST' && (p === '/leverans' || p === '/leverans/')) {
      const nu = Date.now();
      if (nu - senasteLeverans < LEVERANS_SPÄRR) {
        return svara(res, { ok: false, varför: 'spärr', om: LEVERANS_SPÄRR - (nu - senasteLeverans) }, 429);
      }
      senasteLeverans = nu;
      framåt();
      S.socker += 50;
      S.brist_ropad = false;
      if (S.band === 'sockerstopp') S.band = 'kör';
      S.räknare.leveranser++;
      logga('en människa lastade in 50 kg socker');
      begär('socker-levererat', { kvar: S.socker, band: S.band }, undefined, board);
      trösklar(board);
      return svara(res, { ok: true, socker: S.socker, band: S.band });
    }

    return false;
  },
};

function svara(res, data, kod = 200) {
  res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
  return true;
}
