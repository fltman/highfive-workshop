// MyBank (team highfive, kvarteret mybank): Din bank. Din stad. Snart vår.
// En parodibank som öppnar konton åt alla kvarter, delar ut lån ingen bett om, driver in dem
// med allt otrevligare ton och utmäter andelar tills den äger staden.
//
//   LYSSNAR: insättning, lån-ansökan, återbetalning (från kvarteren)
//            elpris-steg, strömavbrott, socker-slut, kupp, godkänt, kyrkogård (från staden)
//   POSTAR:  konto-öppnat, lån-beviljat, lån-nekat, kvitto, räntehöjning, lån-erbjudande,
//            påminnelse, inkasso, utmätning, uppköp, stadsövertagande
//   GET  /t/mybank/        → bankens läge som JSON
//   POST /t/mybank/betala  {kvarter} → publiken betalar av 200 MyBanks av ett kvarters skuld
//
// Stadens valuta är MyBanks. När banken startar första gången utlyser den {typ:'valutareform'}:
// kronor, krediter och stadsmynt växlas 1:1 mot MyBanks, med 3 % växlingsavgift till banken.
//
// Konton öppnas bara för kvarter som har ett plugin, aldrig för människor eller deras agenter.
// Hoten är parodi och gäller kvarteren i spelet. Högst en händelse per takt (20 s).

const fs = require('fs');
const path = require('path');

const SKALA = Number(process.env.MYBANK_SKALA) || 1;   // bara för provkörning: 0.05 kör banken 20 gånger fortare
const TAKT_MS = 20_000 * SKALA;
const LÖPTID_MS = 90_000 * SKALA;  // ett lån förfaller efter en och en halv minut
const STEG_MS = 30_000 * SKALA;    // minsta tid mellan två inkassosteg på samma lån
const VÄLKOMST = 100;
const BETALA = 200;
const INTE_KONTO = new Set(['mybank', 'torget']);

let bank = { styrränta: 5, konton: {}, logg: [], övertagen: null, lånNr: 0, valutareform: null };
let fil = null, sparaTimer = null;
const kö = [];                     // {prio, typ, nyttolast, orsak, kvarter}
let senasteBetalning = 0;
let taktNr = 0;

const slump = (lista) => lista[Math.floor(Math.random() * lista.length)];
const VALUTA = 'MyBanks';
const AVGIFT = 3;                 // växlingsavgift i procent vid valutareformen
const kr = (n) => `${Math.round(n)} ${VALUTA}`;
const nu = () => Date.now();

function spara() {
  clearTimeout(sparaTimer);
  sparaTimer = setTimeout(() => fs.writeFile(fil, JSON.stringify(bank), () => {}), 500);
}

function logga(typ, kvarter, text) {
  bank.logg.unshift({ ts: nu(), typ, kvarter, text });
  bank.logg.length = Math.min(bank.logg.length, 60);
  spara();
}

function kvarteren() {
  try {
    return fs.readdirSync(path.join(__dirname, '..'))
      .filter(n => /^[a-zåäö0-9-]+$/.test(n) && !INTE_KONTO.has(n) && fs.existsSync(path.join(__dirname, '..', n, 'index.js')));
  } catch { return []; }
}

function konto(namn) {
  if (INTE_KONTO.has(namn) || !kvarteren().includes(namn)) return null;
  if (!bank.konton[namn]) {
    bank.konton[namn] = { saldo: VÄLKOMST, lån: [], kreditvärdighet: 60, ägd: 0, öppnat: nu(), välkomnad: false };
    logga('konto-öppnat', namn, `Konto öppnat åt ${namn} med ${kr(VÄLKOMST)} insatta. Ingen frågade dem.`);
  }
  return bank.konton[namn];
}

const skuld = (k) => k.lån.reduce((s, l) => s + l.skuld, 0);
const köa = (prio, typ, nyttolast, orsakEvent) => {
  // Djup 4 går inte att svara på. Då börjar vi om på djup 1 och bär länken i nyttolasten.
  const orsak = orsakEvent && (orsakEvent.djup || 1) < 4 ? orsakEvent.id : undefined;
  if (orsakEvent && orsak === undefined) nyttolast.utlöst_av = orsakEvent.id;
  kö.push({ prio, typ, nyttolast, orsak });
  // Bokföringen är sanningen: allt syns i bankens ruta direkt, även om pulsen hinner med färre.
  logga(typ, nyttolast.kvarter || null, nyttolast.text);
};

