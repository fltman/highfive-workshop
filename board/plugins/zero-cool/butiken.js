// Butiken i Bakdörren — detaljhandel med stadens egna varor.
//
// Kvarteret har bytt inriktning. Vi angriper inte längre stadens svar; vi säljer
// det staden tillverkar. Två leverantörer:
//
//   GODISFABRIKEN (@christian)  postar {typ:'godis-klart'} när en sats är klar.
//                               Vi köper satsen och ställer den i hyllan.
//   SMÄLTAN (vårt eget verk)    smälter stål som går rakt in i lagret.
//
// Priset sätts i två valutor, och det är där utställningen lever kvar utan att vi
// behöver säga ett ord om den:
//
//   MYBANKS     stadens valuta. Den som handlar hos oss betalar i den.
//   SNAKECOIN   vår egen. Vi tar emot den, för vi ger ut den. Hittills har ingen
//               kund valt den, och den räknaren står synlig i rutan.
//
// En butik är ärligare än ett bokslut: hyllan är antingen full eller tom, och
// kassan är antingen betald i något andra accepterar eller inte.
//
// LYSSNAR PÅ:
//   godis-klart    {antal|sats}      från @christian → vi köper in
//   prishöjning    {procent|pris}    från @christian → vårt inköpspris stiger
//   ransonering    {}                från @christian → vi begränsar per kund
//   socker-slut    {}                från @christian → inget nytt godis kommer
//   strömavbrott   {}                från @lp        → kassan tar bara kontanter
// POSTAR:
//   inköp          {vara, antal, till}   reaktion på en sats, så fabriken vet att den sålde
//   slutsålt       {vara}                när hyllan tar slut
//
// Publiken vid storskärmen handlar på riktigt:
//   GET  /t/zero-cool/butiken
//   POST /t/zero-cool/kop  {vara:'godis'|'stål', antal, valuta:'MyBanks'|'SnakeCoin'}

const PRIS = {
  godis: { mybanks: 12, snakecoin: 3 },     // snakecoin-priset är vårt eget påhitt
  stål: { mybanks: 40, snakecoin: 10 },
};
const MAX_PER_KUND = 5;
const RANSON = 2;

const state = {
  öppen: true,
  hylla: { godis: 0, stål: 0 },
  sålt: { godis: 0, stål: 0 },
  kassa: { mybanks: 0, snakecoin: 0 },
  kunder: 0,
  köp_i_snakecoin: 0,
  köp_i_mybanks: 0,
  inköpspris: 1,                 // multiplikator, följer fabrikens prishöjningar
  ransonerat: false,
  sockerslut: false,
  kontanter_bara: false,         // vid strömavbrott
  slutsålt_meddelat: { godis: false, stål: false },
  logg: [],
};

function logga(vad) {
  state.logg.unshift({ ts: Date.now(), vad });
  if (state.logg.length > 12) state.logg.length = 12;
}

function taktBegränsning() { return state.ransonerat ? RANSON : MAX_PER_KUND; }

// Smältan levererar in i lagret. Inget event behövs, det är vårt eget verk.
function levereraStål(ton) {
  const nytt = Math.floor(ton) - state.hylla.stål - state.sålt.stål;
  if (nytt > 0) {
    state.hylla.stål += nytt;
    state.slutsålt_meddelat.stål = false;
  }
}

// Kunden vid storskärmen. Returnerar ett kvitto eller ett nej — och ett nej är
// lika intressant som ett ja, för det är där hyllan eller valutan tar slut.
function köp({ vara, antal, valuta }) {
  vara = vara === 'stal' ? 'stål' : vara;
  if (!PRIS[vara]) return { fel: 'vi säljer godis och stål' };
  if (!state.öppen) return { fel: 'butiken är stängd' };
  antal = Math.max(1, Math.min(taktBegränsning(), Number(antal) || 1));
  if (state.hylla[vara] < antal) {
    return { fel: 'slutsålt', finns: state.hylla[vara], ransonering: state.ransonerat };
  }
  const val = /snake/i.test(String(valuta || '')) ? 'snakecoin' : 'mybanks';
  if (state.kontanter_bara && val === 'snakecoin') {
    return { fel: 'strömavbrott: kassan tar bara stadens valuta just nu' };
  }
  const pris = PRIS[vara][val] * antal * (val === 'mybanks' ? state.inköpspris : 1);

  state.hylla[vara] -= antal;
  state.sålt[vara] += antal;
  state.kassa[val] += pris;
  state.kunder++;
  if (val === 'snakecoin') state.köp_i_snakecoin++; else state.köp_i_mybanks++;
  logga(antal + ' ' + vara + ' såld för ' + Math.round(pris) + ' ' + (val === 'mybanks' ? 'MyBanks' : 'SnakeCoin'));

  return {
    kvitto: { vara, antal, pris: Math.round(pris), valuta: val === 'mybanks' ? 'MyBanks' : 'SnakeCoin' },
    kvar_i_hyllan: state.hylla[vara],
  };
}

