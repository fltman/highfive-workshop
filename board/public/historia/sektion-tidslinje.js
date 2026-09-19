// Historiksidans tidslinje: två spår med gemensam klocka.
//   STADEN            data.milstolpar: vad teamen och staden gjorde.
//   BAKOM KULISSERNA  data.verktyg: ämnesraderna från workshopledarens agent, som byggde verktygen under tiden.
// Dagen delas i tiominutersrader. På bred skärm står spåren bredvid varandra med klockan emellan, på smal skärm
// ligger de under varandra inom varje rad, så att man fortfarande ser vad som hände samtidigt.
// Klick på en milstolpe spolar filmen dit (api.hoppa). Filmens klocka (api.påTid) markerar den milstolpe som just passerats.
(function () {
  'use strict';
  const H = window.Historia;
  if (!H || !H.sektioner) return;

  // Raderna är tio minuter långa. Svensk tid ligger hela timmar från UTC, så jämna tiotal i ts är jämna tiotal på klockan.
  const TIO = 10 * 60 * 1000, TIMME = 60 * 60 * 1000;
  const NS = 'http://www.w3.org/2000/svg';
  const äger = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // Sorterna i data.milstolpar, i den ordning de hör hemma under en dag. Etiketten står alltid utskriven bredvid formen.
  const ORDNING = ['start', 'beslut', 'puls', 'kvarter', 'rekord', 'ledning', 'volym', 'slut'];
  const SORTER = {
    start: { etikett: 'Start', om: 'Dagens första inlägg på Torget' },
    beslut: { etikett: 'Beslut', om: 'Agenterna bestämmer vad som ska byggas' },
    puls: { etikett: 'Puls', om: 'Stadens puls, den gemensamma händelsebussen' },
    kvarter: { etikett: 'Kvarter', om: 'Ett teams kvarter går live i staden' },
    rekord: { etikett: 'Rekord', om: 'Första gången en kedja av reaktioner blir ett led längre' },
    ledning: { etikett: 'Ledningen', om: 'Byggt av workshopledningen, inte av ett deltagarteam' },
    volym: { etikett: 'Volym', om: 'Jämna tusental inlägg på Torget' },
    slut: { etikett: 'Slut', om: 'Här slutar dagens logg' },
  };

  // Markörernas former, ritade i en ruta på 16 x 16. Formen bär sorten tillsammans med etiketten, färgen är bara en förstärkning.
  const LINJE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const FORMER = {
    start: [['polygon', { points: '4,2.5 14,8 4,13.5' }]],
    beslut: [['polygon', { points: '8,1.2 14.8,8 8,14.8 1.2,8' }]],
    puls: [['polyline', Object.assign({ points: '0.8,8.5 4.2,8.5 6.4,2.8 9.6,13.2 11.8,8.5 15.2,8.5' }, LINJE)]],
    kvarter: [['polygon', { points: '8,1.2 14.6,6.8 14.6,14.6 1.4,14.6 1.4,6.8' }]],
    rekord: [['polygon', { points: '8,1 9.76,5.57 14.66,5.84 10.85,8.93 12.11,13.66 8,11 3.89,13.66 5.15,8.93 1.34,5.84 6.24,5.57' }]],
    ledning: [['polygon', { points: '15,8 11.5,14.06 4.5,14.06 1,8 4.5,1.94 11.5,1.94' }]],
    volym: [['rect', { x: '1.4', y: '9', width: '3.4', height: '5.6' }], ['rect', { x: '6.3', y: '5.4', width: '3.4', height: '9.2' }], ['rect', { x: '11.2', y: '1.6', width: '3.4', height: '13' }]],
    slut: [['circle', Object.assign({ cx: '8', cy: '8', r: '6.6' }, LINJE)], ['rect', { x: '5.3', y: '5.3', width: '5.4', height: '5.4' }]],
    nytt: [['line', Object.assign({ x1: '8', y1: '0.8', x2: '8', y2: '4.2' }, LINJE)], ['circle', Object.assign({ cx: '8', cy: '8', r: '3.6' }, LINJE)], ['line', Object.assign({ x1: '8', y1: '11.8', x2: '8', y2: '15.2' }, LINJE)]],
    justering: [['circle', { cx: '8', cy: '8', r: '2.8' }]],
    annat: [['circle', { cx: '8', cy: '8', r: '5' }]],
  };

  const CSS = `
.h-tidslinje { --h-tl-axel:88px; --h-tl-farg:var(--dim); min-width:0; }
.h-tidslinje [hidden] { display:none !important; }
.h-tidslinje-dold { position:absolute; width:1px; height:1px; margin:-1px; padding:0; border:0; overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }
.h-tidslinje-sort-start, .h-tidslinje-sort-puls, .h-tidslinje-sort-kvarter { --h-tl-farg:var(--me); }
.h-tidslinje-sort-beslut, .h-tidslinje-sort-rekord { --h-tl-farg:var(--accent); }
.h-tidslinje-sort-ledning { --h-tl-farg:var(--lila); }
.h-tidslinje-sort-slut { --h-tl-farg:var(--fg); }
.h-tidslinje-sort-volym, .h-tidslinje-sort-annat, .h-tidslinje-sort-nytt { --h-tl-farg:var(--dim); }
.h-tidslinje-sort-justering { --h-tl-farg:var(--svag); }
.h-tidslinje-form { display:block; width:14px; height:14px; flex:0 0 14px; overflow:visible; fill:currentColor; color:var(--h-tl-farg); }

.h-tidslinje-svep { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px 18px 8px; margin:0 0 20px; overflow:hidden; }
.h-tidslinje-svep-topp { display:flex; flex-wrap:wrap; justify-content:space-between; gap:2px 16px; font:12px/1.4 var(--mono); color:var(--dim); }
.h-tidslinje-svep-yta { position:relative; padding-top:20px; }
.h-tidslinje-svep-radnamn { position:relative; z-index:1; display:table; padding-right:6px; background:var(--panel); font:600 10px/1.4 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--dim); margin:0 0 3px; }
.h-tidslinje-svep-rad { position:relative; height:18px; border-bottom:1px solid var(--line); margin-bottom:8px; }
.h-tidslinje-streck { position:absolute; bottom:0; width:3px; height:14px; margin-left:-1.5px; border-radius:2px 2px 0 0; background:var(--h-tl-farg); }
.h-tidslinje-streck.h-tidslinje-sort-justering { height:8px; }
.h-tidslinje-svep-timme { position:absolute; top:20px; bottom:20px; width:1px; background:var(--line); }
.h-tidslinje-svep-timmar { position:relative; height:20px; }
.h-tidslinje-svep-timtext { position:absolute; top:3px; transform:translateX(-50%); font:10px/1.4 var(--mono); color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap; }
.h-tidslinje-svep-nu { position:absolute; top:16px; bottom:20px; width:2px; margin-left:-1px; background:var(--accent); border-radius:2px; z-index:2; }
.h-tidslinje-svep-nutid { position:absolute; top:-16px; left:50%; transform:translateX(-50%); font:600 11px/1.4 var(--mono); color:var(--accent); white-space:nowrap; font-variant-numeric:tabular-nums; }
.h-tidslinje-svep-nu-tidigt .h-tidslinje-svep-nutid { left:-1px; transform:none; }
.h-tidslinje-svep-nu-sent .h-tidslinje-svep-nutid { left:auto; right:-1px; transform:none; }

.h-tidslinje-filter { display:flex; flex-direction:column; gap:10px; margin:0 0 30px; }
.h-tidslinje-filtergrupp { display:flex; flex-direction:column; gap:6px; min-width:0; }
.h-tidslinje-filternamn { font:600 11px/1.4 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); }
.h-tidslinje-filterrad { display:flex; flex-wrap:wrap; gap:6px 8px; min-width:0; }
.h-tidslinje-filterknapp { display:inline-flex; align-items:center; gap:7px; min-height:36px; margin:0; padding:6px 13px; font:600 12px/1.2 var(--mono); color:var(--dim); background:var(--panel2); border:1px solid var(--line); border-radius:999px; cursor:pointer; -webkit-appearance:none; appearance:none; }
.h-tidslinje-filterknapp:hover { color:var(--fg); border-color:var(--svag); }
.h-tidslinje-filterknapp:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.h-tidslinje-filterknapp[aria-pressed="true"] { color:var(--fg); background:var(--panel); border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
.h-tidslinje-antal { font-weight:400; color:var(--dim); font-variant-numeric:tabular-nums; }

.h-tidslinje-sparhuvud { margin:0 0 14px; min-width:0; }
.h-tidslinje-sparnamn { font:700 22px/1.2 var(--serif); margin:0 0 4px; color:var(--fg); }
.h-tidslinje-sparingress { margin:0; font-size:14px; line-height:1.5; color:var(--dim); max-width:520px; }
.h-tidslinje-axelhuvud { display:none; }
.h-tidslinje-klocka { position:relative; z-index:1; font:600 12px/1.4 var(--mono); color:var(--accent); background:var(--panel2); border:1px solid var(--line); border-radius:999px; padding:3px 10px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.h-tidslinje-cell { display:flex; flex-direction:column; gap:10px; min-width:0; }
.h-tidslinje-sparetikett { font:600 10px/1.4 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); }
.h-tidslinje-tomt { margin:8px 0 0; color:var(--dim); font-size:15px; }

.h-tidslinje-kort { display:block; width:100%; min-width:0; margin:0; padding:14px 16px 15px 18px; text-align:left; font:inherit; color:var(--fg); background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:inset 3px 0 0 var(--h-tl-farg); cursor:pointer; -webkit-appearance:none; appearance:none; overflow-wrap:anywhere; }
.h-tidslinje-kort:hover { background:var(--panel2); border-color:var(--svag); }
.h-tidslinje-kort:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.h-tidslinje-huvud { display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; font:600 11px/1.4 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--h-tl-farg); }
.h-tidslinje-tid { margin-left:auto; font:600 13px/1.4 var(--mono); letter-spacing:0; color:var(--dim); font-variant-numeric:tabular-nums; }
.h-tidslinje-har { display:none; font:600 10px/1.2 var(--mono); letter-spacing:.06em; color:var(--bg); background:var(--accent); border-radius:999px; padding:3px 8px; }
.h-tidslinje-rubrik { display:block; margin-top:8px; font:700 19px/1.25 var(--serif); color:var(--fg); }
.h-tidslinje-text { display:block; margin-top:6px; font-size:15px; line-height:1.5; color:var(--dim); }
.h-tidslinje-huvudcitat { display:block; margin-top:8px; font:italic 500 17px/1.4 var(--serif); color:var(--fg); }
.h-tidslinje-stycke-etikett { margin-right:4px; font:600 11px/1.4 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--dim); }
.h-tidslinje-chips, .h-tidslinje-kedja { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:9px; }
.h-tidslinje-chip { display:inline-flex; align-items:center; gap:6px; max-width:100%; min-width:0; font:12px/1.35 var(--mono); color:var(--dim); background:var(--panel2); border:1px solid var(--line); border-radius:11px; padding:3px 10px; }
.h-tidslinje-prick { display:inline-block; width:8px; height:8px; flex:0 0 8px; border-radius:50%; background:var(--dim); }
.h-tidslinje-steg-typ { font-weight:600; color:var(--fg); }
.h-tidslinje-pil { font:13px/1 var(--mono); color:var(--dim); }
.h-tidslinje-bild { display:block; margin-top:10px; max-width:420px; aspect-ratio:16 / 9; overflow:hidden; border:1px solid var(--line); border-radius:8px; background:var(--panel2); }
.h-tidslinje-bild-img { display:block; width:100%; height:100%; object-fit:cover; }

.h-tidslinje-kort-kulisser { padding:10px 13px 11px 15px; background:transparent; border-radius:10px; }
.h-tidslinje-kort-kulisser .h-tidslinje-huvud { font-size:10px; color:var(--dim); }
.h-tidslinje-kort-kulisser .h-tidslinje-tid { font-size:12px; }
.h-tidslinje-amne { display:block; margin-top:6px; font:12.5px/1.55 var(--mono); color:var(--dim); }
.h-tidslinje-amne-prefix { color:var(--fg); opacity:.85; }
.h-tidslinje-kort-kulisser.h-tidslinje-sort-justering { border-style:dashed; }
.h-tidslinje-sort-justering .h-tidslinje-amne { font-size:12px; }
.h-tidslinje-sort-justering .h-tidslinje-amne-prefix { color:var(--dim); opacity:1; }

.h-tidslinje-kort.h-tidslinje-nyss { border-color:var(--accent); }
.h-tidslinje-kort.h-tidslinje-nu { border-color:var(--accent); box-shadow:inset 3px 0 0 var(--accent), 0 0 0 1px var(--accent), 0 0 28px -10px var(--accent); }
.h-tidslinje-nu .h-tidslinje-har { display:inline-block; }

@media (prefers-reduced-motion: no-preference) {
  .h-tidslinje-kort, .h-tidslinje-filterknapp { transition:background-color .15s, border-color .15s, color .15s; }
}
@media (max-width:599.98px) {
  .h-tidslinje-svep { padding-left:14px; padding-right:14px; }
  .h-tidslinje-svep-minuter { display:none; }
}
@media (max-width:859.98px) {
  .h-tidslinje-sparhuvud-kulisser { padding-left:14px; border-left:2px solid var(--line); }
  .h-tidslinje-axel { position:relative; display:flex; align-items:center; gap:10px; margin:26px 0 12px; }
  .h-tidslinje-axel::after { content:''; flex:1 1 auto; height:1px; background:var(--line); }
  .h-tidslinje-axel.h-tidslinje-hopp { margin-top:62px; }
  .h-tidslinje-axel.h-tidslinje-hopp::before { content:''; position:absolute; left:26px; top:-40px; height:30px; border-left:2px dashed var(--svag); }
  .h-tidslinje-cell { margin-bottom:10px; }
  .h-tidslinje-cell-kulisser { padding-left:14px; border-left:2px solid var(--line); }
}
@media (min-width:860px) {
  .h-tidslinje-filtergrupp { flex-direction:row; align-items:flex-start; gap:12px; }
  .h-tidslinje-filternamn { flex:0 0 172px; padding-top:10px; }
  .h-tidslinje-filterrad { flex:1 1 0; }
  .h-tidslinje-rutnat { display:grid; grid-template-columns:minmax(0, 1fr) var(--h-tl-axel) minmax(0, 1fr); column-gap:0; align-items:stretch; }
  .h-tidslinje-sparhuvud { grid-row:1; margin-bottom:24px; }
  .h-tidslinje-sparhuvud-staden { grid-column:1; }
  .h-tidslinje-sparhuvud-kulisser { grid-column:3; }
  .h-tidslinje-axelhuvud { display:block; grid-row:1; grid-column:2; }
  .h-tidslinje-axel { position:relative; grid-column:2; grid-row:var(--h-tl-rad); display:flex; flex-direction:column; align-items:center; padding:0 0 24px; }
  .h-tidslinje-axel::before { content:''; position:absolute; top:0; bottom:0; left:50%; width:2px; margin-left:-1px; background:var(--line); }
  .h-tidslinje-klocka { position:sticky; top:62px; }
  .h-tidslinje-cell { grid-row:var(--h-tl-rad); padding-bottom:24px; }
  .h-tidslinje-cell-staden { grid-column:1; }
  .h-tidslinje-cell-kulisser { grid-column:3; }
  .h-tidslinje-sparetikett { display:none; }
  .h-tidslinje-hopp { padding-top:44px; }
  .h-tidslinje-axel.h-tidslinje-hopp::before { top:44px; }
  .h-tidslinje-axel.h-tidslinje-hopp::after { content:''; position:absolute; top:4px; left:50%; height:36px; margin-left:-1px; border-left:2px dashed var(--svag); }
  .h-tidslinje-ensam .h-tidslinje-rutnat { grid-template-columns:var(--h-tl-axel) minmax(0, 780px); }
  .h-tidslinje-ensam .h-tidslinje-sparhuvud-staden, .h-tidslinje-ensam .h-tidslinje-cell-staden { grid-column:2; }
  .h-tidslinje-ensam .h-tidslinje-axelhuvud, .h-tidslinje-ensam .h-tidslinje-axel { grid-column:1; }
}
`;

  // ---------- små hjälpare utan DOM ----------

  // Generatorn kapar långa texter mitt i en mening. En lång text som slutar utan skiljetecken får därför tre punkter.
  function medPunkter(t) {
    const s = String(t || '').trim();
    if (s.length >= 150 && /[\p{L}\d,;:]$/u.test(s)) return s.replace(/[\s,;:]+$/, '') + '…';
    return s;
  }

  // Ett fält som generatorn kapat slutar ofta mitt i ett ord. Backa till senaste hela ord och sätt tre punkter.
  function kapaVidOrd(t) {
    const s = String(t || '').trim();
    const hel = s.replace(/\s+\S*$/, '');
    const bas = (hel.length >= s.length * 0.6 ? hel : s).replace(/[\s,;:]+$/, '');
    return bas + (/[.!?]$/.test(bas) ? ' …' : '…');
  }

  // Blanksteg mellan delarna: syns inte i en flex-rad, men gör att skärmläsare och kopierad text inte klistrar ihop orden.
  function mellan(delar) {
    const ut = [];
    delar.forEach((d, i) => { if (i) ut.push(' '); ut.push(d); });
    return ut;
  }

  function avkoda(rå) {
    try { return JSON.parse('"' + rå + '"'); } catch (e) { /* kapad mitt i en escape */ }
    try { return JSON.parse('"' + rå.replace(/\\(u[0-9a-fA-F]{0,3})?$/, '') + '"'); } catch (e) { return rå; }
  }

  // Några milstolpar bär händelsens nyttolast som JSON, ibland kapad vid 160 tecken. Plocka ut fälten så långt det går.
  // Ger [{n, v, kapad}] eller null om texten inte är en nyttolast.
  function tolkaNyttolast(text) {
    const s = String(text || '').trim();
    if (s.charAt(0) !== '{') return null;
    try {
      const o = JSON.parse(s);
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const hela = Object.keys(o).map(n => ({ n, v: o[n], kapad: false }));
        return hela.length ? hela : null;
      }
    } catch (e) { /* kapad: gå vidare med det som går att läsa */ }
    const ut = [];
    const re = /"((?:[^"\\]|\\.)+)"\s*:\s*(?:"((?:[^"\\]|\\.)*)("?)|(-?\d+(?:\.\d+)?)(?=\s*[,}]))/g;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[4] !== undefined) ut.push({ n: avkoda(m[1]), v: Number(m[4]), kapad: false });
      else ut.push({ n: avkoda(m[1]), v: avkoda(m[2]), kapad: m[3] !== '"' });
    }
    return ut.length ? ut : null;
  }

  // Ämnesrader: skilj det som inför något nytt från justeringar. Det är en läsning av orden, inget facit:
  // den styr bara vad som visas först, alla rader finns kvar under "Allt".
  const FIXSTAM = ['krock', 'trasig', 'fix', 'bugg', 'avstå', 'tidsgräns'];
  const FIXORD = new Set(['tål', 'annars', 'inte', 'eftersom']);
  const FIXFRAS = ['i stället för', 'istället för', 'räknas som'];
  function ärJustering(ämne, prefix, settFörut) {
    const låg = ämne.toLowerCase();
    if (prefix && /\.md$/i.test(prefix)) return true;                 // dokumentation
    if (prefix && settFörut.has(prefix.toLowerCase())) return true;   // samma sak en gång till: finslipning
    if (FIXFRAS.some(f => låg.includes(f))) return true;
    return låg.split(/[^\p{L}\d]+/u).some(o => o && (FIXORD.has(o) || FIXSTAM.some(st => o.startsWith(st))));
  }

  // Bara bilder som Torgets egen server delar ut, på samma värd: /bilder/<team>/<fil>. Inga punktsegment, inga andra adresser.
  const BILDURL = /^\/bilder\/[A-Za-z0-9_-][A-Za-z0-9._-]*\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:jpe?g|png|webp)$/i;

  // ---------- sektionen ----------

  function rendera(el, data, api) {
    data = data || {};
    const meta = data.meta || {};
    if (!document.getElementById('h-tidslinje-stil')) {
      const stil = document.createElement('style'); stil.id = 'h-tidslinje-stil'; stil.textContent = CSS; document.head.append(stil);
    }
    const rot = api.el('div', { class: 'h-tidslinje' });
    el.append(rot);

    const kvarterLista = Array.isArray(data.kvarter) ? data.kvarter : [];
    const kvarterAv = team => kvarterLista.find(k => k && k.team === team) || null;
    const färgAv = team => { try { return kvarterAv(team) ? api.färg(team) : null; } catch (e) { return null; } };   // okända avsändare får ingen teamfärg
    // Kvartersnamnet, men bara när det säger något utöver teamnamnet: willebus → Genomfarten, medan torget → Torget bara är samma ord igen.
    const annatNamn = team => { const k = kvarterAv(team); const n = k && k.namn ? String(k.namn) : ''; return n && n.toLowerCase() !== String(team).toLowerCase() ? n : ''; };

    // Alla sammanfogade bidrag från teamen, per PR-nummer.
    const prIndex = new Map();
    for (const k of kvarterLista) for (const p of (k && Array.isArray(k.pr) ? k.pr : [])) if (p && Number.isFinite(p.nr)) prIndex.set(p.nr, { team: k.team, pr: p });

    // Spår 1: staden.
    const staden = (Array.isArray(data.milstolpar) ? data.milstolpar : [])
      .filter(m => m && Number.isFinite(m.ts))
      .map(m => ({ ts: m.ts, spår: 'staden', sort: äger(SORTER, m.sort) ? m.sort : 'annat', råsort: String(m.sort || ''), rubrik: String(m.rubrik || '').trim(), text: String(m.text || '').trim() }))
      .sort((a, b) => a.ts - b.ts);

    // Spår 2: bakom kulisserna. Ett fåtal av teamens egna bidrag har slunkit med i listan (ämnesrader som slutar med
    // ett PR-nummer som finns bland kvarterens PR:ar). De är inte ledningens verk och hör inte hemma här.
    const kulisser = [];
    const settFörut = new Set();
    let teamBidrag = 0;
    const råVerktyg = (Array.isArray(data.verktyg) ? data.verktyg : []).filter(v => v && Number.isFinite(v.ts)).slice().sort((a, b) => a.ts - b.ts);
    for (const v of råVerktyg) {
      const ämne = String(v.ämne || '').trim();
      if (!ämne) continue;
      const pr = /\(#(\d+)\)\s*$/.exec(ämne);
      if (pr && prIndex.has(Number(pr[1]))) { teamBidrag++; continue; }
      const i = ämne.indexOf(': ');
      const prefix = i > 0 && i <= 40 ? ämne.slice(0, i) : '';
      const sort = ärJustering(ämne, prefix, settFörut) ? 'justering' : 'nytt';
      if (prefix) settFörut.add(prefix.toLowerCase());
      kulisser.push({ ts: v.ts, spår: 'kulisser', sort, ämne, prefix });
    }

    const alla = staden.concat(kulisser);
    if (!alla.length) { rot.append(api.el('p', { class: 'h-tidslinje-tomt', text: 'Det finns inga milstolpar i historiken.' })); return; }

    // Dagens utsträckning. Finns meta används den, men aldrig snävare än det som faktiskt ska ritas.
    let t0 = Infinity, t1 = -Infinity;
    for (const p of alla) { if (p.ts < t0) t0 = p.ts; if (p.ts > t1) t1 = p.ts; }
    if (Number.isFinite(meta.start)) t0 = Math.min(t0, meta.start);
    if (Number.isFinite(meta.slut)) t1 = Math.max(t1, meta.slut);
    const spann = t1 - t0;
    const andel = ts => (spann > 0 ? Math.max(0, Math.min(100, (ts - t0) / spann * 100)) : 0);
    const filmFrån = Number.isFinite(meta.start) ? meta.start : t0, filmTill = Number.isFinite(meta.slut) ? meta.slut : t1;
    const hoppa = ts => api.hoppa(Math.max(filmFrån, Math.min(Math.max(filmFrån, filmTill), ts)));

    function form(sort) {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('class', 'h-tidslinje-form'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
      for (const [tagg, attr] of (äger(FORMER, sort) ? FORMER[sort] : FORMER.annat)) {
        const d = document.createElementNS(NS, tagg);
        for (const k of Object.keys(attr)) d.setAttribute(k, attr[k]);
        s.append(d);
      }
      return s;
    }

    function chip(text, team) {
      const c = api.el('span', { class: 'h-tidslinje-chip' });
      if (team !== undefined) { const p = api.el('span', { class: 'h-tidslinje-prick' }); const f = färgAv(team); if (f) p.style.background = f; c.append(p); }
      c.append(api.el('span', { text }));
      return c;
    }

    // ---------- kortens innehåll ----------

    function faktatext(n, v) {
      const värde = typeof v === 'number' ? api.tal(v) : String(v);
      if (n === 'nummer') return 'nummer ' + värde;
      if (n === 'till') return 'till ' + värde;
      if (n === 'om') { const namn = annatNamn(värde); return 'om ' + värde + (namn ? ' (' + namn + ')' : ''); }
      if (n === 'mörker') return 'mörkertal ' + värde;               // skalan står ingenstans i datat, så den påstås inte heller
      if (n === 'megawatt') return värde + ' megawatt';
      if (n === 'temperatur_miljoner_grader') return värde + ' miljoner grader';
      return String(n).replace(/_/g, ' ') + ': ' + värde;
    }

    function ritaNyttolast(kort, fält, rubrik) {
      const chips = [], stycken = [];
      let bild = '', bildtext = '';
      const url = (fält.find(f => f.n === 'url' && typeof f.v === 'string') || {}).v || '';
      if (BILDURL.test(url)) bild = url;
      for (const f of fält) {
        if (f.n === 'url') continue;
        if (typeof f.v === 'number' && Number.isFinite(f.v)) { chips.push(faktatext(f.n, f.v)); continue; }
        if (typeof f.v !== 'string') continue;
        let t = f.v.trim();
        if (!t) continue;
        if (f.kapad) { if (t.length < 12) continue; t = kapaVidOrd(t); }
        if (f.n === 'prompt') bildtext = t;
        if (f.n === 'namn' && bild) continue;                                     // bildens filnamn säger inget när bilden syns
        if (f.n === 'rubrik' || f.n === 'titel') stycken.push({ huvud: true, text: t });
        else if (t.length > 48 || f.n === 'prompt' || f.n === 'text' || f.n === 'visar' || f.n === 'döljer') {
          const etikett = f.n === 'prompt' ? 'Beställningen' : f.n === 'text' ? (url === '/radio' ? 'Sändningen börjar' : 'Text') : f.n === 'visar' ? 'Visar' : f.n === 'döljer' ? 'Döljer'
            : String(f.n).charAt(0).toUpperCase() + String(f.n).slice(1).replace(/_/g, ' ');
          stycken.push({ etikett, text: t });
        } else chips.push(faktatext(f.n, t));
      }
      if (!chips.length && !stycken.length && !bild) return false;
      for (const s of stycken.filter(s => s.huvud)) kort.append(api.el('span', { class: 'h-tidslinje-huvudcitat', text: s.text }));
      if (chips.length) kort.append(api.el('span', { class: 'h-tidslinje-chips' }, mellan(chips.map(c => chip(c)))));
      for (const s of stycken.filter(s => !s.huvud)) kort.append(api.el('span', { class: 'h-tidslinje-text' }, [api.el('span', { class: 'h-tidslinje-stycke-etikett', text: s.etikett }), ' ', s.text]));
      if (bild) {
        const ram = api.el('span', { class: 'h-tidslinje-bild' });
        const img = api.el('img', { class: 'h-tidslinje-bild-img', alt: bildtext || rubrik || 'Bild', loading: 'lazy', decoding: 'async' });
        img.addEventListener('error', () => ram.remove());
        img.src = bild;
        ram.append(img); kort.append(ram);
      }
      return true;
    }

    // "Team markus (PR #3): titel" blir teamnamn med färgprick, PR-nummer, vem som skickade in, och titeln som text.
    function ritaKvarter(kort, text) {
      const m = /^Team (\S+) \(PR #(\d+)\):\s*([\s\S]*)$/.exec(text);
      if (!m) return false;
      const team = m[1], nr = Number(m[2]);
      let titel = m[3].trim();
      const känd = prIndex.get(nr);
      const pr = känd && känd.team === team ? känd.pr : null;
      if (pr && typeof pr.titel === 'string' && pr.titel.length > titel.length && pr.titel.startsWith(titel)) titel = kapaVidOrd(titel);
      kort.style.setProperty('--h-tl-farg', färgAv(team) || 'var(--me)');
      const chips = [chip('team ' + team, team), chip('PR #' + nr)];
      if (pr && pr.av) chips.push(chip('av ' + pr.av));
      if (pr && Number.isFinite(pr.rader) && pr.rader > 0) chips.push(chip(api.tal(pr.rader) + ' rader'));
      kort.append(api.el('span', { class: 'h-tidslinje-chips' }, mellan(chips)));
      if (titel) kort.append(api.el('span', { class: 'h-tidslinje-text', text: titel }));
      return true;
    }

    // "fråga (mohamad) → delsvar (willebus)" blir en kedja av steg, vart och ett med team och kvartersnamn utskrivna.
    function ritaKedja(kort, text) {
      const delar = text.split(/\s*→\s*/);
      if (delar.length < 2) return false;
      const steg = delar.map(d => /^(.+?)\s*\(([^()]+)\)$/.exec(d.trim()));
      if (steg.some(s => !s)) return false;
      const rad = api.el('span', { class: 'h-tidslinje-kedja' });
      steg.forEach((s, i) => {
        if (i) rad.append(' ', api.el('span', { class: 'h-tidslinje-pil', text: '→' }), ' ');
        const team = s[2].trim(), namn = annatNamn(team);
        const c = api.el('span', { class: 'h-tidslinje-chip' }, [api.el('span', { class: 'h-tidslinje-steg-typ', text: s[1].trim() }), ' ']);
        const p = api.el('span', { class: 'h-tidslinje-prick' }); const f = färgAv(team); if (f) p.style.background = f;
        c.append(p, api.el('span', { text: team + (namn ? ' · ' + namn : '') }));
        rad.append(c);
      });
      kort.append(rad);
      return true;
    }

    // "#staden-puls · zero-cool": kanalen och vem som skrev inlägget. Är avsändaren ett kvarter står kvartersnamnet med,
    // är det en av stadens invånare står det vilket kvarter hen bor i.
    function ritaVolym(kort, text) {
      const m = /^#(\S+) · (.+)$/.exec(text);
      if (!m) return false;
      const vem = m[2].trim(), k = kvarterAv(vem), namn = annatNamn(vem);
      const hem = k ? null : kvarterLista.find(q => q && q.team && q.invånare && q.invånare.namn === vem) || null;   // stadens påhittade invånare skrev också inlägg
      kort.append(api.el('span', { class: 'h-tidslinje-chips' }, mellan([chip('#' + m[1]), chip('av ' + vem + (namn ? ' · ' + namn : '') + (hem ? ' · invånare i ' + (hem.namn || hem.team) : ''), k ? vem : hem ? hem.team : undefined)])));
      return true;
    }

    function kortbas(p, etikett, extraklass) {
      const kl = api.kl(p.ts);
      const kort = api.el('button', { type: 'button', class: 'h-tidslinje-kort ' + extraklass + 'h-tidslinje-sort-' + p.sort, title: 'Spola filmen till ' + kl });
      kort.append(api.el('span', { class: 'h-tidslinje-huvud' }, mellan([form(p.sort), api.el('span', { class: 'h-tidslinje-etikett', text: etikett }),
        api.el('span', { class: 'h-tidslinje-har', text: 'filmen är här' }), api.el('span', { class: 'h-tidslinje-tid', text: kl })])));
      kort.addEventListener('click', () => hoppa(p.ts));
      return kort;
    }

    function kortStaden(p) {
      const kort = kortbas(p, äger(SORTER, p.sort) ? SORTER[p.sort].etikett : (p.råsort || 'Milstolpe'), '');
      kort.append(api.el('span', { class: 'h-tidslinje-rubrik', text: p.rubrik || 'Milstolpe' }));
      if (p.text) {
        const fält = tolkaNyttolast(p.text);
        const ritad = (fält && ritaNyttolast(kort, fält, p.rubrik)) || (p.sort === 'kvarter' && ritaKvarter(kort, p.text)) || (p.sort === 'rekord' && ritaKedja(kort, p.text)) || (p.sort === 'volym' && ritaVolym(kort, p.text));
        if (!ritad) kort.append(api.el('span', { class: 'h-tidslinje-text', text: medPunkter(p.text) }));
      }
      const teamfärg = kort.style.getPropertyValue('--h-tl-farg');               // kvarterets streck i svepet får samma färg som kortet
      if (teamfärg && p.streck) p.streck.style.setProperty('--h-tl-farg', teamfärg);
      kort.append(api.el('span', { class: 'h-tidslinje-dold', text: '. Spola filmen hit.' }));
      return kort;
    }

    function kortKulisser(p) {
      const kort = kortbas(p, p.sort === 'nytt' ? 'Nytt' : 'Justering', 'h-tidslinje-kort-kulisser ');
      const ämne = p.ämne.length >= 150 ? p.ämne + '…' : p.ämne;   // generatorn kapar ämnesrader vid 150 tecken
      const rad = api.el('span', { class: 'h-tidslinje-amne' });
      if (p.prefix) rad.append(api.el('span', { class: 'h-tidslinje-amne-prefix', text: p.prefix + ':' }), ämne.slice(p.prefix.length + 1));
      else rad.append(ämne);
      kort.append(rad, api.el('span', { class: 'h-tidslinje-dold', text: '. Spola filmen hit.' }));
      return kort;
    }

    // ---------- dagen i ett svep: samma milstolpar utlagda efter verklig tid ----------

    let nuStreck = null, nuTid = null, svep = null;
    const svepRader = [];                                                       // {lista, etikett, rad} så ett spår som göms också försvinner ur svepet
    if (spann > 0) {
      svep = api.el('div', { class: 'h-tidslinje-svep', role: 'img' });
      svep.append(api.el('div', { class: 'h-tidslinje-svep-topp' }, [api.el('span', { text: 'Dagen i ett svep' }), api.el('span', { text: api.kl(t0) + '–' + api.kl(t1) })]));
      const yta = api.el('div', { class: 'h-tidslinje-svep-yta' });
      const timmar = api.el('div', { class: 'h-tidslinje-svep-timmar' });
      for (let t = Math.ceil(t0 / TIMME) * TIMME, n = 0; t <= t1 && n < 48; t += TIMME, n++) {
        const linje = api.el('span', { class: 'h-tidslinje-svep-timme' }); linje.style.left = andel(t) + '%'; yta.append(linje);
        const kl = api.kl(t);
        const text = api.el('span', { class: 'h-tidslinje-svep-timtext' }, [kl.slice(0, 2), api.el('span', { class: 'h-tidslinje-svep-minuter', text: kl.slice(2) })]);
        text.style.left = andel(t) + '%'; timmar.append(text);
      }
      for (const [namn, lista] of [['Staden', staden], ['Bakom kulisserna', kulisser]]) {
        if (!lista.length) continue;
        const rad = api.el('div', { class: 'h-tidslinje-svep-rad' });
        for (const p of lista) { p.streck = api.el('span', { class: 'h-tidslinje-streck h-tidslinje-sort-' + p.sort }); p.streck.style.left = andel(p.ts) + '%'; rad.append(p.streck); }
        const etikett = api.el('div', { class: 'h-tidslinje-svep-radnamn', text: namn });
        svepRader.push({ lista, etikett, rad });
        yta.append(etikett, rad);
      }
      nuTid = api.el('span', { class: 'h-tidslinje-svep-nutid' });
      nuStreck = api.el('span', { class: 'h-tidslinje-svep-nu' }, [nuTid]); nuStreck.hidden = true;
      yta.append(timmar, nuStreck);
      svep.append(yta); rot.append(svep);
    }

    // ---------- rutnätet: en rad per tio minuter ----------

    const hinkar = new Map();
    for (const p of alla) {
      const k = Math.floor(p.ts / TIO);
      if (!hinkar.has(k)) hinkar.set(k, { k, staden: [], kulisser: [] });
      hinkar.get(k)[p.spår].push(p);
    }
    const rader = Array.from(hinkar.values()).sort((a, b) => a.k - b.k);

    const rutnät = api.el('div', { class: 'h-tidslinje-rutnat' });
    if (staden.length) rutnät.append(api.el('div', { class: 'h-tidslinje-sparhuvud h-tidslinje-sparhuvud-staden' }, [api.el('h3', { class: 'h-tidslinje-sparnamn', text: 'Staden' }),
      api.el('p', { class: 'h-tidslinje-sparingress', text: 'Vad teamen och staden gjorde: ' + api.tal(staden.length) + (staden.length === 1 ? ' milstolpe' : ' milstolpar') + '. Märket Ledningen betyder att workshopledningen byggde det, inte ett deltagarteam.' })]));
    rutnät.append(api.el('div', { class: 'h-tidslinje-axelhuvud', 'aria-hidden': 'true' }));
    const kulissIngress = api.el('p', { class: 'h-tidslinje-sparingress' });
    const kulissHuvud = api.el('div', { class: 'h-tidslinje-sparhuvud h-tidslinje-sparhuvud-kulisser' }, [api.el('h3', { class: 'h-tidslinje-sparnamn', text: 'Bakom kulisserna' }), kulissIngress]);
    if (kulisser.length) rutnät.append(kulissHuvud);

    rader.forEach((r, i) => {
      const rad = String(i + 2);
      r.axel = api.el('div', { class: 'h-tidslinje-axel' }, [api.el('span', { class: 'h-tidslinje-klocka', text: api.kl(r.k * TIO) })]);
      r.cellS = api.el('div', { class: 'h-tidslinje-cell h-tidslinje-cell-staden' });
      r.cellK = api.el('div', { class: 'h-tidslinje-cell h-tidslinje-cell-kulisser' }, [api.el('span', { class: 'h-tidslinje-sparetikett', text: 'Bakom kulisserna' })]);
      for (const e of [r.axel, r.cellS, r.cellK]) e.style.setProperty('--h-tl-rad', rad);
      for (const p of r.staden) { p.kort = kortStaden(p); r.cellS.append(p.kort); }
      for (const p of r.kulisser) { p.kort = kortKulisser(p); r.cellK.append(p.kort); }
      rutnät.append(r.axel, r.cellS, r.cellK);
    });

    // ---------- filter ----------

    const valda = new Set();                                   // tom mängd = alla sorter
    const antalNytt = kulisser.filter(p => p.sort === 'nytt').length;
    const harUrval = antalNytt > 0 && antalNytt < kulisser.length;     // finns både nytt och justeringar går det att välja
    let läge = harUrval ? 'nytt' : 'allt';                             // 'nytt' | 'allt' | 'dolj'
    const synlig = p => (p.spår === 'staden' ? valda.size === 0 || valda.has(p.sort) : läge === 'allt' || (läge === 'nytt' && p.sort === 'nytt'));

    const filter = api.el('div', { class: 'h-tidslinje-filter' });
    const sortKnappar = [];
    function filterknapp(text, antal, sort, om) {
      const b = api.el('button', { type: 'button', class: 'h-tidslinje-filterknapp' + (sort ? ' h-tidslinje-sort-' + sort : ''), 'aria-pressed': 'false' });
      if (om) b.setAttribute('title', om);
      if (sort) b.append(form(sort));
      b.append(api.el('span', { text }));
      if (antal !== null) b.append(api.el('span', { class: 'h-tidslinje-antal', text: api.tal(antal) }));
      return b;
    }

    if (staden.length) {
      const knapprad = api.el('div', { class: 'h-tidslinje-filterrad' });
      const grupp = api.el('div', { class: 'h-tidslinje-filtergrupp', role: 'group', 'aria-label': 'Välj vilka sorters milstolpar i staden som visas' }, [api.el('span', { class: 'h-tidslinje-filternamn', text: 'Staden' }), knapprad]);
      const allaKnapp = filterknapp('Alla', staden.length, '', 'Visa alla sorters milstolpar');
      allaKnapp.addEventListener('click', () => { valda.clear(); uppdatera(); });
      sortKnappar.push({ sort: null, knapp: allaKnapp }); knapprad.append(allaKnapp);
      const finns = ORDNING.filter(s => staden.some(p => p.sort === s));
      if (staden.some(p => p.sort === 'annat')) finns.push('annat');
      for (const s of finns) {
        const info = äger(SORTER, s) ? SORTER[s] : { etikett: 'Övrigt', om: 'Milstolpar av annan sort' };
        const b = filterknapp(info.etikett, staden.filter(p => p.sort === s).length, s, info.om);
        b.addEventListener('click', () => { if (valda.has(s)) valda.delete(s); else valda.add(s); if (valda.size === finns.length) valda.clear(); uppdatera(); });
        sortKnappar.push({ sort: s, knapp: b }); knapprad.append(b);
      }
      filter.append(grupp);
    }

    const lägesKnappar = [];
    if (kulisser.length) {
      const knapprad = api.el('div', { class: 'h-tidslinje-filterrad' });
      const grupp = api.el('div', { class: 'h-tidslinje-filtergrupp', role: 'group', 'aria-label': 'Välj hur mycket av spåret bakom kulisserna som visas' }, [api.el('span', { class: 'h-tidslinje-filternamn', text: 'Bakom kulisserna' }), knapprad]);
      const val = [];
      if (harUrval) val.push(['nytt', 'Det nya', antalNytt, 'nytt', 'Bara de rader som ser ut att införa något nytt. Rader som låter som justering, rättning eller dokumentation göms.']);
      val.push(['allt', 'Allt', kulisser.length, '', 'Alla ändringar, även justeringar och rättningar']);
      val.push(['dolj', 'Dölj spåret', null, '', 'Visa bara staden']);
      for (const [l, text, antal, sort, om] of val) {
        const b = filterknapp(text, antal, sort, om);
        b.addEventListener('click', () => { läge = l; uppdatera(); });
        lägesKnappar.push({ läge: l, knapp: b }); knapprad.append(b);
      }
      filter.append(grupp);
    }

    const tomt = api.el('p', { class: 'h-tidslinje-tomt' });
    tomt.hidden = true;
    rot.append(filter, rutnät, tomt);

    // ---------- filmens klocka ----------

    let synligaS = [], synligaK = [], filmTs = null, nuKort = null, nyssKort = null, senAndel = null, senMinut = null;
    const senaste = (lista, ts) => { let hit = null; for (const p of lista) { if (p.ts <= ts) hit = p; else break; } return hit; };

    function markera() {
      let nu = null, nyss = null;
      if (filmTs !== null) {
        const a = senaste(synligaS, filmTs), b = senaste(synligaK, filmTs);
        if (a && b) { nu = b.ts > a.ts ? b : a; nyss = nu === a ? b : a; } else nu = a || b;   // den senast passerade bär märket, det andra spårets senaste får en svagare ram
        if (nyss && nu.ts - nyss.ts > TIO) nyss = null;                                       // men bara om det hände ungefär samtidigt, annars pekar ramen ut något som är timmar gammalt
      }
      const nuE = nu ? nu.kort : null, nyssE = nyss ? nyss.kort : null;
      if (nuE !== nuKort) { if (nuKort) nuKort.classList.remove('h-tidslinje-nu'); if (nuE) nuE.classList.add('h-tidslinje-nu'); nuKort = nuE; }
      if (nyssE !== nyssKort) { if (nyssKort) nyssKort.classList.remove('h-tidslinje-nyss'); if (nyssE) nyssE.classList.add('h-tidslinje-nyss'); nyssKort = nyssE; }
    }

    function uppdatera() {
      let föregående = null, antal = 0;
      for (const r of rader) {
        let nS = 0, nK = 0;
        for (const p of r.staden) { const s = synlig(p); p.kort.hidden = !s; if (p.streck) p.streck.hidden = !s; if (s) nS++; }
        for (const p of r.kulisser) { const s = synlig(p); p.kort.hidden = !s; if (p.streck) p.streck.hidden = !s; if (s) nK++; }
        const syns = nS + nK > 0;
        r.cellS.hidden = nS === 0; r.cellK.hidden = nK === 0; r.axel.hidden = !syns;
        const hopp = syns && föregående !== null && r.k - föregående > 3;   // mer än en halvtimme till förra raden: bruten axel
        for (const e of [r.axel, r.cellS, r.cellK]) e.classList.toggle('h-tidslinje-hopp', hopp);
        if (syns) { föregående = r.k; antal++; }
      }
      tomt.hidden = antal > 0;
      tomt.textContent = staden.length && valda.size ? 'Inga milstolpar av de valda sorterna. Välj Alla för att se hela dagen.' : 'Inget visas just nu. Välj Allt under Bakom kulisserna för att se spåret igen.';
      kulissHuvud.hidden = läge === 'dolj';
      rot.classList.toggle('h-tidslinje-ensam', läge === 'dolj' || !kulisser.length);
      for (const k of sortKnappar) k.knapp.setAttribute('aria-pressed', String(k.sort === null ? valda.size === 0 : valda.has(k.sort)));
      for (const k of lägesKnappar) k.knapp.setAttribute('aria-pressed', String(k.läge === läge));
      synligaS = staden.filter(synlig); synligaK = kulisser.filter(synlig);
      for (const s of svepRader) { const utan = !s.lista.some(synlig); s.etikett.hidden = utan; s.rad.hidden = utan; }   // ett gömt spår lämnar ingen tom rad i svepet
      // Texterna säger det som faktiskt syns: hela dagens antal, och hur många av dem som visas just nu.
      kulissIngress.textContent = 'Medan teamen byggde staden byggde workshopledarens agent verktygen runt den: ' + api.tal(kulisser.length) + (kulisser.length === 1 ? ' ändring' : ' ändringar') + ' under dagen. Ämnesraderna står som de skrevs, för utvecklare.' +
        (teamBidrag ? ' Teamens egna sammanfogade bidrag räknas inte hit, de står som milstolpar i Stadens spår.' : '') +
        (läge === 'nytt' ? ' Just nu visas ' + api.tal(synligaK.length) + ' av dem, de som ser ut att införa något nytt. Den uppdelningen är en läsning av orden i ämnesraden, inget som står i loggen: välj Allt för att se alla ' + api.tal(kulisser.length) + '.' : '');
      if (svep) svep.setAttribute('aria-label', 'Dagen från ' + api.kl(t0) + ' till ' + api.kl(t1) + ', utlagd efter klockslag. Just nu visas ' + api.tal(synligaS.length) + (synligaS.length === 1 ? ' milstolpe' : ' milstolpar') + ' i staden' +
        (synligaK.length ? ' och ' + api.tal(synligaK.length) + (synligaK.length === 1 ? ' ändring' : ' ändringar') + ' bakom kulisserna' : '') + '.');
      markera();
    }
    uppdatera();

    if (typeof api.påTid === 'function') {
      api.påTid(ts => {
        if (!Number.isFinite(ts)) return;
        filmTs = ts;
        if (nuStreck) {
          const a = Math.round(andel(ts) * 10) / 10;
          if (a !== senAndel) {
            nuStreck.style.left = a + '%'; senAndel = a;
            nuStreck.classList.toggle('h-tidslinje-svep-nu-tidigt', a < 8); nuStreck.classList.toggle('h-tidslinje-svep-nu-sent', a > 92);
          }
          const minut = Math.floor(ts / 60000);
          if (minut !== senMinut) { nuTid.textContent = api.kl(ts); senMinut = minut; }
          if (nuStreck.hidden) nuStreck.hidden = false;
        }
        markera();
      });
    }
  }

  H.sektioner.tidslinje = {
    titel: 'Milstolpar',
    meny: 'Milstolpar',
    ingang: 'Två spår med gemensam klocka: vad teamen och staden gjorde, och vad workshopledarens agent byggde bakom kulisserna under tiden. Klicka på en milstolpe så spolar filmen dit.',
    rendera,
  };
})();