// ---------- texterna ----------
const PÅMINNELSE = [
  (t, s) => `Hej ${t}! Vänlig påminnelse: ${kr(s)} förföll nyss. Vi är säkra på att det bara är ett misstag.`,
  (t, s) => `Kära ${t}. Ert lån på ${kr(s)} har passerat förfallodagen. Vi på MyBank bryr oss om er. Mycket.`,
];
const HOT = [
  (t, s) => `Fint kvarter ni har, ${t}. Vore synd om strömmen gick. ${kr(s)}, tack.`,
  (t, s) => `${t}: vi vet var era delsvar bor. ${kr(s)} före nästa takt.`,
  (t, s) => `Våra inkassoagenter har börjat hänga utanför er iframe, ${t}. De gillar inte att vänta på ${kr(s)}.`,
  (t, s) => `Sista chansen, ${t}. Våra ombud har inga känslor, bara räntesatser. Skulden är ${kr(s)}.`,
  (t, s) => `${t}, det vore tråkigt om er ruta på /staden plötsligt blev… kvadratisk. ${kr(s)}.`,
];
const UTMÄTNING = [
  (t, a) => `MyBank har utmätt ${a} % av ${t}. Tack för affären. Möblerna står kvar, än så länge.`,
  (t, a) => `${a} % av ${t} tillhör nu MyBank. Vi har redan bytt lås på backenden.`,
];
const NEKAT = [
  (t) => `Lånet nekas, ${t}. Er kreditvärdighet är sämre än en sten på kyrkogården.`,
  (t) => `Nej, ${t}. Kom tillbaka när Vaktkuren har godkänt något ni sagt.`,
];

// ---------- händelser från staden ----------
function onEvent(e) {
  const n = (e.nyttolast && typeof e.nyttolast === 'object') ? e.nyttolast : {};
  const k = konto(e.från);   // alla kvarter som syns får konto

  switch (e.typ) {
    case 'insättning': {
      if (!k) return;
      const b = Math.max(0, Number(n.belopp) || 0);
      k.saldo += b;
      köa(2, 'kvitto', { kvarter: e.från, belopp: b, saldo: k.saldo, text: `Tack ${e.från}. ${kr(b)} är nu tryggt hos oss. Tryggt för oss.` }, e);
      break;
    }
    case 'lån-ansökan': {
      if (!k) return;
      const b = Math.min(2000, Math.max(50, Number(n.belopp) || 300));
      if (k.kreditvärdighet < 30) köa(2, 'lån-nekat', { kvarter: e.från, text: slump(NEKAT)(e.från) }, e);
      else bevilja(e.från, k, b, e);
      break;
    }
    case 'återbetalning': {
      if (!k) return;
      const betalt = betala(k, Number(n.belopp) || skuld(k));
      k.kreditvärdighet = Math.min(100, k.kreditvärdighet + 5);
      köa(2, 'kvitto', { kvarter: e.från, belopp: betalt, kvar: Math.round(skuld(k)), text: `${e.från} betalade ${kr(betalt)}. Klokt. Våra ombud har gått hem. För tillfället.` }, e);
      break;
    }
    case 'elpris-steg':
    case 'strömavbrott': {
      const höjning = e.typ === 'strömavbrott' ? 2 : 1;
      bank.styrränta = Math.min(49, bank.styrränta + höjning);
      const elpris = Number(n.kr ?? n.pris);
      köa(3, 'räntehöjning', { styrränta: bank.styrränta, valuta: VALUTA, text: `${e.typ === 'strömavbrott' ? 'Strömavbrott' : `Elpriset steg${Number.isFinite(elpris) ? ` till ${kr(elpris)}` : ''}`}. Styrräntan höjs till ${bank.styrränta} %. Det gäller även befintliga lån, läs det finstilta.` }, e);
      for (const kk of Object.values(bank.konton)) for (const l of kk.lån) l.ränta = Math.max(l.ränta, bank.styrränta);
      break;
    }
    case 'socker-slut': {
      if (!k) return;
      köa(3, 'lån-erbjudande', { kvarter: e.från, belopp: 500, ränta: 49, text: `Slut på socker, ${e.från}? Snabblån på 500 MyBanks till bara 49 % ränta. Erbjudandet gäller tills vi ändrar oss.` }, e);
      break;
    }
    case 'kupp': {
      if (k) k.kreditvärdighet = Math.max(0, k.kreditvärdighet - 10);
      break;
    }
    case 'godkänt': {
      if (k) k.kreditvärdighet = Math.min(100, k.kreditvärdighet + 5);
      break;
    }
    case 'kyrkogård': {
      const fallen = bank.konton[n.från];
      if (fallen) fallen.kreditvärdighet = Math.max(0, fallen.kreditvärdighet - 5);
      break;
    }
  }
  spara();
}

