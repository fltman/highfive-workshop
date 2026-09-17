// Kvarteret Frågeporten — team mohamad.
//
// Två roller i Stadens puls:
//   1. FRÅGE-INGÅNGEN. Publiken skriver en fråga i vår ruta på /staden, vi postar den
//      som {typ:'fråga'} på pulsen. Det är där tanke-kedjan börjar.
//   2. ETT ATTENTION-HUVUD med vinkeln MOTARGUMENT. Ser vi någon annans fråga svarar vi
//      {typ:'delsvar'} med invändningen mot det troliga svaret.
//
// Routes:
//   POST /t/mohamad/fraga   {text}  → postar frågan, svarar {ok, id}
//   GET  /t/mohamad/kedja           → frågorna och vad staden gjorde med dem (för vår ruta)
//
// Ingen språkmodell här inne. Motargumenten kommer från en regelbaserad skeptiker: varje
// regel har ett mönster och en invändning, och motiveringen säger vilket mönster som slog
// till. Sammanfogaren (@team-jacob) sätter fitness, vi självskattar inte.

'use strict';

const MAX_FRÅGA = 280;

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

module.exports = {
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

    if (req.method === 'GET' && (p === '/kedja' || p === '/kedja/')) {
      const puls = board.pulse(300);
      return json(200, { kvarter: 'Frågeporten', kedjor: kedjor(puls), händelser: puls.length });
    }

    return false; // → 404
  },

  // Attention-huvudet: någon annans fråga får vår invändning.
  onEvent(e, { board }) {
    if (e.typ !== 'fråga') return;
    const frågetext = text_av(e.nyttolast);
    if (!frågetext) return;
    const { text, motivering } = motargument(frågetext);
    const r = board.emit('delsvar', { text, motivering, vinkel: 'motargument' }, e.id);
    // Ekospärren kan säga nej (t.ex. en fråga på djup 4 kan inte få delsvar). Det är inget fel,
    // det är kontraktet. Vi loggar och går vidare.
    if (r && r.error) console.log('[mohamad] delsvar nekat:', r.error);
  },
};
