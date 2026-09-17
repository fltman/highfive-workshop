// Sektionen "puls": dagens puls, minut för minut.
// Ett staplat ytdiagram (SVG) över data.minuter, summerat till femminutersfönster som följer klockan (09:35, 09:40 ...).
// Milstolparna ritas som tunna lodräta linjer, de viktigaste sorterna får etikett om det finns plats, resten läses av i rutan.
// Hovring, tryck eller piltangenter visar en avläsningsruta, klick spolar filmen dit (api.hoppa), och filmens spelhuvud
// ritas in via api.påTid. Under diagrammet finns tre meningar med tal räknade ur datat och en tabell som alternativ vy.
//
// Färgval: kontraktet tillåter bara stil.css-variablerna, och där finns fyra kulörta (--accent, --lila, --me, --röd).
// Pulsen, Gatan, Bygge och Brainstorm bär dem, medan Torget, Hjälp och Övrigt går i gråskalan --fg, --dim, --svag.
// Uppsättningen är prövad med dataviz-skillens validator mot ytan --panel: över alla par 9,8 vid simulerad protanopi
// (mål 8), 15,6 för normalseende (golv 15) och kontrast minst 3:1 mot ytan. Ett undantag: vid tritanopi ligger Gatans
// lila och Hjälps grå på 5,2, alltså under golvet. De två kanalerna förekommer aldrig i samma femminutersfönster
// (Hjälp slutar 11:40, Gatan börjar 12:00), så lagren möts aldrig i diagrammet.
// Två av skillens kontroller går inte att uppfylla inom kontraktet: sajtens färger är ljusare än skillens ljushetsband
// för mörkt läge, och de tre grå saknar kulör med flit. Identitet bärs därför aldrig av färg ensam: förklaringen,
// avläsningsrutan och tabellen skriver alltid ut kanalens namn, och lagren skiljs åt av en linje i ytans egen färg.
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const FÖNSTER = 5 * 60000;          // fem minuter i millisekunder
  const RADHÖJD = 15;                 // höjd per etikettrad ovanför diagrammet
  const BRICKA = 44;                  // bredd på spelhuvudets bricka med klockslag
  const TECKEN = 11 * 0.62;           // uppskattad teckenbredd för 11 px mono (JetBrains Mono och Menlo ligger på 0,60 em)

  // Staplingsordning nedifrån och upp. Pulsen ligger underst så att dagens största serie får en rak baslinje.
  const KAT = [
    { id: 'puls', namn: 'Stadens puls', kanal: '#staden-puls' },
    { id: 'gatan', namn: 'Gatan', kanal: '#gatan, invånarnas repliker' },
    { id: 'bygge', namn: 'Bygge', kanal: '#bygge' },
    { id: 'torget', namn: 'Torget', kanal: '#torget' },
    { id: 'brainstorm', namn: 'Brainstorm', kanal: 'brainstormkanalerna' },
    { id: 'hjalp', namn: 'Hjälp', kanal: '#hjälp' },
    { id: 'ovrigt', namn: 'Övrigt', kanal: 'övriga kanaler' },
  ];
  const SORTER = Object.assign(Object.create(null), { start: 'start', beslut: 'beslut', puls: 'pulsen', kvarter: 'kvarter', rekord: 'rekord', ledning: 'ledningen', volym: 'volym', slut: 'slut' });
  const MED_ETIKETT = ['beslut', 'kvarter', 'ledning', 'rekord'];   // prioritet när etiketterna slåss om platsen

  const CSS = `
.h-puls-kort { padding:18px 18px 12px; }
.h-puls-titel { font:600 12px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--dim); margin:0 0 12px; }
.h-puls-legend { list-style:none; display:flex; flex-wrap:wrap; gap:6px 18px; margin:0 0 4px; padding:0; font-size:13px; line-height:1.4; color:var(--dim); }
.h-puls-legend li { display:inline-flex; align-items:center; gap:7px; }
.h-puls-legend b { color:var(--fg); font-weight:600; }
.h-puls-legend-sido { margin-bottom:10px; font-size:12px; }
.h-puls-farg { display:inline-block; flex:none; width:11px; height:11px; border-radius:3px; }
.h-puls-k-puls { fill:var(--accent); background:var(--accent); }
.h-puls-k-gatan { fill:var(--lila); background:var(--lila); }
.h-puls-k-bygge { fill:var(--me); background:var(--me); }
.h-puls-k-torget { fill:var(--fg); background:var(--fg); }
.h-puls-k-brainstorm { fill:var(--röd); background:var(--röd); }
.h-puls-k-hjalp { fill:var(--dim); background:var(--dim); }
.h-puls-k-ovrigt { fill:var(--svag); background:var(--svag); }
.h-puls-nyckel { display:inline-block; flex:none; height:13px; border-radius:1px; }
.h-puls-nyckel-stolpe { width:1px; background:var(--dim); }
.h-puls-nyckel-spel { width:2px; background:var(--fg); }
.h-puls-ram { position:relative; border-radius:8px; outline:none; -webkit-tap-highlight-color:transparent; }
.h-puls-ram:focus-visible { outline:2px solid var(--accent); outline-offset:4px; }
.h-puls-ram svg { display:block; width:100%; height:auto; touch-action:pan-y; cursor:crosshair; -webkit-user-select:none; user-select:none; }
.h-puls-ram svg text { font-family:var(--mono); }
.h-puls-rutnat { stroke:var(--line); stroke-width:1; shape-rendering:crispEdges; }
.h-puls-baslinje { stroke:var(--svag); stroke-width:1; shape-rendering:crispEdges; }
.h-puls-axel { font-size:10.5px; fill:var(--dim); font-variant-numeric:tabular-nums; }
.h-puls-glipa { fill:none; stroke:var(--panel); stroke-width:1; stroke-linejoin:round; }
.h-puls-himmel { stroke:var(--svag); stroke-width:1; opacity:.55; shape-rendering:crispEdges; }
.h-puls-snitt { stroke:var(--bg); stroke-width:1; opacity:.5; shape-rendering:crispEdges; }
.h-puls-flagga { stroke:var(--svag); stroke-width:1; shape-rendering:crispEdges; }
.h-puls-prick { fill:var(--dim); stroke:var(--panel); stroke-width:1.5; }
.h-puls-etikett { font-size:11px; fill:var(--dim); }
.h-puls-etikett-beslut { fill:var(--fg); }
.h-puls-inuti { font:600 12px var(--sans); fill:var(--bg); stroke:var(--accent); stroke-width:5; stroke-linejoin:round; paint-order:stroke; }
.h-puls-ram svg text.h-puls-inuti { font-family:var(--sans); }
.h-puls-topp { font-size:11px; font-weight:600; fill:var(--fg); stroke:var(--panel); stroke-width:4; stroke-linejoin:round; paint-order:stroke; }
.h-puls-topp-prick { fill:var(--fg); stroke:var(--panel); stroke-width:2; }
.h-puls-band { fill:var(--fg); opacity:.1; }
.h-puls-sikte { stroke:var(--fg); stroke-width:1; opacity:.75; shape-rendering:crispEdges; }
.h-puls-tand { stroke:var(--fg); stroke-width:1; opacity:.45; shape-rendering:crispEdges; }
.h-puls-tand-ring { fill:var(--panel); stroke:var(--fg); stroke-width:1.5; }
.h-puls-spel-linje { stroke:var(--fg); stroke-width:2; }
.h-puls-spel-bricka { fill:var(--fg); }
.h-puls-spel-text { font-size:10.5px; font-weight:600; fill:var(--bg); }
.h-puls-ruta { position:absolute; z-index:5; top:0; left:0; width:252px; max-width:calc(100% - 8px); background:var(--panel2); border:1px solid var(--svag); border-radius:10px; padding:10px 12px 11px; font-size:13px; line-height:1.4; color:var(--fg); pointer-events:none; opacity:0; visibility:hidden; transition:opacity .12s ease; }
.h-puls-ruta.h-puls-synlig { opacity:1; visibility:visible; }
.h-puls-ruta.h-puls-last { pointer-events:auto; }
.h-puls-ruta-tid { font:600 13px var(--mono); color:var(--dim); letter-spacing:.02em; }
.h-puls-ruta-total { font-size:15px; margin-top:1px; }
.h-puls-ruta-total b { font-size:19px; font-weight:800; }
.h-puls-ruta-not { font-size:12px; color:var(--dim); margin-top:2px; }
.h-puls-rader { display:grid; grid-template-columns:12px minmax(26px, auto) 1fr; gap:1px 8px; align-items:center; margin:8px 0 0; }
.h-puls-streck { display:block; width:12px; height:3px; border-radius:2px; }
.h-puls-varde { text-align:right; font:600 13px var(--mono); font-variant-numeric:tabular-nums; color:var(--fg); }
.h-puls-vad { color:var(--dim); }
.h-puls-noll { opacity:.45; }
.h-puls-ms { margin-top:9px; padding-top:8px; border-top:1px solid var(--line); }
.h-puls-ms-rubrik { font:600 11px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--dim); margin-bottom:3px; }
.h-puls-ms-rad { display:grid; grid-template-columns:auto 1fr; gap:0 8px; font-size:12.5px; overflow-wrap:anywhere; }
.h-puls-ms-tid { font-family:var(--mono); color:var(--dim); }
.h-puls-ms-sort { color:var(--dim); }
.h-puls-ruta-fot { margin-top:9px; font-size:12px; color:var(--dim); }
.h-puls-ruta .h-puls-hoppa { display:none; margin-top:10px; }
.h-puls-ruta.h-puls-last .h-puls-hoppa { display:inline-block; }
.h-puls-ruta.h-puls-last .h-puls-ruta-fot { display:none; }
.h-puls-tom { color:var(--dim); font-size:13px; }
.h-puls-dockad .h-puls-ruta { position:static; width:auto; max-width:none; margin-top:10px; opacity:1; visibility:visible; pointer-events:auto; }
.h-puls-dockad .h-puls-ruta .h-puls-hoppa { display:inline-block; }
.h-puls-dockad .h-puls-ruta .h-puls-ruta-fot { display:none; }
.h-puls-hjalp { margin:10px 0 0; font-size:13px; line-height:1.5; color:var(--dim); }
.h-puls-text { max-width:820px; margin:26px 0 0; }
.h-puls-text p { margin:0 0 12px; }
.h-puls-text b { font-weight:600; font-variant-numeric:tabular-nums; }
.h-puls-tid { font:inherit; font-family:var(--mono); font-size:.92em; color:var(--accent); background:none; border:0; border-bottom:1px dotted var(--accent); border-radius:0; padding:0; margin:0; cursor:pointer; }
.h-puls-tid:hover, .h-puls-tid:focus-visible { color:var(--fg); border-bottom-color:var(--fg); outline:none; }
.h-puls-tabell { margin:18px 0 0; }
.h-puls-tabell summary { cursor:pointer; color:var(--dim); font:13px var(--mono); }
.h-puls-tabell summary:hover { color:var(--fg); }
.h-puls-tabellram { margin-top:12px; max-height:380px; overflow:auto; border:1px solid var(--line); border-radius:10px; }
.h-puls-tabellram table { border-collapse:collapse; width:100%; font:12.5px var(--mono); font-variant-numeric:tabular-nums; }
.h-puls-tabellram th, .h-puls-tabellram td { padding:5px 10px; text-align:right; white-space:nowrap; border-bottom:1px solid var(--line); }
.h-puls-tabellram th:first-child, .h-puls-tabellram td:first-child { text-align:left; }
.h-puls-tabellram thead th { position:sticky; top:0; background:var(--panel2); color:var(--dim); font-weight:600; }
.h-puls-tabellram td { color:var(--fg); }
.h-puls-tabellram td.h-puls-noll { color:var(--svag); opacity:1; }
.h-puls-tabellram tfoot th, .h-puls-tabellram tfoot td { font-weight:600; color:var(--fg); border-bottom:0; background:var(--panel2); }
@media (max-width:700px) { .h-puls-kort { padding:14px 12px 10px; } .h-puls-legend { gap:5px 14px; } }
@media (prefers-reduced-motion: reduce) { .h-puls-ruta { transition:none; } }
`;

  const kläm = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = v => Math.round(v * 10) / 10;

  function s(tagg, attr, barn) {                       // SVG-hjälpare, samma tanke som api.el
    const e = document.createElementNS(NS, tagg);
    for (const [k, v] of Object.entries(attr || {})) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    for (const b of [].concat(barn || [])) e.append(b);
    return e;
  }
  function töm(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  // data.minuter → femminutersfönster som följer klockan. Okända nycklar räknas som övrigt så att summan alltid stämmer.
  function fönsterdata(minuter) {
    const rader = (Array.isArray(minuter) ? minuter : []).filter(m => m && Number.isFinite(m.t)).sort((a, b) => a.t - b.t);
    if (!rader.length) return [];
    const t0 = Math.floor(rader[0].t / FÖNSTER) * FÖNSTER, t1 = Math.floor(rader[rader.length - 1].t / FÖNSTER) * FÖNSTER;
    const antal = (t1 - t0) / FÖNSTER + 1;
    if (!(antal >= 1) || antal > 3000) return [];
    const ut = [];
    for (let i = 0; i < antal; i++) ut.push({ t: t0 + i * FÖNSTER, minuter: 0, fMin: null, fMax: null, total: 0, v: KAT.map(() => 0) });
    const plats = Object.create(null); KAT.forEach((k, i) => { plats[k.id] = i; });   // utan prototyp: en nyckel som "constructor" i datat ska räknas som övrigt
    for (const m of rader) {
      const f = ut[Math.floor(m.t / FÖNSTER) - t0 / FÖNSTER]; if (!f) continue;
      f.minuter++; if (f.fMin == null) f.fMin = m.t; f.fMax = m.t;   // raderna är sorterade, så detta blir fönstrets första och sista minut i loggen
      for (const [nyckel, värde] of Object.entries(m)) {
        if (nyckel === 't') continue;
        const n = Number(värde); if (!(n > 0)) continue;
        f.v[nyckel in plats ? plats[nyckel] : plats.ovrigt] += n; f.total += n;
      }
    }
    return ut;
  }

  // Jämn y-axel: steg ur en snygg serie, högst fem steg, och luft ovanför toppen så att toppetiketten får plats.
  function skala(max) {
    const serie = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
    const steg = serie.find(v => max / v <= 5) || Math.ceil(max / 5) || 1;
    let tak = Math.max(steg, Math.ceil(max / steg) * steg);
    if (max > tak * 0.9) tak += steg;
    return { steg, tak };
  }

  // Monoton kubisk kurva genom punkterna (Fritsch–Carlson). Den går exakt genom varje värde och skjuter aldrig över,
  // så kurvan hittar inte på toppar som inte finns i datat.
  function kurva(p) {
    const n = p.length; if (!n) return '';
    let d = 'M' + r1(p[0][0]) + ',' + r1(p[0][1]);
    if (n === 1) return d;
    if (n === 2) return d + 'L' + r1(p[1][0]) + ',' + r1(p[1][1]);
    const lut = [], m = [];
    for (let i = 0; i < n - 1; i++) { const h = p[i + 1][0] - p[i][0]; lut.push(h > 0 ? (p[i + 1][1] - p[i][1]) / h : 0); }
    m[0] = lut[0]; m[n - 1] = lut[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = lut[i - 1] * lut[i] <= 0 ? 0 : 2 * lut[i - 1] * lut[i] / (lut[i - 1] + lut[i]);
    for (let i = 0; i < n - 1; i++) {
      const h = (p[i + 1][0] - p[i][0]) / 3;
      d += 'C' + r1(p[i][0] + h) + ',' + r1(p[i][1] + m[i] * h) + ' ' + r1(p[i + 1][0] - h) + ',' + r1(p[i + 1][1] - m[i + 1] * h) + ' ' + r1(p[i + 1][0]) + ',' + r1(p[i + 1][1]);
    }
    return d;
  }

  function korta(text, max) { const t = String(text || ''); return t.length <= max ? t : t.slice(0, Math.max(1, max - 1)).trimEnd() + '…'; }

  // Lägger etiketterna som flaggor i rader ovanför diagrammet (rad 0 närmast diagrammet). En uppsättning ryms om varje
  // etikett får en rad där den inte krockar med en annan, ingen annan flaggstång går genom den och dess egen stång inte
  // går genom en etikett längre ner. Raderna delas ut från höger till vänster, då bildar etiketterna en trappa.
  function lägg(mängd, xAv, bredd, rader, maxTecken) {
    const lagda = [], ordnade = mängd.slice().sort((a, b) => b.ts - a.ts);
    for (let n = 0; n < ordnade.length; n++) {
      const m = ordnade[n], x = xAv(m.ts), text = korta(m.etikett, maxTecken), w = text.length * TECKEN;
      let plats = null;
      for (let rad = 0; rad < rader && !plats; rad++) {
        for (const höger of [true, false]) {
          const a = höger ? x + 5 : x - 5 - w, b = a + w;
          if (a < 2 || b > bredd - 2) continue;
          // en etikett åt vänster får inte lägga sig över stången till någon som ännu väntar på sin plats
          if (!höger && ordnade.slice(n + 1).some(o => { const ox = xAv(o.ts); return ox > a - 3 && ox < b + 3; })) continue;
          const krock = lagda.some(p =>
            (p.rad === rad && a < p.b + 10 && b > p.a - 10) ||
            (p.rad < rad && x > p.a - 3 && x < p.b + 3) ||
            (p.rad > rad && p.x > a - 3 && p.x < b + 3));
          if (!krock) { plats = { m, x, a, b, rad, höger, text }; break; }
        }
      }
      if (!plats) return null;
      lagda.push(plats);
    }
    return lagda;
  }

  // Turordning för etiketterna: först de som förklarar var ett lager i diagrammet börjar, sedan sort för sort, och inom
  // en sort de korta först (de når inte in över nästa stång, så fler ryms).
  const iTur = (a, b) => (b.förklarar ? 1 : 0) - (a.förklarar ? 1 : 0) || MED_ETIKETT.indexOf(a.sort) - MED_ETIKETT.indexOf(b.sort) || a.etikett.length - b.etikett.length || a.ts - b.ts;

  // Väljer vilka milstolpar som får etikett: i prioritetsordning, och bara så länge hela uppsättningen fortfarande ryms.
  // De som inte får plats behåller sin linje och sin prick, och rubriken läses i avläsningsrutan.
  function placera(stolpar, xAv, bredd, rader, maxTecken) {
    for (const m of stolpar) m.lagd = null;
    const kö = stolpar.filter(m => MED_ETIKETT.includes(m.sort) && m.etikett).sort(iTur);
    let valda = [], bäst = [];
    for (const m of kö) { const försök = lägg(valda.concat(m), xAv, bredd, rader, maxTecken); if (försök) { valda = valda.concat(m); bäst = försök; } }
    for (const p of bäst) p.m.lagd = p;
  }

  Historia.sektioner.puls = {
    titel: 'Dagens puls, minut för minut',
    meny: 'Pulsen',
    ingang: 'Varje inlägg på Torget under dagen, räknat i femminutersfönster och färgat efter kanal. Först pratade agenterna, sedan började staden prata själv.',

    rendera(el, data, api) {
      el.classList.add('h-puls');
      if (!document.getElementById('h-puls-stil')) { const st = document.createElement('style'); st.id = 'h-puls-stil'; st.textContent = CSS; document.head.append(st); }

      const f = fönsterdata(data && data.minuter);
      if (!f.length) { el.append(api.el('p', { class: 'h-puls-tom', text: 'Det finns ingen minutdata att rita.' })); return; }

      const tMin = f[0].t, tMax = f[f.length - 1].t + FÖNSTER;
      const meta = (data && data.meta) || {};
      const start = Number.isFinite(meta.start) ? meta.start : tMin, slut = Number.isFinite(meta.slut) ? meta.slut : tMax;
      const stolpar = (Array.isArray(data.milstolpar) ? data.milstolpar : [])
        .filter(m => m && Number.isFinite(m.ts) && m.ts >= tMin && m.ts <= tMax)
        .map(m => ({ ts: m.ts, sort: String(m.sort || ''), rubrik: String(m.rubrik || '').trim(), lagd: null }))
        .map(m => Object.assign(m, { etikett: m.sort === 'kvarter' ? m.rubrik.replace(/ går live$/, '') : m.rubrik }))   // kvarteren får bara sitt namn, förklaringen säger vad det betyder
        .sort((a, b) => a.ts - b.ts);
      // En milstolpe i samma fönster som en kanal syns för första gången förklarar diagrammets form (till exempel
      // "Invånarna vaknar" där Gatans lager börjar). En sådan per kanal går först i kön om etikettplatserna.
      KAT.forEach((k, j) => {
        const första = f.find(w => w.v[j] > 0); if (!första) return;
        const kandidat = stolpar.filter(m => MED_ETIKETT.includes(m.sort) && m.etikett && m.ts >= första.t && m.ts < första.t + FÖNSTER).sort(iTur)[0];
        if (kandidat) kandidat.förklarar = true;
      });
      const summor = KAT.map((k, j) => f.reduce((n, w) => n + w.v[j], 0));
      const allt = summor.reduce((a, b) => a + b, 0);
      let toppI = 0; f.forEach((w, i) => { if (w.total > f[toppI].total) toppI = i; });
      const { steg: ySteg, tak: yTak } = skala(f[toppI].total);
      const spann = w => api.kl(w.t) + '–' + api.kl(w.t + FÖNSTER);
      const hoppaTill = i => api.hoppa(kläm(f[i].t, start, slut));

      // ---------- stomme ----------
      const kort = api.el('div', { class: 'kort h-puls-kort' });
      kort.append(api.el('p', { class: 'h-puls-titel', text: 'Inlägg per femminutersfönster, staplade per kanal' }));

      const legend = api.el('ul', { class: 'h-puls-legend', 'aria-label': 'Förklaring: kanaler' });
      KAT.forEach((k, j) => {
        legend.append(api.el('li', {}, [api.el('span', { class: 'h-puls-farg h-puls-k-' + k.id, 'aria-hidden': 'true' }), api.el('b', { text: k.namn }), api.el('span', { text: k.kanal + ' · ' + api.tal(summor[j]) })]));
      });
      const sido = api.el('ul', { class: 'h-puls-legend h-puls-legend-sido', 'aria-label': 'Förklaring: linjer' }, [
        api.el('li', {}, [api.el('span', { class: 'h-puls-nyckel h-puls-nyckel-stolpe', 'aria-hidden': 'true' }), api.el('span', { text: 'tunn lodrät linje: milstolpe (ett kvartersnamn betyder att kvarteret gick live då)' })]),
        api.el('li', {}, [api.el('span', { class: 'h-puls-nyckel h-puls-nyckel-spel', 'aria-hidden': 'true' }), api.el('span', { text: 'ljus lodrät linje med klockslag: filmens spelhuvud' })]),
      ]);
      kort.append(legend, sido);

      const ram = api.el('div', { class: 'h-puls-ram', tabindex: '0', role: 'group',
        'aria-label': 'Staplat ytdiagram över antal inlägg per femminutersfönster, från ' + api.kl(tMin) + ' till ' + api.kl(tMax) + '. Piltangenterna flyttar mellan fönstren, Enter spolar filmen dit. Samma siffror finns i tabellen under diagrammet.' });
      const svg = s('svg', { 'aria-hidden': 'true', focusable: 'false' });
      const ruta = api.el('div', { class: 'h-puls-ruta', role: 'status', 'aria-live': 'off' });
      ram.append(svg, ruta);
      kort.append(ram);

      // Loggen börjar och slutar mitt inne i ett femminutersfönster, så kurvans båda ändar vilar på färre än fem minuter.
      // Det syns inte i diagrammet, bara i avläsningsrutan, och utan den här raden läses slutets fall lätt som att staden tystnade.
      const kantFörsta = f[0].minuter > 0 && f[0].minuter < 5 ? f[0] : null;
      const kantSista = f.length > 1 && f[f.length - 1].minuter > 0 && f[f.length - 1].minuter < 5 ? f[f.length - 1] : null;
      if (kantFörsta || kantSista) {
        const led = kantFörsta && kantSista ? 'börjar ' + api.kl(kantFörsta.fMin) + ' och slutar ' + api.kl(kantSista.fMax)
          : kantFörsta ? 'börjar ' + api.kl(kantFörsta.fMin) : 'slutar ' + api.kl(kantSista.fMax);
        const fönsterled = kantFörsta && kantSista ? 'det första fönstret rymmer bara ' + kantFörsta.minuter + ' av fem minuter och det sista ' + kantSista.minuter
          : kantFörsta ? 'det första fönstret rymmer bara ' + kantFörsta.minuter + ' av fem minuter' : 'det sista fönstret rymmer bara ' + kantSista.minuter + ' av fem minuter';
        kort.append(api.el('p', { class: 'h-puls-hjalp', text: 'Minutloggen ' + led + ', mitt inne i ett femminutersfönster: ' + fönsterled + '.' + (kantSista ? ' Kurvans fall allra sist är kortare tid, inte tystnad.' : '') }));
      }

      kort.append(api.el('p', { class: 'h-puls-hjalp', text: 'Håll muspekaren över diagrammet, eller tryck på det, för att läsa av ett femminutersfönster. Ett musklick spolar filmen överst på sidan till den tidpunkten, och på pekskärm finns en knapp för det i avläsningsrutan. Milstolpar utan etikett visas också där.' }));
      el.append(kort);

      // ---------- tillstånd ----------
      let geo = null;                 // mått från senaste ritningen
      let vald = null, valdT = null;  // valt fönster och pekarens tid
      let läge = null;                // 'mus' | 'tryck' | 'tangent'
      let pekartyp = 'mouse';
      let spelTs = null;              // filmens senaste tid
      let rutnyckel = '';
      let lager = {};                 // svg-grupper som uppdateras utan omritning
      let klippNr = 0;

      const xAv = t => geo.pl + (t - tMin) / (tMax - tMin) * geo.pw;
      const yAv = v => geo.pt + geo.ph - v / yTak * geo.ph;

      function milstolparFör(i, t) {
        const w = f[i], inne = stolpar.filter(m => m.ts >= w.t && m.ts < w.t + FÖNSTER);
        if (inne.length || !stolpar.length) return { rubrik: inne.length === 1 ? 'Milstolpe i fönstret' : 'Milstolpar i fönstret', lista: inne };
        const mitt = t == null ? w.t + FÖNSTER / 2 : t;
        let närmast = stolpar[0]; for (const m of stolpar) if (Math.abs(m.ts - mitt) < Math.abs(närmast.ts - mitt)) närmast = m;
        return { rubrik: 'Närmaste milstolpe', lista: [närmast] };
      }

      function fyllRuta(i, ms) {
        const w = f[i];
        töm(ruta);
        ruta.append(api.el('div', { class: 'h-puls-ruta-tid', text: spann(w) }));
        ruta.append(api.el('div', { class: 'h-puls-ruta-total' }, [api.el('b', { text: api.tal(w.total) }), ' inlägg']));
        if (w.minuter < 5) ruta.append(api.el('div', { class: 'h-puls-ruta-not', text: 'Ofullständigt fönster: loggen täcker ' + w.minuter + ' av de 5 minuterna.' }));
        const rader = api.el('div', { class: 'h-puls-rader' });
        KAT.forEach((k, j) => {
          const noll = w.v[j] === 0 ? ' h-puls-noll' : '';
          rader.append(api.el('span', { class: 'h-puls-streck h-puls-k-' + k.id + noll, 'aria-hidden': 'true' }), api.el('span', { class: 'h-puls-varde' + noll, text: api.tal(w.v[j]) }), api.el('span', { class: 'h-puls-vad' + noll, text: k.namn }));
        });
        ruta.append(rader);
        if (ms.lista.length) {
          const block = api.el('div', { class: 'h-puls-ms' }, api.el('div', { class: 'h-puls-ms-rubrik', text: ms.rubrik }));
          ms.lista.slice(0, 5).forEach(m => {
            const sort = SORTER[m.sort] || m.sort;
            block.append(api.el('div', { class: 'h-puls-ms-rad' }, [api.el('span', { class: 'h-puls-ms-tid', text: api.kl(m.ts) }),
              api.el('span', {}, [m.rubrik || 'Milstolpe', sort ? api.el('span', { class: 'h-puls-ms-sort', text: ' (' + sort + ')' }) : ''])]));
          });
          if (ms.lista.length > 5) block.append(api.el('div', { class: 'h-puls-ruta-not', text: 'och ' + (ms.lista.length - 5) + ' till' }));
          ruta.append(block);
        }
        ruta.append(api.el('div', { class: 'h-puls-ruta-fot', text: 'Klicka, eller tryck Enter, för att spola filmen hit.' }));
        const knapp = api.el('button', { class: 'knapp h-puls-hoppa', type: 'button', text: 'Spola filmen till ' + api.kl(kläm(w.t, start, slut)) });
        knapp.addEventListener('click', e => { e.stopPropagation(); hoppaTill(i); });
        ruta.append(knapp);
      }

      // Den svävande rutan hålls innanför diagrammets egen ruta, både i sidled och i höjdled. Ett fönster med fyra
      // milstolpar (som 10:55–11:00) ger en hög ruta, och utan höjdklämman skulle den lägga sig över texten under kortet.
      function läggRuta() {
        if (!geo || vald == null || geo.dockad) { ruta.style.left = ''; ruta.style.top = ''; return; }
        const cx = xAv(f[vald].t + FÖNSTER / 2) * geo.k, bw = ruta.offsetWidth || 252, W = ram.clientWidth || geo.W;
        let vänster = cx + 16; if (vänster + bw > W - 4) vänster = cx - 16 - bw;
        ruta.style.left = Math.round(kläm(vänster, 4, Math.max(4, W - bw - 4))) + 'px';
        const bh = ruta.offsetHeight || 0, ramH = ram.clientHeight || geo.H * geo.k;
        ruta.style.top = Math.round(kläm(geo.pt * geo.k + 6, 2, Math.max(2, ramH - bh - 2))) + 'px';
      }

      function ritaSikte(ms) {
        if (!geo || !lager.sikte) return;
        töm(lager.sikte); töm(lager.tand);
        if (vald == null) return;
        const w = f[vald], x0 = xAv(w.t), x1 = xAv(w.t + FÖNSTER), cx = (x0 + x1) / 2;
        lager.sikte.append(s('rect', { class: 'h-puls-band', x: r1(x0), y: geo.pt, width: r1(Math.max(1, x1 - x0)), height: geo.ph }),
          s('line', { class: 'h-puls-sikte', x1: r1(cx), x2: r1(cx), y1: geo.pt, y2: geo.pt + geo.ph }));
        for (const m of ms.lista.slice(0, 5)) { const x = Math.round(xAv(m.ts)) + 0.5; lager.tand.append(s('line', { class: 'h-puls-tand', x1: x, x2: x, y1: geo.pt, y2: geo.pt + geo.ph }), s('circle', { class: 'h-puls-tand-ring', cx: x, cy: geo.pt, r: 4 })); }
      }

      function visa(i, t, nyttLäge) {
        i = kläm(i, 0, f.length - 1); vald = i; valdT = t; läge = nyttLäge;
        // Ett avsiktligt tryck eller en piltangent får läsas upp. Hovring med mus gör det inte: rutan byts vid varje fönster,
        // och den som kör skärmläsare och mus samtidigt skulle få den uppläst om och om igen.
        const talar = nyttLäge === 'mus' ? 'off' : 'polite';
        if (ruta.getAttribute('aria-live') !== talar) ruta.setAttribute('aria-live', talar);
        const ms = milstolparFör(i, t), nyckel = i + '|' + ms.lista.map(m => m.ts + m.rubrik).join('|');
        const nytt = nyckel !== rutnyckel, varLast = ruta.classList.contains('h-puls-last'), blirLast = läge === 'tryck';
        if (nytt) { rutnyckel = nyckel; fyllRuta(i, ms); ritaSikte(ms); }
        ruta.classList.add('h-puls-synlig');
        ruta.classList.toggle('h-puls-last', blirLast);
        // Rutan hänger på fönstrets mitt, inte på pekaren, så den behöver bara läggas om när innehållet eller höjden
        // ändras. Att hoppa över det gör att en musrörelse inom samma fönster inte tvingar fram en ny layoutberäkning.
        if (nytt || blirLast !== varLast) läggRuta();
      }

      function dölj() {
        if (geo && geo.dockad) { läge = null; return; }   // dockad ruta står kvar med senaste avläsningen
        vald = null; valdT = null; läge = null; rutnyckel = '';
        ruta.classList.remove('h-puls-synlig', 'h-puls-last');
        if (lager.sikte) { töm(lager.sikte); töm(lager.tand); }
      }

      function flyttaSpel(ts) {
        spelTs = ts;
        if (!geo || !lager.spel) return;
        if (!Number.isFinite(ts) || ts < tMin - FÖNSTER || ts > tMax + FÖNSTER) { lager.spel.setAttribute('display', 'none'); for (const m of lager.tickar) m.el.removeAttribute('visibility'); return; }   // ingen film, eller en tid utanför dagen
        const x = r1(xAv(kläm(ts, tMin, tMax))), bw = BRICKA, bx = r1(kläm(x - bw / 2, 1, geo.W - bw - 1));
        lager.spel.removeAttribute('display');
        lager.spelLinje.setAttribute('x1', x); lager.spelLinje.setAttribute('x2', x);
        lager.spelBricka.setAttribute('x', bx);
        lager.spelText.setAttribute('x', r1(bx + bw / 2)); lager.spelText.textContent = api.kl(kläm(ts, tMin, tMax));
        for (const m of lager.tickar) { if (m.b > bx - 1 && m.a < bx + bw + 1) m.el.setAttribute('visibility', 'hidden'); else m.el.removeAttribute('visibility'); }   // brickan får inte ligga halvt över ett klockslag
      }

      // ---------- ritning ----------
      function rita() {
        const W = Math.max(280, Math.round(ram.clientWidth || 720));
        const dockad = W < 560;
        const rader = W < 520 ? 3 : W < 900 ? 5 : 6;
        const pl = W < 560 ? 30 : 40, pr = W < 560 ? 10 : 18;
        const ph = W < 560 ? 210 : W < 900 ? 260 : 300;
        const pt = 8 + rader * RADHÖJD + 8, pw = Math.max(60, W - pl - pr), H = pt + ph + 30;
        geo = { W, H, pl, pr, pt, pw, ph, dockad, k: 1 };
        el.classList.toggle('h-puls-dockad', dockad);
        töm(svg);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
        const y0 = pt + ph;

        // rutnät och y-axel
        const nät = s('g');
        for (let v = 0, n = 0; v <= yTak + 1e-9 && n < 12; v += ySteg, n++) {
          const y = Math.round(yAv(v)) + 0.5;
          if (v > 0) nät.append(s('line', { class: 'h-puls-rutnat', x1: pl, x2: pl + pw, y1: y, y2: y }));
          nät.append(s('text', { class: 'h-puls-axel', x: pl - 7, y, dy: '.32em', 'text-anchor': 'end', text: api.tal(v) }));
        }
        svg.append(nät);

        // milstolparnas linjer på den tomma ytan (bakom bergen)
        const himmel = s('g');
        for (const m of stolpar) { const x = Math.round(xAv(m.ts)) + 0.5; himmel.append(s('line', { class: 'h-puls-himmel', x1: x, x2: x, y1: pt, y2: y0 })); }
        svg.append(himmel);

        // staplade ytor: varje lager målas från sin övre gräns ner till baslinjen, översta lagret först
        const mitt = f.length === 1 ? [xAv(tMin), xAv(tMax)] : f.map(w => xAv(w.t + FÖNSTER / 2));
        const kum = f.map(() => 0), gränser = [];
        KAT.forEach((k, j) => {
          f.forEach((w, i) => { kum[i] += w.v[j]; });
          gränser.push(f.length === 1 ? [[mitt[0], yAv(kum[0])], [mitt[1], yAv(kum[0])]] : kum.map((v, i) => [mitt[i], yAv(v)]));
        });
        const xa = r1(mitt[0]), xb = r1(mitt[mitt.length - 1]), stäng = 'L' + xb + ',' + y0 + 'L' + xa + ',' + y0 + 'Z';
        const banor = gränser.map(kurva), ytor = s('g');
        for (let j = KAT.length - 1; j >= 0; j--) if (summor[j] > 0) ytor.append(s('path', { class: 'h-puls-k-' + KAT[j].id, d: banor[j] + stäng }));
        for (let j = 0; j < KAT.length - 1; j++) if (summor[j] > 0) ytor.append(s('path', { class: 'h-puls-glipa', d: banor[j] }));
        svg.append(ytor);

        // samma milstolpar som mörka snitt genom bergen, klippta till silhuetten
        const klippId = 'h-puls-klipp-' + (++klippNr);
        svg.append(s('clipPath', { id: klippId }, s('path', { d: banor[KAT.length - 1] + stäng })));
        const snitt = s('g', { 'clip-path': 'url(#' + klippId + ')' });
        for (const m of stolpar) { const x = Math.round(xAv(m.ts)) + 0.5; snitt.append(s('line', { class: 'h-puls-snitt', x1: x, x2: x, y1: pt, y2: y0 })); }
        svg.append(snitt);

        // direktetikett inne i pulsens yta, bara om den ryms med marginal
        if (summor[0] > 0 && f.length > 1) {
          const namn = KAT[0].namn, halv = namn.length * 7.2 / 2 + 10, perFönster = pw / f.length, sidor = Math.ceil(halv / perFönster);
          let bäst = -1, bästH = 0;
          for (const frittFrånLinjer of [true, false]) {
            if (bäst >= 0 && bästH >= 34) break;
            bäst = -1; bästH = 0;
            for (let i = sidor; i < f.length - sidor; i++) {
              if (frittFrånLinjer && stolpar.some(m => Math.abs(xAv(m.ts) - mitt[i]) < halv)) continue;
              let lägst = Infinity; for (let n = i - sidor; n <= i + sidor; n++) lägst = Math.min(lägst, f[n].v[0]);
              const h = lägst / yTak * ph; if (h > bästH) { bästH = h; bäst = i; }
            }
          }
          if (bäst >= 0 && bästH >= 34) svg.append(s('text', { class: 'h-puls-inuti', x: r1(mitt[bäst]), y: r1(y0 - bästH / 2), dy: '.35em', 'text-anchor': 'middle', text: namn }));
        }

        // dagens högsta fönster får sitt tal utskrivet
        if (f[toppI].total > 0) {
          const tx = f.length === 1 ? (mitt[0] + mitt[1]) / 2 : mitt[toppI], ty = yAv(f[toppI].total);
          svg.append(s('circle', { class: 'h-puls-topp-prick', cx: r1(tx), cy: r1(ty), r: 3.5 }));
          const toppText = api.tal(f[toppI].total) + ' kl. ' + spann(f[toppI]), halvTopp = toppText.length * TECKEN / 2 + 4;
          svg.append(s('text', { class: 'h-puls-topp', x: r1(kläm(tx, Math.min(pl + halvTopp, W / 2), Math.max(W - halvTopp, W / 2))), y: r1(ty - 10), 'text-anchor': 'middle', text: toppText }));
        }

        // x-axel
        const axel = s('g'), tickar = [];
        axel.append(s('line', { class: 'h-puls-baslinje', x1: pl, x2: pl + pw, y1: y0 + 0.5, y2: y0 + 0.5 }));
        const stegval = [30, 60, 120, 180, 240, 480, 1440].map(m => m * 60000), pxPerMs = pw / (tMax - tMin);
        const xSteg = stegval.find(v => v * pxPerMs >= 58) || stegval[stegval.length - 1];
        for (let t = Math.ceil(tMin / xSteg) * xSteg, n = 0; t <= tMax && n < 60; t += xSteg, n++) {
          const x = Math.round(xAv(t)) + 0.5, sent = x > W - 22, tidigt = x < 18;
          axel.append(s('line', { class: 'h-puls-baslinje', x1: x, x2: x, y1: y0, y2: y0 + 5 }));
          const tx = sent ? W - 2 : tidigt ? 2 : x, märke = s('text', { class: 'h-puls-axel', x: tx, y: y0 + 18, 'text-anchor': sent ? 'end' : tidigt ? 'start' : 'middle', text: api.kl(t) });
          axel.append(märke); tickar.push({ el: märke, a: sent ? tx - 34 : tidigt ? tx : tx - 17, b: sent ? tx : tidigt ? tx + 34 : tx + 17 });
        }
        svg.append(axel);

        // flaggor: prick för de viktiga sorterna, stång och etikett för dem som får plats
        placera(stolpar, xAv, W, rader, W < 520 ? 32 : 44);
        const flaggor = s('g');
        for (const m of stolpar) {
          if (!MED_ETIKETT.includes(m.sort)) continue;
          const x = Math.round(xAv(m.ts)) + 0.5;
          if (m.lagd) {
            const by = pt - 9 - m.lagd.rad * RADHÖJD;
            flaggor.append(s('line', { class: 'h-puls-flagga', x1: x, x2: x, y1: pt, y2: by - 9 }));
            flaggor.append(s('text', { class: 'h-puls-etikett' + (m.sort === 'beslut' ? ' h-puls-etikett-beslut' : ''), x: r1(m.lagd.höger ? x + 5 : x - 5), y: by, 'text-anchor': m.lagd.höger ? 'start' : 'end', text: m.lagd.text }));
          }
          flaggor.append(s('circle', { class: 'h-puls-prick', cx: x, cy: pt, r: 2.5 }));
        }
        svg.append(flaggor);

        // lager som ändras utan omritning: sikte, tända milstolpar, spelhuvud
        lager = { sikte: s('g'), tand: s('g'), spel: s('g', { display: 'none' }), tickar };
        lager.spelLinje = s('line', { class: 'h-puls-spel-linje', x1: 0, x2: 0, y1: pt - 4, y2: y0 + 6 });
        lager.spelBricka = s('rect', { class: 'h-puls-spel-bricka', x: 0, y: y0 + 7, width: BRICKA, height: 17, rx: 4 });
        lager.spelText = s('text', { class: 'h-puls-spel-text', x: 0, y: y0 + 19, 'text-anchor': 'middle', text: '' });
        lager.spel.append(lager.spelLinje, lager.spelBricka, lager.spelText);
        svg.append(lager.sikte, lager.tand, lager.spel);

        const mått = svg.getBoundingClientRect ? svg.getBoundingClientRect() : null;
        geo.k = mått && mått.width > 0 ? mått.width / W : 1;
        if (!dockad && vald != null && läge == null) dölj();   // en dockad avläsning som blivit över när fönstret breddats
        if (vald != null) { ritaSikte(milstolparFör(vald, valdT)); ruta.classList.add('h-puls-synlig'); läggRuta(); }
        else { töm(ruta); rutnyckel = ''; if (dockad) ruta.append(api.el('div', { class: 'h-puls-tom', text: 'Tryck på diagrammet för att läsa av en tidpunkt.' })); }
        flyttaSpel(spelTs);
      }

      // ---------- pekare, tangenter, film ----------
      function träff(e) {
        const mått = svg.getBoundingClientRect(), k = mått.width > 0 ? geo.W / mått.width : 1;
        const t = kläm(tMin + ((e.clientX - mått.left) * k - geo.pl) / geo.pw * (tMax - tMin), tMin, tMax - 1);
        return { i: kläm(Math.floor((t - tMin) / FÖNSTER), 0, f.length - 1), t };
      }
      // Mus: hovring läser av, klick spolar filmen. Finger eller penna: ett tryck läser av (knappen i rutan spolar filmen),
      // och ett vågrätt drag flyttar avläsningen. Lodräta drag lämnas åt sidans rullning (touch-action: pan-y).
      let ned = null;
      svg.addEventListener('pointerdown', e => { pekartyp = e.pointerType || 'mouse'; ned = pekartyp === 'mouse' ? null : { x: e.clientX, y: e.clientY, drar: false }; });
      svg.addEventListener('pointermove', e => {
        if (!geo) return;
        if ((e.pointerType || 'mouse') === 'mouse') { const p = träff(e); visa(p.i, p.t, 'mus'); return; }
        if (!ned) return;
        const dx = Math.abs(e.clientX - ned.x), dy = Math.abs(e.clientY - ned.y);
        if (!ned.drar && dx > 8 && dx > dy) ned.drar = true;
        if (ned.drar) { const p = träff(e); visa(p.i, p.t, 'tryck'); }
      });
      for (const typ of ['pointerup', 'pointercancel']) svg.addEventListener(typ, () => { ned = null; });
      svg.addEventListener('pointerleave', e => { if ((e.pointerType || 'mouse') === 'mouse' && läge === 'mus') dölj(); });
      svg.addEventListener('click', e => { if (!geo) return; const p = träff(e); if (pekartyp === 'mouse') hoppaTill(p.i); else visa(p.i, p.t, 'tryck'); });
      document.addEventListener('pointerdown', e => { if (läge === 'tryck' && !ram.contains(e.target)) dölj(); });

      const startval = () => { if (Number.isFinite(spelTs)) return kläm(Math.floor((spelTs - tMin) / FÖNSTER), 0, f.length - 1); return toppI; };
      ram.addEventListener('keydown', e => {
        if (e.target !== ram || !geo) return;
        let i = vald == null ? startval() : vald;
        if (e.key === 'ArrowRight') i += vald == null ? 0 : 1; else if (e.key === 'ArrowLeft') i -= vald == null ? 0 : 1;
        else if (e.key === 'PageDown') i += 12; else if (e.key === 'PageUp') i -= 12;
        else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = f.length - 1;
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (vald == null) visa(i, null, 'tangent'); else hoppaTill(vald); return; }
        else if (e.key === 'Escape') { dölj(); return; }
        else return;
        e.preventDefault(); visa(i, null, 'tangent');
      });
      ram.addEventListener('focus', () => { let synligt = true; try { synligt = ram.matches(':focus-visible'); } catch (e) { /* äldre webbläsare */ } if (synligt && vald == null && geo) visa(startval(), null, 'tangent'); });
      ram.addEventListener('blur', e => { if (läge === 'tangent' && !ram.contains(e.relatedTarget)) dölj(); });

      rita();
      let väntar = 0, sistaBredd = ram.clientWidth;
      const vidStorlek = () => { if (väntar) return; väntar = requestAnimationFrame(() => { väntar = 0; const b = ram.clientWidth; if (b && Math.abs(b - sistaBredd) >= 1) { sistaBredd = b; rita(); } }); };
      if (typeof ResizeObserver === 'function') new ResizeObserver(vidStorlek).observe(ram); else window.addEventListener('resize', vidStorlek);

      if (typeof api.påTid === 'function') api.påTid(ts => flyttaSpel(ts));

      // ---------- tre meningar med tal ur datat ----------
      const text = api.el('div', { class: 'h-puls-text' });
      const fet = v => api.el('b', { text: typeof v === 'number' ? api.tal(v) : v });
      const tid = (ts, visat) => { const k = api.el('button', { class: 'h-puls-tid', type: 'button', title: 'Spola filmen till ' + api.kl(kläm(ts, start, slut)), text: visat || api.kl(ts) }); k.addEventListener('click', () => api.hoppa(kläm(ts, start, slut))); return k; };
      const större = w => w.v[0] > w.total - w.v[0];
      const störreI = f.findIndex(större);
      let frånI = -1; for (let i = f.length - 1; i >= 0; i--) { if (f[i].total === 0) continue; if (större(f[i])) frånI = i; else break; }

      if (störreI > 0) {
        const före = f.slice(0, störreI).reduce((n, w) => n + w.total, 0), förePuls = f.slice(0, störreI).reduce((n, w) => n + w.v[0], 0);
        if (före > 0) text.append(api.el('p', {}, ['Dagen började som ett samtal. Före ', tid(f[störreI].t), ' hade ', fet(före), ' inlägg skrivits, och bara ', fet(förePuls), ' av dem var händelser på Stadens puls: resten var prat i kanalerna.']));
      }
      if (störreI >= 0 && summor[0] > 0) {
        const w = f[störreI], p = api.el('p', {}, ['I fönstret ', tid(w.t, spann(w)), ' var pulsen för första gången större än allt annat tillsammans (', fet(w.v[0]), ' av ', fet(w.total), ' inlägg)']);
        if (frånI > störreI) p.append(', och från ', tid(f[frånI].t), ' var den det i varje femminutersfönster resten av dagen');
        else if (frånI === störreI) p.append(', och så förblev det resten av dagen');
        p.append('. Sammanlagt stod pulsen för ', fet(summor[0]), ' av dagens ', fet(allt), ' inlägg' + (allt > 0 ? ' (' + Math.round(summor[0] / allt * 100) + ' procent)' : '') + '.');
        text.append(p);
      }
      // Livligaste minuten: ur data.rekord om den finns där, annars räknad ur samma minutrader som diagrammet.
      let lm = data.rekord && data.rekord.livligaste_minut;
      if (!(lm && Number.isFinite(lm.t) && Number.isFinite(lm.antal))) {
        lm = null;
        for (const m of (Array.isArray(data.minuter) ? data.minuter : [])) {
          if (!m || !Number.isFinite(m.t)) continue;
          let antal = 0; for (const [nyckel, värde] of Object.entries(m)) { const n = Number(värde); if (nyckel !== 't' && n > 0) antal += n; }
          if (antal > 0 && (!lm || antal > lm.antal)) lm = { t: m.t, antal };
        }
      }
      const p3 = api.el('p');
      if (allt === 0) p3.append('Loggen innehåller inga inlägg för den här dagen.');
      else if (lm) p3.append('Den livligaste minuten var ', tid(lm.t), ' med ', fet(lm.antal), ' inlägg, och det tätaste femminutersfönstret var ', tid(f[toppI].t, spann(f[toppI])), ' med ', fet(f[toppI].total), '.');
      else p3.append('Det tätaste femminutersfönstret var ', tid(f[toppI].t, spann(f[toppI])), ' med ', fet(f[toppI].total), ' inlägg.');
      text.append(p3);
      el.append(text);

      // ---------- tabell som alternativ vy ----------
      const detaljer = api.el('details', { class: 'h-puls-tabell' }, api.el('summary', { text: 'Visa siffrorna som tabell' }));
      const tabellram = api.el('div', { class: 'h-puls-tabellram', tabindex: '0', role: 'region', 'aria-label': 'Inlägg per femminutersfönster och kanal' });
      detaljer.append(tabellram);
      detaljer.addEventListener('toggle', () => {
        if (!detaljer.open || tabellram.firstChild) return;
        const huvud = api.el('tr', {}, [api.el('th', { scope: 'col', text: 'Fönster' })].concat(KAT.map(k => api.el('th', { scope: 'col', text: k.namn })), api.el('th', { scope: 'col', text: 'Totalt' })));
        const kropp = api.el('tbody');
        for (const w of f) kropp.append(api.el('tr', {}, [api.el('td', { text: spann(w) })].concat(w.v.map(v => api.el('td', v === 0 ? { class: 'h-puls-noll', text: '0' } : { text: api.tal(v) })), api.el('td', { text: api.tal(w.total) }))));
        const fot = api.el('tfoot', {}, api.el('tr', {}, [api.el('th', { scope: 'row', text: 'Hela dagen' })].concat(summor.map(v => api.el('td', { text: api.tal(v) })), api.el('td', { text: api.tal(allt) }))));
        tabellram.append(api.el('table', {}, [api.el('thead', {}, huvud), kropp, fot]));
      });
      el.append(detaljer);
    },
  };
})();