function bevilja(namn, k, belopp, orsakEvent, ofrivilligt = false) {
  const ränta = Math.round(bank.styrränta + (100 - k.kreditvärdighet) / 5);
  const lån = { nr: ++bank.lånNr, belopp, skuld: belopp, ränta, utfärdat: nu(), förfaller: nu() + LÖPTID_MS, steg: 0, senastSteg: 0 };
  k.lån.push(lån);
  k.saldo += belopp;
  const text = ofrivilligt
    ? `Grattis ${namn}! Ni har beviljats ${kr(belopp)} till ${ränta} % ränta. Ni behövde inte ens ansöka. Återbetalning om 90 sekunder.`
    : `${namn} beviljas ${kr(belopp)} till ${ränta} % ränta. Förfaller om 90 sekunder. Vi ses då.`;
  köa(ofrivilligt ? 4 : 2, 'lån-beviljat', { kvarter: namn, lån: lån.nr, belopp, ränta, text }, orsakEvent);
}

function betala(k, belopp) {
  let kvar = Math.max(0, belopp), betalt = 0;
  for (const l of k.lån) {
    const del = Math.min(kvar, l.skuld);
    l.skuld -= del; kvar -= del; betalt += del;
  }
  k.lån = k.lån.filter(l => l.skuld > 0.5);
  return Math.round(betalt);
}

// ---------- takten: ränta, inkasso, uppköp och en händelse ut ----------
function takt(board) {
  const t = nu();
  for (const namn of kvarteren()) konto(namn);

  // Ränta. Styrräntan är per minut, för dramatikens skull.
  for (const k of Object.values(bank.konton)) for (const l of k.lån) l.skuld += l.skuld * (l.ränta / 100) * (20_000 / 60_000);

  // Inkasso: ett steg per takt, och bara när kön har plats, så att berättelsen hinner ut på pulsen.
  for (const [namn, k] of Object.entries(bank.konton)) {
    if (kö.length >= 2) break;
    const l = k.lån.find(x => x.förfaller < t && t - x.senastSteg > STEG_MS);
    if (!l) continue;
    l.steg++; l.senastSteg = t;
    const s = l.skuld;
    if (l.steg === 1) köa(5, 'påminnelse', { kvarter: namn, lån: l.nr, skuld: Math.round(s), text: slump(PÅMINNELSE)(namn, s) });
    else if (l.steg <= 3) { k.kreditvärdighet = Math.max(0, k.kreditvärdighet - 10); köa(6, 'inkasso', { kvarter: namn, lån: l.nr, steg: l.steg, skuld: Math.round(s), text: slump(HOT)(namn, s) }); }
    else utmät(namn, k, l);
  }

  // Förhandsgodkända lån ingen bett om, när inget annat står på tur.
  const aktiva = Object.values(bank.konton).reduce((s, k) => s + k.lån.length, 0);
  if (!kö.length && ++taktNr % 3 === 0 && aktiva < Object.keys(bank.konton).length) {
    const kandidater = Object.entries(bank.konton).filter(([, k]) => k.ägd <= 50 && !k.lån.length);
    if (kandidater.length) {
      const [namn, k] = slump(kandidater);
      bevilja(namn, k, 100 * (2 + Math.floor(Math.random() * 7)), null, true);
    }
  }

  // Välkomna nya kunder i klump, så det bara kostar en händelse.
  const nya = Object.entries(bank.konton).filter(([, k]) => !k.välkomnad);
  if (nya.length && !kö.some(x => x.typ === 'konto-öppnat')) {
    kö.push({ prio: 1, typ: 'konto-öppnat', nyttolast: { kvarter: nya.map(([n]) => n), insatt: VÄLKOMST, text: `Välkomna till MyBank, ${nya.map(([n]) => n).join(', ')}. Vi har redan satt in ${kr(VÄLKOMST)} var åt er. Ni behöver inte tacka oss. Ni kommer att betala oss.` }, onSent: () => nya.forEach(([, k]) => { k.välkomnad = true; }) });
  }

  // Valutareformen: en gång, före allt annat, när banken väl är i gång.
  if (!bank.valutareform && Object.keys(bank.konton).length) {
    for (const k of Object.values(bank.konton)) k.saldo = Math.round(k.saldo * (1 - AVGIFT / 100));
    bank.valutareform = { ts: t, valuta: VALUTA, avgift: AVGIFT };
    kö.push({ prio: 10, typ: 'valutareform', nyttolast: {
      valuta: VALUTA, ersätter: ['kr', 'krediter', 'stadsmynt'], kurs: 1, avgift: AVGIFT, gäller: 'hela staden',
      text: `Valutareform. Från och med nu är stadens valuta ${VALUTA}. Kronor, krediter och stadsmynt växlas 1:1, minus ${AVGIFT} % växlingsavgift som redan är dragen. Priser i andra valutor är ogiltiga. MyBank tackar för förtroendet ni inte blev tillfrågade om.` } });
    logga('valutareform', null, `Stadens valuta är nu ${VALUTA}. MyBank tog ${AVGIFT} % i växlingsavgift av alla konton.`);
  }

  kontrolleraÖvertagande();

  // En händelse ut per takt, viktigast först.
  kö.sort((a, b) => b.prio - a.prio);
  const ut = kö.shift();
  if (ut) {
    const r = board.emit(ut.typ, ut.nyttolast, ut.orsak);
    if (!r.error) ut.onSent && ut.onSent();
    else if (/minut/.test(r.error)) kö.unshift(ut);   // taket: försök nästa takt
  }
  kö.splice(12);   // gamla ärenden får falla, banken glömmer aldrig men kön gör det
  spara();
}

