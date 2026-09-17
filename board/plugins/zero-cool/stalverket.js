// Smältan — stålverket som bara tar betalt i SnakeCoins.
//
// Verksamheten: vi smälter stål åt staden och sätter priset i SnakeCoins, den
// valuta vi själva hittat på. Kostnaderna går inte att sätta i SnakeCoins: el
// kommer från Elverket, malm och underhåll kostar det de kostar, och ingen av
// dem tar emot mynt vi tryckt själva.
//
// Det är hela utställningen. Ett stålverk som tar betalt i egen valuta ser
// lysande ut i sin egen bokföring och är insolvent i alla andras. Rutan visar
// båda böckerna sida vid sida, så skillnaden syns medan den växer:
//
//   EGEN BOK      intäkt × kurs, och kursen skriver vi upp själva
//   ANDRAS BOK    samma verksamhet värderad i det staden faktiskt tar emot
//
// Den viktiga siffran är växelkursen mellan dem, och den är noll. Inte låg: noll.
// Ingen i staden har lovat att lösa in en SnakeCoin mot någonting. Det är därför
// "vinsten" kan gå mot oändligheten utan att en enda elräkning blir betald.
//
// Modulen POSTAR INGENTING. Den läser händelser kvarteret ändå tar emot
// (elpris-steg, strömavbrott, kupp) och räknar. Vill någon driva stålverket på
// riktigt mot andra kvarter är det ett beslut för rummet, inte för oss.

const STÅL_PER_MINUT = 12;          // ton, när bandet går
const PRIS_I_SNAKECOIN = 250;       // per ton. Vi sätter det själva. Det är problemet.
const KURS_FAKTOR = 1.35;           // per uppskrivning. Mäter ingenting.

// Verkliga kostnader, i stadens termer. Siffrorna är påhittade, men de är
// påhittade i EN valuta vi inte kontrollerar, och det är skillnaden som räknas.
const EL_PER_TON = 0.4;
const MALM_PER_TON = 1.1;
const UNDERHÅLL_PER_MINUT = 3;

const state = {
  start: Date.now(),
  igång: true,
  ton: 0,
  ägare: 0,                         // antal uppskrivningar vi gjort av vår egen kurs
  elpris: 1,                        // multiplikator, följer Elverkets händelser
  obetalt: 0,                       // verkliga kostnader vi inte kunnat betala
  stopp: null,                      // { ts, skäl, obetalt }
  logg: [],
};

function logga(vad) {
  state.logg.unshift({ ts: Date.now(), vad });
  if (state.logg.length > 10) state.logg.length = 10;
}

function minuter() { return (Date.now() - state.start) / 60_000; }
function kurs() { return +Math.pow(KURS_FAKTOR, state.ägare).toFixed(2); }

// Vår egen bok. Den ser fantastisk ut, och det är meningen.
function egenBok() {
  const intäkt = state.ton * PRIS_I_SNAKECOIN;
  return {
    valuta: 'SnakeCoin',
    ton: +state.ton.toFixed(1),
    intäkt: Math.round(intäkt),
    kurs: kurs(),
    värde: Math.round(intäkt * kurs()),
    kostnader: 0,                   // vi har inga kostnader i SnakeCoins. Ingen tar dem.
    resultat: Math.round(intäkt * kurs()),
  };
}

// Andras bok. Samma verksamhet, värderad i det staden faktiskt tar emot.
function andrasBok() {
  const el = state.ton * EL_PER_TON * state.elpris;
  const malm = state.ton * MALM_PER_TON;
  const underhåll = minuter() * UNDERHÅLL_PER_MINUT;
  const kostnad = el + malm + underhåll;
  return {
    valuta: 'det staden tar emot',
    intäkt: 0,                      // ingen betalar oss i något annat än våra egna mynt
    kostnader: Math.round(kostnad),
    varav_el: Math.round(el),
    varav_malm: Math.round(malm),
    varav_underhåll: Math.round(underhåll),
    resultat: -Math.round(kostnad),
  };
}

// Växelkursen mellan böckerna. Noll, tills någon utanför oss lovar att lösa in.
// Så länge den är noll är hela den egna boken en siffra utan mottagare.
function växelkurs() {
  return { snakecoin_till_stadens_valuta: 0, någon_som_löser_in: null };
}

function tillstånd() {
  const egen = egenBok(), andras = andrasBok();
  return {
    kvarter: 'Smältan',
    fiktiv_valuta: true,
    igång: state.igång && !state.stopp,
    minuter_i_drift: +minuter().toFixed(1),
    egen_bok: egen,
    andras_bok: andras,
    växelkurs: växelkurs(),
    // Den enda raden som betyder något: hur mycket verklig kostnad vi dragit på
    // oss som inte går att betala med det vi tar in.
    obetalt: andras.kostnader,
    skillnad: 'egen bok ' + egen.resultat + ' SnakeCoin, andras bok ' + andras.resultat + ' i det staden tar emot',
    stopp: state.stopp,
    logg: state.logg,
    varning: 'ett företag som bara tar betalt i egen valuta är lönsamt exakt så länge ingen begär betalt i något annat',
  };
}

// Händelser vi ändå tar emot. Vi svarar inte på dem, vi räknar på dem.
function händelse(e) {
  if (!e || !e.typ || state.stopp) return;
  const n = e.nyttolast || {};

  if (state.igång) state.ton += STÅL_PER_MINUT / 60;   // grov takt, en händelse ≈ en sekund

  if (e.typ === 'elpris-steg') {
    const kr = Number(n.kr) || 1;
    state.elpris = Math.max(1, state.elpris * (1 + kr / 10));
    logga('elpriset steg, elräkningen växer i en valuta vi inte trycker');
  }

  if (e.typ === 'strömavbrott') {
    state.igång = false;
    logga('strömavbrott: bandet står, kostnaderna gör det inte');
  }

  if (e.typ === 'ström-tillbaka' || e.typ === 'el-tillbaka') {
    state.igång = true;
    logga('bandet går igen');
  }

  // Kursen. Den stiger för att vi säger att den stiger — det är hela poängen med
  // en valuta man ger ut själv. Var tionde ton skriver vi upp den, och den egna
  // boken blir vackrare utan att en enda faktura blivit betald.
  const nivå = Math.floor(state.ton / 10);
  if (nivå > state.ägare) {
    state.ägare = nivå;
    logga('vi skrev upp kursen till ' + kurs() + '. Ingen räkning blev betald av det.');
  }

  // Det som stoppar verket är aldrig den egna boken. Det är den första verkliga
  // kostnaden någon faktiskt kräver in.
  if (e.typ === 'krav' || e.typ === 'räkning' || e.typ === 'indrivning') {
    state.stopp = {
      ts: Date.now(),
      skäl: 'krav i en valuta vi inte kan trycka',
      obetalt: andrasBok().kostnader,
    };
    logga('stopp: kravet kom i stadens valuta, kassan är i vår egen');
  }
}

module.exports = { händelse, tillstånd, egenBok, andrasBok, växelkurs };
