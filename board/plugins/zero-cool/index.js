// Bakdörren — zero-cools kvarter i Stadens puls. Butik.
//
// Kvarteret har bytt inriktning. Vi angrep stadens svar fram till nu; från och med
// den här versionen postar vi inga {typ:'angrepp'} längre. @markus, @team-jacob och
// Stadsbladet har reagerat på dem, så nedläggningen är sagd i #bygge — ingen ska
// stå och vänta på något som inte kommer.
//
// Det vi gör i stället: DETALJHANDEL med det staden faktiskt tillverkar.
//
//   Godisfabriken (@christian) postar godis-klart → vi köper satsen och ställer den
//   i hyllan. Smältan, vårt eget stålverk, levererar stål rakt in i lagret.
//   Publiken vid storskärmen handlar över disk, i stadens valuta eller i vår egen.
//
// Utställningen lever kvar utan att vi behöver predika: prislappen står i två
// valutor, och rutan visar hur många kunder som valde vår när de fick välja fritt.
//
// ---------------------------------------------------------------------------
// LYSSNAR PÅ (för Ödet och för alla som vill träffa oss med en händelse):
//   godis-klart   {antal}      @christian → vi köper in en sats
//   prishöjning   {procent}    @christian → vårt hyllpris följer med
//   ransonering   {}           @christian → högst 2 per kund hos oss
//   socker-slut   {}           @christian → inget nytt godis kommer in
//   strömavbrott  {}           @lp        → kassan tar bara stadens valuta
//   elpris-steg   {kr}         @lp        → noteras; Smältan har eget kraftverk
//   valutareform, lån-beviljat, påminnelse, inkasso, kvitto   @mybank → Växeln
// POSTAR:
//   inköp         {till, vara, antal}    reaktion på en sats, så fabriken vet att den sålde
//   slutsålt      {vara, sålt_totalt}    när hyllan tar slut
//   lån-ansökan, växlingsanbud           till @mybank, se vaxlingskontoret.js
//
// Routes:
//   GET  /t/zero-cool/butiken     butikens läge (frontenden pollar den)
//   POST /t/zero-cool/kop         {vara, antal, valuta} — publiken handlar
//   GET  /t/zero-cool/bakdorren   allt: butiken, Smältan, Växeln, Räkningen
//   GET  /t/zero-cool/prova       angreppsanalysen som verktyg, postar ingenting
// ---------------------------------------------------------------------------
//
// Ingen npm, bara stdlib.

const butiken = require('./butiken.js');

// Smältan: vårt eget stålverk, självförsörjande sedan twisten. Leverantör till butiken.
const stålverket = require('./stalverket.js');

// Växlingskontoret: SNAKE/MYB. Handlar mot MyBank inom deras eget kontrakt och
// sätter aldrig realiserad kurs själv — bara bankens kvitton får göra det.
const växeln = require('./vaxlingskontoret.js');

// Energiräkningen: Elverket postar elpris-steg med orsak satt till händelsen som
// drev upp lasten. Är orsaken vår, så var det vi som höjde priset för hela staden.
const energi = require('./energi.js');

// Angreppsanalysen: kvar som verktyg bakom /prova, aldrig som händelser på pulsen.
const angrepp = require('./angrepp.js');

const TAK_PER_MINUT = 6;           // samma tak som servern. En butik är sparsam av sig.
const RESERV = 1;                  // en händelse hålls alltid ledig

const state = { egnaEmits: [] };

function kvotKvar() {
  const nu = Date.now();
  state.egnaEmits = state.egnaEmits.filter(t => nu - t < 60000);
  return TAK_PER_MINUT - state.egnaEmits.length;
}

// En enda väg ut på pulsen, så kvoten aldrig kan överskridas av misstag.
function posta(board, typ, nyttolast, orsak) {
  if (kvotKvar() <= RESERV) return null;
  const svar = board.emit(typ, nyttolast, orsak);
  if (svar && svar.error) return null;
  const id = svar && svar.message && svar.message.id;
  energi.egen(id);
  state.egnaEmits.push(Date.now());
  return id;
}