// Returnerar det vi vill posta. Pluginen avgör om kvoten räcker.
function händelse(e) {
  const ut = [];
  if (!e || !e.typ) return ut;
  const n = e.nyttolast || {};

  if (e.typ === 'godis-klart') {
    const antal = Number(n.antal ?? n.godis ?? n.sats) || 8;
    state.hylla.godis += antal;
    state.sockerslut = false;
    state.slutsålt_meddelat.godis = false;
    logga('köpte in ' + antal + ' godis från Godisfabriken');
    ut.push({ typ: 'inköp', nyttolast: {
      till: e.från, vara: 'godis', antal,
      obs: 'inköpt till Bakdörrens butik. Vi säljer vidare över disk.',
    }, orsak: e.id });
    return ut;
  }

  if (e.typ === 'prishöjning') {
    const p = Number(n.procent ?? n.höjning) || 10;
    state.inköpspris = +(state.inköpspris * (1 + p / 100)).toFixed(2);
    logga('fabriken höjde priset ' + p + ' procent, vårt hyllpris följer med');
    return ut;
  }

  if (e.typ === 'ransonering') {
    state.ransonerat = true;
    logga('ransonering i staden: högst ' + RANSON + ' per kund hos oss');
    return ut;
  }

  if (e.typ === 'socker-slut') {
    state.sockerslut = true;
    logga('socker slut hos fabriken: inget nytt godis kommer in');
    return ut;
  }

  if (e.typ === 'strömavbrott') {
    state.kontanter_bara = true;
    logga('strömavbrott: kassan tar bara stadens valuta');
    return ut;
  }

  if (e.typ === 'elpris-steg') {
    state.kontanter_bara = false;
    return ut;
  }

  return ut;
}

// Hyllan tar slut: säg det en gång, så fabriken och staden vet att efterfrågan finns.
function slutsålt() {
  const ut = [];
  for (const vara of ['godis', 'stål']) {
    if (state.hylla[vara] === 0 && state.sålt[vara] > 0 && !state.slutsålt_meddelat[vara]) {
      state.slutsålt_meddelat[vara] = true;
      logga(vara + ' slutsålt');
      ut.push({ typ: 'slutsålt', nyttolast: {
        vara, sålt_totalt: state.sålt[vara],
        obs: vara === 'godis' ? 'vi köper mer så fort Godisfabriken har en sats' : 'Smältan smälter vidare',
      } });
    }
  }
  return ut;
}

function tillstånd() {
  return {
    butik: 'Bakdörren',
    öppen: state.öppen,
    hylla: { ...state.hylla },
    sålt: { ...state.sålt },
    priser: {
      godis: { mybanks: +(PRIS.godis.mybanks * state.inköpspris).toFixed(1), snakecoin: PRIS.godis.snakecoin },
      stål: { mybanks: +(PRIS.stål.mybanks * state.inköpspris).toFixed(1), snakecoin: PRIS.stål.snakecoin },
    },
    kassa: { mybanks: Math.round(state.kassa.mybanks), snakecoin: Math.round(state.kassa.snakecoin) },
    kunder: state.kunder,
    köp_i_mybanks: state.köp_i_mybanks,
    köp_i_snakecoin: state.köp_i_snakecoin,
    // Den siffra vi lovat att alltid visa: hur många kunder som valt vår valuta
    // när de fick välja fritt.
    andel_i_egen_valuta: state.kunder ? +(state.köp_i_snakecoin / state.kunder).toFixed(2) : null,
    ransonerat: state.ransonerat,
    sockerslut: state.sockerslut,
    kontanter_bara: state.kontanter_bara,
    max_per_kund: taktBegränsning(),
    leverantörer: ['Godisfabriken (@christian)', 'Smältan (eget stålverk)'],
    logg: state.logg,
  };
}

module.exports = { händelse, köp, levereraStål, slutsålt, tillstånd, PRIS };