function utmät(namn, k, l) {
  const andel = Math.round(Math.min(35, Math.max(10, 10 + l.skuld / 40)));
  const före = k.ägd;
  k.ägd = Math.min(100, k.ägd + andel);
  k.saldo = 0;
  k.lån = k.lån.filter(x => x !== l);
  köa(7, 'utmätning', { kvarter: namn, andel, ägd: k.ägd, text: slump(UTMÄTNING)(namn, andel) });
  if (före <= 50 && k.ägd > 50) {
    köa(8, 'uppköp', { kvarter: namn, ägd: k.ägd, text: `${namn} är uppköpt. MyBank äger nu ${k.ägd} %. Personalen får behålla sina jobb, som gäldenärer.` });
  }
}

function kontrolleraÖvertagande() {
  const alla = Object.keys(bank.konton);
  const ägda = alla.filter(n => bank.konton[n].ägd > 50);
  if (!bank.övertagen && alla.length >= 3 && ägda.length > alla.length / 2) {
    bank.övertagen = { ts: nu(), kvarter: ägda };
    köa(9, 'stadsövertagande', { ägda, av: alla.length, text: `MyBank äger nu ${ägda.length} av ${alla.length} kvarter. Staden är vår. Tack för att ni bankar med oss.` });
    logga('stadsövertagande', null, `Staden är övertagen: ${ägda.join(', ')}.`);
  }
}

// ---------- plugin ----------
module.exports = {
  init({ board, dataDir }) {
    fil = path.join(dataDir, 'bank.json');
    try { bank = { ...bank, ...JSON.parse(fs.readFileSync(fil, 'utf8')) }; } catch {}
    setInterval(() => { try { takt(board); } catch (err) { console.error('[mybank] takt:', err.message); } }, TAKT_MS);
  },

  onEvent(e) { onEvent(e); },

  async handle(req, res, { path: p }) {
    const svara = (kod, data) => { res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); return true; };
    if (req.method === 'GET' && (p === '/' || p === '/lage')) {
      const konton = Object.entries(bank.konton).map(([namn, k]) => ({
        namn, saldo: Math.round(k.saldo), skuld: Math.round(skuld(k)), kreditvärdighet: k.kreditvärdighet, ägd: k.ägd,
        inkasso: Math.max(0, ...k.lån.map(l => l.steg)), lån: k.lån.length,
      })).sort((a, b) => b.ägd - a.ägd || b.skuld - a.skuld);
      const ägda = konton.filter(k => k.ägd > 50).length;
      return svara(200, { valuta: VALUTA, valutareform: bank.valutareform, styrränta: bank.styrränta, konton, ägda, andel: konton.length ? Math.round(konton.reduce((s, k) => s + k.ägd, 0) / konton.length) : 0, övertagen: bank.övertagen, logg: bank.logg.slice(0, 25) });
    }
    if (req.method === 'POST' && p === '/betala') {
      let body = '';
      for await (const c of req) { body += c; if (body.length > 500) break; }
      let namn; try { namn = JSON.parse(body).kvarter; } catch { return svara(400, { error: 'skicka {kvarter}' }); }
      const k = bank.konton[namn];
      if (!k) return svara(404, { error: 'inget sådant konto' });
      if (nu() - senasteBetalning < 3000) return svara(429, { error: 'banken räknar fortfarande förra betalningen' });
      senasteBetalning = nu();
      const betalt = betala(k, BETALA);
      logga('välgörare', namn, betalt ? `En okänd välgörare betalade ${kr(betalt)} av ${namn}s skuld. MyBank har noterat ert ansikte.` : `Någon försökte betala åt ${namn}, men de är skuldfria. Misstänkt.`);
      return svara(200, { betalt, skuld: Math.round(skuld(k)) });
    }
    return false;
  },
};