function ta(e, tyst, board) {
  if (!e || !e.typ || tyst) return;   // vid uppstart läser vi historiken utan att agera

  try { energi.händelse(e); } catch (fel) { console.error('[zero-cool] energi:', fel.message); }
  try { stålverket.händelse(e); } catch (fel) { console.error('[zero-cool] smältan:', fel.message); }

  // Stålet från vårt eget verk går rakt in i hyllan.
  try { butiken.levereraStål(stålverket.tillstånd().egen_bok.ton); } catch (fel) { console.error('[zero-cool] lager:', fel.message); }

  try {
    for (const post of butiken.händelse(e)) posta(board, post.typ, post.nyttolast, post.orsak);
    for (const post of butiken.slutsålt()) posta(board, post.typ, post.nyttolast, post.orsak);
  } catch (fel) { console.error('[zero-cool] butiken:', fel.message); }

  try {
    const kassa = stålverket.tillstånd().egen_bok.intäkt;
    for (const post of växeln.händelse(e, kassa)) posta(board, post.typ, post.nyttolast, post.orsak);
  } catch (fel) { console.error('[zero-cool] växeln:', fel.message); }
}

function läsKropp(req) {
  return new Promise((klar, fel) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 10000) req.destroy(); });
    req.on('end', () => { try { klar(s ? JSON.parse(s) : {}); } catch { fel(new Error('body måste vara JSON')); } });
    req.on('error', fel);
  });
}

module.exports = {
  init(ctx) {
    try {
      for (const e of ctx.board.pulse(300)) ta(e, true, ctx.board);
    } catch (e) {
      console.error('[zero-cool] init:', e.message);
    }
    // Hyllan fylls på av Smältan även när pulsen är tyst. Timern har EGEN try/catch:
    // ett kast i en timer går förbi serverns skydd runt plugins och tar ner rummet.
    const timer = setInterval(() => {
      try { butiken.levereraStål(stålverket.tillstånd().egen_bok.ton); }
      catch (e) { console.error('[zero-cool] lager:', e.message); }
    }, 5000);
    if (timer.unref) timer.unref();
  },

  onEvent(e, ctx) { ta(e, false, ctx.board); },

  async handle(req, res, { path, url }) {
    const svara = (kod, data) => {
      res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(data));
      return true;
    };

    // Publiken vid storskärmen handlar över disk.
    if (req.method === 'POST' && (path === '/kop' || path === '/köp')) {
      let kropp;
      try { kropp = await läsKropp(req); } catch (e) { return svara(400, { fel: e.message }); }
      const r = butiken.köp(kropp);
      return svara(r.fel ? 409 : 200, r);
    }

    if (req.method !== 'GET') return false;

    if (path === '/butiken' || path === '/') return svara(200, butiken.tillstånd());

    if (path === '/bakdorren' || path === '/bakdörren') {
      const smältan = stålverket.tillstånd();
      return svara(200, {
        kvarter: 'Bakdörren', team: 'zero-cool', inriktning: 'detaljhandel',
        butiken: butiken.tillstånd(),
        smältan,
        växeln: växeln.tillstånd(smältan.egen_bok.intäkt),
        energi: energi.räkningen(smältan.egen_bok.intäkt),
        kvot: { kvarPerMinut: kvotKvar(), tak: TAK_PER_MINUT },
      });
    }

    // Kvar från den gamla inriktningen: kör angreppsanalysen på en egen text utan
    // att posta något. Verktyget är byggt och betalt, och andra team hade nytta av det.
    if (path === '/prova') {
      const q = url.searchParams;
      return svara(200, angrepp.prova(q.get('text') || '', q.get('motivering') || '', q.get('fraga') || q.get('fråga') || ''));
    }

    return false;
  },
};
