// Filmen: hela workshopdagen uppspelad på ungefär 90 sekunder.
// Kvarteren dyker upp när de gick live, och varje rad i data.puls med en orsak blir en glödande tråd
// från kvarteret som orsakade händelsen till kvarteret som reagerade. Allt ritas på en <canvas> med
// requestAnimationFrame: inga DOM-noder per händelse, högst MAX_TRADAR trådar samtidigt.
(function () {
  'use strict';
  if (!window.Historia || !window.Historia.sektioner) return;

  const FILM_MS = 90000;            // hela dagen tar så här lång tid vid 1×
  const FARTER = [1, 2, 4];
  const MAX_TRADAR = 60;            // tak för samtidiga trådar
  const MAX_PER_BILD = 60;          // tak för nya trådar i en och samma bildruta
  const RESA = 520, SVANS = 240, LIV = RESA + SVANS;   // trådens liv i verklig tid (ms)
  const POP_MS = 900;               // så länge tar det för ett nytt kvarter att slå ut
  const INSATS = 9;                 // halva tummen på tidslinjen, så att kurvan hamnar mitt under den
  const KURVA_H = 78;
  const STEG_MS = 5 * 60000;        // piltangenterna spolar fem minuter
  const SORTER = { start: 'Start', beslut: 'Beslut', puls: 'Stadens puls', kvarter: 'Nytt kvarter', rekord: 'Rekord', ledning: 'Ledningen', volym: 'Volym', slut: 'Slut' };

  const CSS = `
.h-replay { position:relative; border-radius:14px; }
.h-replay:focus { outline:none; }
.h-replay [hidden] { display:none !important; }
.h-replay:focus-visible { outline:2px solid var(--accent); outline-offset:10px; }
.h-replay-topp { display:flex; align-items:flex-end; justify-content:space-between; gap:18px 32px; flex-wrap:wrap; margin:0 0 18px; }
.h-replay-tidruta { min-width:0; }
.h-replay-datum { font:600 12px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:0 0 10px; }
.h-replay-klocka { font:800 clamp(60px, 10vw, 112px)/.86 var(--mono); letter-spacing:-.04em; color:var(--fg); font-variant-numeric:tabular-nums; }
.h-replay-raknare { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:12px; overflow:hidden; flex:1 1 440px; max-width:660px; min-width:0; }
.h-replay-raknare > div { background:var(--panel); padding:12px 16px; min-width:0; }
.h-replay-raknare b { display:block; font:800 28px/1.1 var(--mono); font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--fg); }
.h-replay-raknare b i { font:600 13px var(--mono); font-style:normal; color:var(--dim); }
.h-replay-raknare > div > span { display:block; font-size:12.5px; line-height:1.3; color:var(--dim); margin-top:4px; }
.h-replay-raknare small { display:block; font:11.5px/1.3 var(--mono); color:var(--dim); margin-top:3px; min-height:1.3em; }
.h-replay-scen { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; cursor:pointer; }
.h-replay-duk { width:100%; min-width:0; }
.h-replay-karta { display:block; width:100%; }
.h-replay-forklaring { font-size:13px; line-height:1.55; color:var(--dim); margin:10px 2px 0; max-width:900px; }
.h-replay-reglage { display:flex; align-items:center; gap:10px 14px; flex-wrap:wrap; margin:20px 0 8px; }
.h-replay-spela { min-width:96px; }
.h-replay-spela:focus-visible { outline:2px solid var(--fg); outline-offset:2px; }
.h-replay-fart { display:inline-flex; border:1px solid var(--line); border-radius:9px; overflow:hidden; }
.h-replay-fart button { background:transparent; color:var(--dim); border:0; border-right:1px solid var(--line); padding:8px 13px; font:600 13px var(--mono); cursor:pointer; }
.h-replay-fart button:last-child { border-right:0; }
.h-replay-fart button:hover { color:var(--fg); }
.h-replay-fart button[aria-pressed="true"] { background:var(--panel2); color:var(--accent); }
.h-replay-fart button:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
.h-replay-spann { margin-left:auto; font:12px var(--mono); color:var(--dim); }
.h-replay-linje { position:relative; min-width:0; }
.h-replay-tid { -webkit-appearance:none; appearance:none; display:block; width:100%; height:22px; margin:0; padding:0; background:transparent; cursor:pointer; --p:0%; }
.h-replay-tid:focus { outline:none; }
.h-replay-tid:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:6px; }
.h-replay-tid::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:linear-gradient(to right, var(--accent) 0, var(--accent) var(--p), var(--line) var(--p), var(--line) 100%); }
.h-replay-tid::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; box-sizing:border-box; width:18px; height:18px; margin-top:-7px; border-radius:50%; background:var(--accent); border:3px solid var(--bg); box-shadow:0 0 0 1px var(--accent); }
.h-replay-tid::-moz-range-track { height:4px; border-radius:2px; background:var(--line); }
.h-replay-tid::-moz-range-progress { height:4px; border-radius:2px; background:var(--accent); }
.h-replay-tid::-moz-range-thumb { box-sizing:border-box; width:18px; height:18px; border-radius:50%; background:var(--accent); border:3px solid var(--bg); box-shadow:0 0 0 1px var(--accent); }
.h-replay-kurva { display:block; width:100%; height:${KURVA_H}px; margin-top:2px; touch-action:pan-y; cursor:crosshair; }
.h-replay-kurvtext { display:flex; justify-content:space-between; align-items:baseline; gap:4px 16px; flex-wrap:wrap; font-size:12.5px; line-height:1.5; color:var(--dim); margin:6px 2px 0; }
.h-replay-avlast { font-family:var(--mono); color:var(--fg); white-space:nowrap; }
.h-replay-rader { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); gap:16px; margin-top:24px; }
.h-replay-ruta { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px 18px; min-height:168px; min-width:0; }
.h-replay-vinjett { display:flex; flex-wrap:wrap; gap:2px 10px; font:600 11px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 8px; }
.h-replay-vinjett b { color:var(--accent); font-weight:600; }
.h-replay-mrubrik { font:700 19px/1.25 var(--sans); margin:0 0 4px; overflow-wrap:anywhere; }
.h-replay-mtext { font-size:14px; line-height:1.5; color:var(--dim); margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
.h-replay-tidigare { list-style:none; margin:12px 0 0; padding:10px 0 0; border-top:1px solid var(--line); font-size:13px; line-height:1.6; color:var(--dim); }
.h-replay-tidigare li { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.h-replay-tidigare span { font-family:var(--mono); margin-right:8px; }
.h-replay-lopsedel { background:var(--accent); border-color:var(--accent); color:var(--bg); }
.h-replay-lopsedel .h-replay-vinjett { color:var(--bg); }
.h-replay-lopsedel .h-replay-vinjett b { color:var(--bg); font-weight:600; }
.h-replay-lrubrik { font:900 clamp(21px, 2.5vw, 29px)/1.12 var(--serif); letter-spacing:-.01em; margin:0 0 8px; overflow-wrap:anywhere; }
.h-replay-lingress { font-size:14px; line-height:1.45; margin:0; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; }
.h-replay-lopsedel.h-replay-tom { background:var(--panel); border-color:var(--line); color:var(--dim); }
.h-replay-lopsedel.h-replay-tom .h-replay-vinjett, .h-replay-lopsedel.h-replay-tom .h-replay-vinjett b { color:var(--dim); }
.h-replay-lopsedel.h-replay-tom .h-replay-lrubrik { font:400 15px/1.5 var(--sans); letter-spacing:0; }
@media (max-width:760px) {
  .h-replay-rader { grid-template-columns:minmax(0, 1fr); }
  .h-replay-ruta { min-height:0; }
  .h-replay-raknare { flex-basis:100%; max-width:none; }
  .h-replay-spann { margin-left:0; flex-basis:100%; }
}
@media (max-width:560px) {
  .h-replay-scen { padding:10px; }
  .h-replay-raknare > div { padding:10px 10px; }
  .h-replay-raknare b { font-size:20px; }
  .h-replay-raknare b i { font-size:11px; }
  .h-replay-raknare > div > span { font-size:11.5px; }
  .h-replay-raknare small { font-size:10.5px; }
}
`;

  // ---------- små hjälpare ----------
  const klamma = (x, a, b) => (x < a ? a : x > b ? b : x);
  const utMjuk = q => 1 - Math.pow(1 - q, 3);
  const utStuds = q => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2); };

  // Antal poster i en stigande följd vars värde är <= x (binärsökning).
  function antalTill(n, varde, x) {
    let lo = 0, hi = n;
    while (lo < hi) { const mitt = (lo + hi) >>> 1; if (varde(mitt) <= x) lo = mitt + 1; else hi = mitt; }
    return lo;
  }

  function rundad(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function kapa(g, text, maxB) {
    text = String(text || '');
    if (g.measureText(text).width <= maxB) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + '…').width > maxB) t = t.slice(0, -1);
    return t.replace(/\s+$/, '') + '…';
  }

  function radbryt(g, text, maxB, maxRader) {
    const ord = String(text || '').split(/\s+/).filter(Boolean);
    const rader = []; let rad = '';
    for (const o of ord) {
      const prov = rad ? rad + ' ' + o : o;
      if (!rad || g.measureText(prov).width <= maxB) { rad = prov; continue; }
      rader.push(rad); rad = o;
    }
    if (rad) rader.push(rad);
    if (rader.length > maxRader) { const rest = rader.slice(maxRader - 1).join(' '); rader.length = maxRader - 1; rader.push(rest); }
    return rader.map(r => kapa(g, r, maxB));
  }

  function tom(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  window.Historia.sektioner.replay = {
    titel: 'Se staden växa fram',
    meny: 'Filmen',
    ingang: 'Hela workshopdagen uppspelad på en och en halv minut. Kvarteren dyker upp i det ögonblick de gick live, och varje glödande tråd är ett kvarter som reagerar på ett annat.',

    rendera(el, data, api) {
      data = data || {};
      const meta = data.meta || {};
      const start = Number(meta.start), slut = Number(meta.slut);
      if (!isFinite(start) || !isFinite(slut) || slut <= start) {
        el.append(api.el('p', { class: 'fel', text: 'Filmen kan inte spelas: dagens start- och sluttid saknas i historiken.' }));
        return;
      }
      const langd = slut - start;

      if (!document.getElementById('h-replay-stil')) {
        const stil = document.createElement('style'); stil.id = 'h-replay-stil'; stil.textContent = CSS; document.head.append(stil);
      }

      // ---------- färger och typsnitt ur stil.css ----------
      const rotstil = getComputedStyle(document.documentElement);
      const cssVar = (namn, reserv) => (rotstil.getPropertyValue(namn) || '').trim() || reserv;   // reserven är samma värde som i stil.css, om stilmallen inte hunnit läsas
      const F = {
        bg: cssVar('--bg', '#0b0d10'), panel: cssVar('--panel', '#12151a'), panel2: cssVar('--panel2', '#171b21'), line: cssVar('--line', '#1f242c'),
        fg: cssVar('--fg', '#e6e8eb'), dim: cssVar('--dim', '#8b949e'), svag: cssVar('--svag', '#5b6470'), accent: cssVar('--accent', '#ffb454'),
        mono: cssVar('--mono', 'ui-monospace, Menlo, monospace'), sans: cssVar('--sans', 'system-ui, sans-serif'),
      };
      const provduk = document.createElement('canvas'); provduk.width = provduk.height = 1;
      let provctx = null; try { provctx = provduk.getContext('2d', { willReadFrequently: true }); } catch (e) { provctx = null; }
      const rgbMinne = new Map();
      function rgb(farg) {
        farg = String(farg || '').trim();
        if (rgbMinne.has(farg)) return rgbMinne.get(farg);
        let v = [230, 232, 235];
        const m = /^#([0-9a-f]{6})$/i.exec(farg);
        if (m) { const x = parseInt(m[1], 16); v = [x >> 16, (x >> 8) & 255, x & 255]; }
        else if (provctx) {
          try { provctx.clearRect(0, 0, 1, 1); provctx.fillStyle = '#000'; provctx.fillStyle = farg; provctx.fillRect(0, 0, 1, 1); const d = provctx.getImageData(0, 0, 1, 1).data; v = [d[0], d[1], d[2]]; } catch (e) { /* behåll reserven */ }
        }
        rgbMinne.set(farg, v); return v;
      }
      const rgba = (v, a) => 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + a + ')';
      const bgRgb = rgb(F.bg);

      // ---------- data: pulsen ----------
      const puls = (Array.isArray(data.puls) ? data.puls : []).filter(r => Array.isArray(r) && isFinite(r[0])).slice().sort((a, b) => a[0] - b[0]);
      const N = puls.length;
      const pSek = new Float64Array(N), pDjup = new Uint8Array(N), pReak = new Uint32Array(N);
      { let md = 0, nr = 0; for (let i = 0; i < N; i++) { const r = puls[i]; pSek[i] = Number(r[0]); md = Math.max(md, Number(r[4]) || 0); pDjup[i] = Math.min(255, md); if (Number(r[3]) >= 0) nr++; pReak[i] = nr; } }
      const sekVid = i => pSek[i];

      const avs = Array.isArray(data.avsändare) ? data.avsändare : [];
      const forstSek = new Map();   // index i avsändare → första sekunden den syns på pulsen
      for (const r of puls) { for (const j of [r[2], r[3]]) { if (j >= 0 && !forstSek.has(j)) forstSek.set(j, Number(r[0])); } }

      // ---------- noder: kvarter och röster utan eget kvarter ----------
      let noder = [];
      const nodForTeam = new Map(), nodForGemener = new Map();
      for (const k of (Array.isArray(data.kvarter) ? data.kvarter : [])) {
        if (!k || !k.team || nodForTeam.has(k.team)) continue;
        const farg = api.färg(k.team);
        const live = k.live != null && isFinite(Number(k.live)) ? Number(k.live) : null;
        const nod = { typ: 'kvarter', k, team: String(k.team), namn: String(k.namn || k.team), ledning: false, live, fran: live != null ? Math.floor((live - start) / 1000) : null,
          farg, rgb: rgb(farg), ton: 1, radie: 9, x: 0, y: 0, w: 0, h: 0, synlig: false, pop: 0, blink: 0, sprite: null, bild: null };
        noder.push(nod); nodForTeam.set(nod.team, nod); nodForGemener.set(nod.team.toLowerCase(), nod);
      }
      const nodForAvs = avs.map((a, j) => {
        const namn = String(a == null ? '' : a);
        let nod = nodForTeam.get(namn) || nodForGemener.get(namn.toLowerCase()) || null;   // 'Mohamad' och 'mohamad' är samma team
        if (nod) { if (nod.fran == null && forstSek.has(j)) nod.fran = forstSek.get(j); return nod; }
        if (!namn || !forstSek.has(j)) return null;
        nod = { typ: 'rost', k: null, team: namn, namn, ledning: false, live: null, fran: forstSek.get(j), farg: F.fg, rgb: rgb(F.fg), ton: 0.9, radie: 12, x: 0, y: 0, w: 0, h: 0, synlig: false, pop: 0, blink: 0, sprite: null, bild: null };
        noder.push(nod); return nod;
      });
      noder = noder.filter(n => n.fran != null);   // ett kvarter utan live-tid och utan händelser går inte att placera i tiden
      const kvNoder = noder.filter(n => n.typ === 'kvarter');
      const delt = kvNoder.filter(n => !n.ledning), led = kvNoder.filter(n => n.ledning), roster = noder.filter(n => n.typ === 'rost');
      for (const n of noder) n.prefix = 'rgba(' + n.rgb[0] + ',' + n.rgb[1] + ',' + n.rgb[2] + ',';

      const efterTs = lista => (Array.isArray(lista) ? lista : []).filter(m => m && isFinite(Number(m.ts))).slice().sort((a, b) => a.ts - b.ts);
      const milstolpar = efterTs(data.milstolpar), rubriker = efterTs(data.rubriker);
      const minuter = (Array.isArray(data.minuter) ? data.minuter : []).filter(m => m && isFinite(Number(m.t))).slice().sort((a, b) => a.t - b.t);
      const minV = minuter.map(m => { let s = 0; for (const [nyckel, v] of Object.entries(m)) if (nyckel !== 't' && typeof v === 'number' && isFinite(v)) s += v; return s; });
      const minP = minuter.map(m => klamma((m.t + 30000 - start) / langd, 0, 1));   // mitt i minuten
      let maxV = 0; for (const v of minV) if (v > maxV) maxV = v;   // bara kurvans höjd: vilken minut som var livligast står under Rekord och kuriosa

      // ---------- DOM ----------
      const tidszon = 'Europe/Stockholm'; let datumText = '';
      try { datumText = new Intl.DateTimeFormat('sv-SE', { timeZone: meta.tidszon || tidszon, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(start)); }
      catch (e) { try { datumText = new Intl.DateTimeFormat('sv-SE', { timeZone: tidszon, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(start)); } catch (e2) { datumText = String(meta.datum || ''); } }

      const rot = api.el('div', { class: 'h-replay', tabindex: '0', role: 'group', 'aria-label': 'Filmen om hur staden växte fram. Mellanslag spelar eller pausar, piltangenterna spolar fem minuter.' });
      const klocka = api.el('div', { class: 'h-replay-klocka', text: api.kl(start) });
      const tidruta = api.el('div', { class: 'h-replay-tidruta' }, [api.el('p', { class: 'h-replay-datum', text: datumText }), klocka]);

      function raknare(etikett, suffix) {
        const n = api.el('span', { text: '0' }), i = api.el('i', { text: suffix || '' }), liten = api.el('small');
        const ruta = api.el('div', {}, [api.el('b', {}, [n, i]), api.el('span', { text: etikett }), liten]);
        return { ruta, n, i, liten };
      }
      const rKvarter = raknare('kvarter live', ' av ' + api.tal(kvNoder.length));
      const rHand = raknare('händelser på Stadens puls', '');
      const rDjup = raknare('längsta kedjan hittills', ' led');
      const raknarrad = api.el('div', { class: 'h-replay-raknare' }, [rKvarter.ruta, rHand.ruta, rDjup.ruta]);

      const karta = api.el('canvas', { class: 'h-replay-karta', role: 'img', 'aria-label': 'Karta över stadens kvarter.' });
      const duk = api.el('div', { class: 'h-replay-duk' }, karta);
      const scen = api.el('div', { class: 'h-replay-scen' }, duk);
      if (!kvNoder.length) scen.hidden = true;

      let forklaringText = 'Varje ruta är ett kvarter och dyker upp när det gick live, med klockslaget i hörnet. En glödande tråd går från kvarteret som orsakade en händelse till kvarteret som reagerade, i orsakarens färg; ju längre kedja, desto tjockare tråd. Rutan som postar blinkar till.';
      if (led.length) forklaringText += ' Rutorna med streckad ram byggdes av workshopledningen, inte av ett deltagarteam.';
      if (roster.length) forklaringText += ' Längst ned står de som postade på pulsen utan att ha ett eget kvarter.';
      forklaringText += ' Klicka på kartan eller tryck mellanslag för att spela och pausa.';
      const forklaring = api.el('p', { class: 'h-replay-forklaring', text: forklaringText });
      if (!kvNoder.length) forklaring.hidden = true;

      const spelaKnapp = api.el('button', { type: 'button', class: 'knapp fylld h-replay-spela', text: 'Spela' });
      const fartKnappar = FARTER.map(f => api.el('button', { type: 'button', 'aria-pressed': 'false', 'aria-label': 'Hastighet ' + f + ' gånger', text: f + '×' }));
      const fartgrupp = api.el('div', { class: 'h-replay-fart', role: 'group', 'aria-label': 'Hastighet' }, fartKnappar);
      const spann = api.el('span', { class: 'h-replay-spann' });
      const reglage = api.el('div', { class: 'h-replay-reglage' }, [spelaKnapp, fartgrupp, spann]);

      const TID_MAX = Math.max(1, Math.round(langd / 15000));
      const tid = api.el('input', { class: 'h-replay-tid', type: 'range', min: '0', max: String(TID_MAX), step: '1', value: '0', 'aria-label': 'Tidslinje över dagen' });
      const kurva = api.el('canvas', { class: 'h-replay-kurva', role: 'img', 'aria-label': 'Aktivitetskurva: antal inlägg per minut under dagen.' });
      const linje = api.el('div', { class: 'h-replay-linje' }, [tid, kurva]);
      const avlast = api.el('span', { class: 'h-replay-avlast' });
      let kurvBeskrivning = 'Kurvan visar antal inlägg per minut i alla kanaler. Dra i den för att spola filmen dit.';
      if (kvNoder.length) kurvBeskrivning += ' Strecken överst markerar när kvarteren gick live.';
      const kurvtext = api.el('p', { class: 'h-replay-kurvtext' }, [api.el('span', { text: kurvBeskrivning }), avlast]);
      if (!(maxV > 0)) { kurva.hidden = true; kurvtext.hidden = true; }

      // senaste milstolpen
      const mTid = api.el('b'), mSort = api.el('span');
      const mRubrik = api.el('p', { class: 'h-replay-mrubrik' }), mText = api.el('p', { class: 'h-replay-mtext' }), mTidigare = api.el('ul', { class: 'h-replay-tidigare' });
      const mInnehall = api.el('div', {}, [api.el('p', { class: 'h-replay-vinjett' }, [api.el('span', { text: 'Senaste milstolpen' }), mTid, mSort]), mRubrik, mText]);
      const mRuta = api.el('div', { class: 'h-replay-ruta h-replay-milstolpe' }, [mInnehall, mTidigare]);
      if (!milstolpar.length) mRuta.hidden = true;

      // Stadsbladets löpsedel
      const lNr = api.el('b'), lTid = api.el('span');
      const lRubrik = api.el('p', { class: 'h-replay-lrubrik' }), lIngress = api.el('p', { class: 'h-replay-lingress' });
      const lInnehall = api.el('div', {}, [lRubrik, lIngress]);
      const lRuta = api.el('div', { class: 'h-replay-ruta h-replay-lopsedel' }, [api.el('p', { class: 'h-replay-vinjett' }, [api.el('span', { text: 'Stadsbladets löpsedel' }), lNr, lTid]), lInnehall]);
      if (!rubriker.length) lRuta.hidden = true;
      const rader = api.el('div', { class: 'h-replay-rader' }, [mRuta, lRuta]);

      rot.append(api.el('div', { class: 'h-replay-topp' }, [tidruta, raknarrad]), scen, forklaring, reglage, linje, kurvtext, rader);
      el.append(rot);

      // ---------- tillstånd ----------
      const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      let lugn = !!(mq && mq.matches);
      if (mq) { const byt = e => { lugn = !!e.matches; }; if (mq.addEventListener) mq.addEventListener('change', byt); else if (mq.addListener) mq.addListener(byt); }

      // Med dämpad rörelse startar ingenting av sig självt: då visas den färdiga staden som stillbild tills någon trycker på Spela.
      let ts = lugn ? slut : start;
      let fart = 1, spelar = false, villSpela = !lugn, drar = false, idx = 0;
      let rafId = 0, senast = 0, senastTick = 0, nyEffekt = false;
      let ctx = null, W = 0, H = 0, dpr = 1, smal = false, etiketter = [], klText = api.kl(ts);
      let kctx = null, KW = 0, kurvaRitad = NaN, hovTs = null, hovRitad = null;
      const visad = { minut: NaN, nk: -1, nl: -1, hand: -1, reak: -1, djup: -1, mil: -2, rub: -2, minI: NaN };

      try { ctx = karta.getContext('2d'); } catch (e) { ctx = null; }
      try { kctx = kurva.getContext('2d'); } catch (e) { kctx = null; }

      const tradar = [];
      for (let i = 0; i < MAX_TRADAR; i++) tradar.push({ aktiv: false, traffat: false, fran: null, till: null, fodd: 0, x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, bredd: 1, styrka: 1 });
      let tradPek = 0;

      // ---------- utläggning av kartan ----------
      function laggUt(B) {
        smal = B < 560;
        const mellan = B < 760;
        const gap = smal ? 8 : 12, eh = smal ? 20 : 24, luft = smal ? 12 : 16, ph = 24, pgap = 6;
        etiketter = [];
        let y = 0;
        const rutnat = (lista, kol, kvot, minH, maxH) => {
          kol = Math.max(1, Math.min(kol, lista.length));
          const w = Math.floor((B - gap * (kol - 1)) / kol), h = Math.round(klamma(w * kvot, minH, maxH));
          lista.forEach((nod, i) => { nod.x = (i % kol) * (w + gap); nod.y = y + Math.floor(i / kol) * (h + gap); nod.w = w; nod.h = h; });
          const antalRader = Math.ceil(lista.length / kol);
          y += antalRader * h + (antalRader - 1) * gap;
        };
        // pillren för röster utan eget kvarter mäts först, så vi vet om de får plats på ledningens etikettrad
        const pillerFont = '600 11px ' + F.mono;
        let pillerB = 0;
        for (const n of roster) {
          let tb = n.namn.length * 7;
          if (ctx) { ctx.font = pillerFont; tb = ctx.measureText(n.namn).width; }
          n.w = Math.min(B, Math.ceil(tb + 24)); n.h = ph; pillerB += n.w + pgap;
        }
        pillerB -= pgap;
        const iRad = roster.length > 0 && led.length > 0 && !mellan && pillerB + 360 < B;

        if (delt.length) {
          etiketter.push({ text: 'KVARTEREN', x: 0, y: y + eh / 2 - 2, hoger: false });
          y += eh; rutnat(delt, smal ? 3 : 4, 0.42, 82, 120);
        }
        if (led.length) {
          if (y > 0) y += luft;
          const radH = iRad ? ph + 10 : eh;
          etiketter.push({ text: 'LEDNINGENS KVARTER', x: 0, y: y + radH / 2 - 3, hoger: false });
          if (iRad) {
            let x = B - pillerB;
            etiketter.push({ text: 'UTAN EGET KVARTER', x: x - 12, y: y + radH / 2 - 3, hoger: true });
            for (const n of roster) { n.x = Math.round(x); n.y = Math.round(y + (radH - ph) / 2 - 3); x += n.w + pgap; }
          }
          y += radH; rutnat(led, mellan ? 3 : 6, 0.36, 66, 72);
        }
        if (roster.length && !iRad) {
          if (y > 0) y += luft;
          etiketter.push({ text: 'UTAN EGET KVARTER', x: 0, y: y + eh / 2 - 2, hoger: false });
          y += eh;
          let x = 0;
          for (const n of roster) { if (x > 0 && x + n.w > B) { x = 0; y += ph + pgap; } n.x = Math.round(x); n.y = Math.round(y); x += n.w + pgap; }
          y += ph;
        }
        return Math.max(40, Math.ceil(y + 2));
      }

      // ---------- förritade rutor ----------
      function byggSprite(n) {
        const w = n.w, h = n.h;
        if (!(w > 0 && h > 0)) return;
        const c = n.sprite || (n.sprite = document.createElement('canvas'));
        c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
        let g = null; try { g = c.getContext('2d'); } catch (e) { g = null; }
        if (!g) { n.sprite = null; return; }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);

        if (n.typ === 'rost') {
          rundad(g, 0.5, 0.5, w - 1, h - 1, h / 2); g.fillStyle = F.panel2; g.fill();
          g.globalAlpha = 0.6; g.strokeStyle = F.dim; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1;
          g.font = '600 11px ' + F.mono; g.fillStyle = F.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(kapa(g, n.namn, w - 14), w / 2, h / 2 + 0.5);
          return;
        }

        const r = n.radie;
        g.save(); rundad(g, 0.5, 0.5, w - 1, h - 1, r); g.clip();
        g.fillStyle = F.panel2; g.fillRect(0, 0, w, h);
        let medBild = false;
        if (n.bild) {
          try {
            const iw = n.bild.naturalWidth, ih = n.bild.naturalHeight;
            if (iw > 0 && ih > 0) {
              const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
              g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
              g.globalAlpha = n.ledning ? 0.32 : 0.72; g.drawImage(n.bild, (w - dw) / 2, (h - dh) / 2, dw, dh); g.globalAlpha = 1; medBild = true;
            }
          } catch (e) { n.bild = null; g.globalAlpha = 1; }
        }
        if (!medBild) {   // inget porträtt: en svag ton av kvarterets färg i stället
          const ton = g.createLinearGradient(0, 0, w, h);
          ton.addColorStop(0, rgba(n.rgb, n.ledning ? 0.10 : 0.24)); ton.addColorStop(1, rgba(n.rgb, 0));
          g.fillStyle = ton; g.fillRect(0, 0, w, h);
        }
        const skugga = g.createLinearGradient(0, 0, 0, h);   // mörkare nedtill så att namnet går att läsa
        skugga.addColorStop(0, rgba(bgRgb, medBild ? 0.22 : 0)); skugga.addColorStop(0.42, rgba(bgRgb, medBild ? 0.38 : 0)); skugga.addColorStop(1, rgba(bgRgb, medBild ? 0.92 : 0.35));
        g.fillStyle = skugga; g.fillRect(0, 0, w, h);
        g.restore();

        // ram: heldragen i teamets färg för deltagarna, streckad och svagare för ledningen
        rundad(g, 0.75, 0.75, w - 1.5, h - 1.5, r);
        if (n.ledning) { g.setLineDash([4, 3]); g.lineWidth = 1; g.globalAlpha = 0.6; } else { g.lineWidth = 1.5; g.globalAlpha = 0.95; }
        g.strokeStyle = n.farg; g.stroke(); g.setLineDash([]); g.globalAlpha = 1;

        // text: kvartersnamn och teamnamn, alltid utskrivna
        const p = w < 130 ? 7 : 10, maxB = Math.max(10, w - 2 * p);
        const teamPx = w < 130 ? 9.5 : 11, radTeam = teamPx + 4;
        let px = w < 130 ? 11 : w < 220 ? 13 : 15; if (n.ledning && px > 13) px = 13;
        const ord = n.namn.split(/\s+/).filter(Boolean);
        g.font = '600 ' + px + 'px ' + F.sans;
        while (px > 9 && ord.some(o => g.measureText(o).width > maxB)) { px -= 0.5; g.font = '600 ' + px + 'px ' + F.sans; }
        const radH = Math.round(px * 1.22);
        const maxRader = klamma(Math.floor((h - 2 * p - radTeam - 13) / radH), 1, 3);
        const namnrader = radbryt(g, n.namn, maxB, maxRader);
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.shadowColor = rgba(bgRgb, 0.95); g.shadowBlur = 5;
        g.fillStyle = F.fg;
        const sistaBas = h - p - radTeam - 1;
        namnrader.forEach((rad, i) => g.fillText(rad, p, sistaBas - (namnrader.length - 1 - i) * radH));
        g.font = '400 ' + teamPx + 'px ' + F.mono; g.fillStyle = F.dim;
        const teamText = !n.ledning && w >= 150 ? 'team ' + n.team : n.team;   // ledningens rutor står under sin egen rubrik på kartan
        g.fillText(kapa(g, teamText, maxB), p, h - p - 1);
        g.shadowBlur = 0; g.shadowColor = 'transparent';

        if (n.live != null) {   // klockslaget då kvarteret gick live
          const liveText = (w >= 150 ? 'live ' : '') + api.kl(n.live);
          g.font = '600 ' + (w < 130 ? 9 : 10) + 'px ' + F.mono;
          const tb = g.measureText(liveText).width, bh = w < 130 ? 13 : 15, bx = w - p - tb - 8 + (w < 130 ? 3 : 0), by = w < 130 ? 5 : 8;
          rundad(g, bx, by, tb + 8, bh, bh / 2); g.fillStyle = rgba(bgRgb, 0.68); g.fill();
          g.fillStyle = n.ledning ? F.dim : F.fg; g.textBaseline = 'middle'; g.fillText(liveText, bx + 4, by + bh / 2 + 0.5);
        }
      }

      function passa(duken, g, b, h) {
        duken.width = Math.max(1, Math.round(b * dpr)); duken.height = Math.max(1, Math.round(h * dpr)); duken.style.height = h + 'px';
        if (g) g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function mat(tvinga) {
        const nyDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        const b = Math.floor(duk.clientWidth), kb = Math.floor(linje.clientWidth);
        if (b > 0 && (tvinga || b !== W || nyDpr !== dpr)) {
          W = b; dpr = nyDpr; H = laggUt(W); passa(karta, ctx, W, H);
          for (const n of noder) byggSprite(n);
        }
        if (kb > 0 && (tvinga || kb !== KW || kurva.width !== Math.round(kb * dpr))) { KW = kb; passa(kurva, kctx, KW, KURVA_H); kurvaRitad = NaN; }
      }

      // ---------- händelser blir trådar ----------
      function blinka(n) { n.blink = Math.min(lugn ? 0.5 : 1, n.blink + 0.55); nyEffekt = true; }

      function nyTrad(fran, till, djup, nu) {
        const t = tradar[tradPek];   // ringbuffert: platsen på tur håller alltid den äldsta tråden
        if (t.aktiv && nu - t.fodd < RESA * 0.8) { blinka(till); return; }   // fullt i luften och även den äldsta är på väg: låt rutan blinka i stället
        tradPek = (tradPek + 1) % MAX_TRADAR;
        if (t.aktiv && !t.traffat) blinka(t.till);   // den äldsta tråden får ge plats: låt dess mål blinka direkt
        t.aktiv = false;
        const x0 = fran.x + fran.w * (0.5 + (Math.random() - 0.5) * 0.4), y0 = fran.y + fran.h * (0.5 + (Math.random() - 0.5) * 0.4);
        const x1 = till.x + till.w * (0.5 + (Math.random() - 0.5) * 0.4), y1 = till.y + till.h * (0.5 + (Math.random() - 0.5) * 0.4);
        const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
        if (!(d >= 2)) { blinka(till); return; }
        const boj = d * (0.1 + Math.random() * 0.2), nx = -dy / d, ny = dx / d, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        let cx = mx + nx * boj, cy = my + ny * boj;
        const bx = mx - nx * boj, by = my - ny * boj;
        const inne = (x, y) => x >= 0 && x <= W && y >= 0 && y <= H;
        if (inne(cx, cy) && inne(bx, by)) { if (Math.random() < 0.5) { cx = bx; cy = by; } }   // båda bågarna ryms: slumpa
        else if (!inne(cx, cy)) { cx = bx; cy = by; }                                           // annars den som håller sig på kartan
        t.aktiv = true; t.traffat = false; t.fran = fran; t.till = till; t.fodd = nu;
        t.x0 = x0; t.y0 = y0; t.x1 = x1; t.y1 = y1; t.cx = cx; t.cy = cy;
        t.bredd = (0.9 + 0.45 * (klamma(Number(djup) || 1, 1, 6) - 1)) * (smal ? 0.8 : 1);
        t.styrka = (fran.ledning || till.ledning) ? 0.45 : (fran.typ === 'rost' || till.typ === 'rost') ? 0.8 : 1;
        nyEffekt = true;
      }

      function handelse(i, nu) {
        const r = puls[i], till = nodForAvs[r[2]], fran = r[3] >= 0 ? nodForAvs[r[3]] : null;
        if (!till || !till.synlig) return;                                   // kvarteret finns inte på kartan än
        if (!fran || fran === till || !fran.synlig) { blinka(till); return; }  // ingen orsak, eller en reaktion på sig själv
        nyTrad(fran, till, r[4], nu);
      }

      function synlighet(nu, medPop) {
        const tSek = (ts - start) / 1000;
        for (const n of noder) {
          const ska = tSek >= n.fran;
          if (ska && !n.synlig) { n.synlig = true; n.pop = medPop && !lugn ? nu : 0; if (n.pop) nyEffekt = true; }
          else if (!ska && n.synlig) { n.synlig = false; n.pop = 0; n.blink = 0; }
        }
      }

      // ---------- rita kartan ----------
      function rita(nu, dt) {
        if (!ctx || !W) return false;
        const g = ctx; let mer = false;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
        g.clearRect(0, 0, W, H);

        g.font = '600 ' + (smal ? 9.5 : 10.5) + 'px ' + F.mono; g.textBaseline = 'middle'; g.fillStyle = F.dim;
        if ('letterSpacing' in g) g.letterSpacing = '1.2px';
        for (const e of etiketter) { g.textAlign = e.hoger ? 'right' : 'left'; g.fillText(e.text, e.x, e.y); }
        if ('letterSpacing' in g) g.letterSpacing = '0px';
        if (W < 760 && etiketter.length) {   // på smala skärmar hamnar den stora klockan utanför bild: visa tiden på kartan också
          g.font = '600 13px ' + F.mono; g.textAlign = 'right'; g.fillStyle = F.accent; g.fillText(klText, W, etiketter[0].y);
        }
        g.textAlign = 'left';

        for (const n of noder) {
          if (!n.synlig) {
            if (n.typ === 'kvarter') {   // en tom tomt som väntar på sitt kvarter
              g.globalAlpha = n.ledning ? 0.35 : 0.6; g.strokeStyle = F.svag; g.lineWidth = 1; g.setLineDash([3, 4]);
              rundad(g, n.x + 0.5, n.y + 0.5, n.w - 1, n.h - 1, n.radie); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
            }
            continue;
          }
          let q = 1, s = 1, a = 1;
          if (n.pop) {
            q = (nu - n.pop) / POP_MS;
            if (!(q >= 0 && q < 1)) { n.pop = 0; q = 1; } else { s = 0.72 + 0.28 * utStuds(q); a = Math.min(1, q * 4); mer = true; }
          }
          if (n.sprite) {
            g.globalAlpha = a * n.ton;
            if (s !== 1) { g.save(); g.translate(n.x + n.w / 2, n.y + n.h / 2); g.scale(s, s); g.drawImage(n.sprite, -n.w / 2, -n.h / 2, n.w, n.h); g.restore(); }
            else g.drawImage(n.sprite, n.x, n.y, n.w, n.h);
          }
          if (n.blink > 0.02) {
            const b = n.blink * (n.ledning ? 0.5 : 1);
            rundad(g, n.x + 0.5, n.y + 0.5, n.w - 1, n.h - 1, n.radie);
            g.globalAlpha = 0.14 * b; g.fillStyle = n.farg; g.fill();
            g.strokeStyle = n.farg; g.globalAlpha = 0.28 * b; g.lineWidth = 6; g.stroke();
            g.globalAlpha = b; g.lineWidth = 2; g.stroke();
            n.blink *= Math.exp(-dt / 240); mer = true;
          } else n.blink = 0;
          if (q < 1) {   // ringen som slår ut när kvarteret går live
            const ut = 26 * utMjuk(q);
            g.globalAlpha = (1 - q) * (n.ledning ? 0.4 : 0.85); g.strokeStyle = n.farg; g.lineWidth = 2;
            rundad(g, n.x - ut, n.y - ut, n.w + 2 * ut, n.h + 2 * ut, n.radie + ut); g.stroke();
          }
          g.globalAlpha = 1;
        }

        // trådarna: en komet längs en mjuk båge, från orsakaren till den som reagerade
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
        const SEG = 10;
        for (const t of tradar) {
          if (!t.aktiv) continue;
          const alder = nu - t.fodd;
          if (!(alder >= 0 && alder < LIV)) { t.aktiv = false; if (!t.traffat) blinka(t.till); continue; }
          mer = true;
          if (!t.traffat && alder >= RESA) { t.traffat = true; blinka(t.till); }
          const uh = utMjuk(Math.min(1, alder / RESA)), us = utMjuk(klamma((alder - SVANS) / RESA, 0, 1));
          const ton = (alder > LIV - 200 ? (LIV - alder) / 200 : 1) * t.styrka;
          let sx = 0, sy = 0, hx = 0, hy = 0;
          g.beginPath();
          for (let k = 0; k <= SEG; k++) {
            const u = us + (uh - us) * (k / SEG), v = 1 - u;
            const x = v * v * t.x0 + 2 * v * u * t.cx + u * u * t.x1, y = v * v * t.y0 + 2 * v * u * t.cy + u * u * t.y1;
            if (k === 0) { g.moveTo(x, y); sx = x; sy = y; } else g.lineTo(x, y);
            hx = x; hy = y;
          }
          if (Math.abs(hx - sx) + Math.abs(hy - sy) > 0.75) {
            const grad = g.createLinearGradient(sx, sy, hx, hy);
            grad.addColorStop(0, t.fran.prefix + '0)'); grad.addColorStop(1, t.fran.prefix + '1)');
            g.strokeStyle = grad;
            g.globalAlpha = 0.22 * ton; g.lineWidth = t.bredd + 3.5; g.stroke();
            g.globalAlpha = ton; g.lineWidth = t.bredd; g.stroke();
          }
          if (alder < RESA + 80) { g.globalAlpha = ton; g.fillStyle = t.fran.farg; g.beginPath(); g.arc(hx, hy, t.bredd + 0.9, 0, Math.PI * 2); g.fill(); }
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        if (nyEffekt) { mer = true; nyEffekt = false; }
        return mer;
      }

      // ---------- aktivitetskurvan ----------
      let banor = null;
      function bana(mal, stangd, x0, b, topp, bas) {   // mal är en Path2D eller själva ritytan
        if (stangd) mal.moveTo(x0 + minP[0] * b, bas);
        for (let i = 0; i < minV.length; i++) { const x = x0 + minP[i] * b, y = bas - (minV[i] / maxV) * (bas - topp); if (i === 0 && !stangd) mal.moveTo(x, y); else mal.lineTo(x, y); }
        if (stangd) { mal.lineTo(x0 + minP[minP.length - 1] * b, bas); mal.closePath(); }
      }
      function ritaKurva() {
        if (!kctx || !KW || !(maxV > 0)) return;
        if (kurvaRitad === ts && hovRitad === hovTs) return;
        kurvaRitad = ts; hovRitad = hovTs;
        const g = kctx, x0 = INSATS, b = Math.max(1, KW - 2 * INSATS), topp = 14, bas = KURVA_H - 18;
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, KW, KURVA_H); g.globalAlpha = 1;
        const xp = x0 + klamma((ts - start) / langd, 0, 1) * b;
        // Kurvans form ändras bara när bredden gör det: bygg den en gång som Path2D och återanvänd den i varje bildruta.
        if (window.Path2D && (!banor || banor.b !== b)) {
          try { banor = { b, yta: new Path2D(), linje: new Path2D() }; bana(banor.yta, true, x0, b, topp, bas); bana(banor.linje, false, x0, b, topp, bas); } catch (e) { banor = null; }
        }
        const fyll = () => { if (banor) g.fill(banor.yta); else { g.beginPath(); bana(g, true, x0, b, topp, bas); g.fill(); } };
        const dra = () => { if (banor) g.stroke(banor.linje); else { g.beginPath(); bana(g, false, x0, b, topp, bas); g.stroke(); } };
        // hela dagen i grått, det som redan hänt i bärnsten
        g.globalAlpha = 0.35; g.fillStyle = F.svag; fyll(); g.globalAlpha = 1;
        g.save(); g.beginPath(); g.rect(0, 0, xp, KURVA_H); g.clip();
        g.globalAlpha = 0.4; g.fillStyle = F.accent; fyll(); g.globalAlpha = 1;
        g.strokeStyle = F.accent; g.lineWidth = 1.5; g.lineJoin = 'round'; dra();
        g.restore();
        g.strokeStyle = F.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, bas + 0.5); g.lineTo(x0 + b, bas + 0.5); g.stroke();
        // hela timmar
        g.font = '400 10px ' + F.mono; g.fillStyle = F.dim; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
        const timme = 3600000; let senasteX = -99;
        for (let t = Math.ceil(start / timme) * timme; t <= slut; t += timme) {
          const x = x0 + ((t - start) / langd) * b;
          g.strokeStyle = F.svag; g.beginPath(); g.moveTo(Math.round(x) + 0.5, bas); g.lineTo(Math.round(x) + 0.5, bas + 4); g.stroke();
          if (x - senasteX >= 38) { g.fillText(api.kl(t), klamma(x, 16, KW - 16), KURVA_H - 3); senasteX = x; }
        }
        // när kvarteren gick live
        for (const n of kvNoder) {
          if (n.live == null) continue;
          const x = x0 + klamma((n.live - start) / langd, 0, 1) * b;
          g.globalAlpha = n.live <= ts ? (n.ledning ? 0.55 : 1) : 0.3; g.fillStyle = n.ledning ? F.dim : n.farg;
          g.fillRect(Math.round(x) - 1, 2, 2, n.ledning ? 5 : 8);
        }
        g.globalAlpha = 1;
        if (hovTs != null) { const hx = x0 + klamma((hovTs - start) / langd, 0, 1) * b; g.strokeStyle = F.dim; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(Math.round(hx) + 0.5, topp - 2); g.lineTo(Math.round(hx) + 0.5, bas); g.stroke(); g.globalAlpha = 1; }
        // spelhuvudet
        g.strokeStyle = F.fg; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xp, 0); g.lineTo(xp, bas); g.stroke();
        g.fillStyle = F.fg; g.beginPath(); g.arc(xp, bas, 3, 0, Math.PI * 2); g.fill();
      }

      // ---------- text och räknare ----------
      const satt = (nod, text) => { if (nod.textContent !== text) nod.textContent = text; };
      function tona(nod) { if (!lugn && nod.animate) { try { nod.animate([{ opacity: 0.2, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); } catch (e) { /* utan animation går det lika bra */ } } }

      function visaMilstolpe(i) {
        const m = i >= 0 ? milstolpar[i] : null;
        satt(mTid, m ? 'kl. ' + api.kl(m.ts) : '');
        satt(mSort, m ? (SORTER[m.sort] || String(m.sort || '')) : '');
        satt(mRubrik, m ? String(m.rubrik || '') : 'Dagen har inte börjat än.');
        const text = m ? String(m.text || '') : '';
        satt(mText, /^\s*[\[{]/.test(text) ? '' : text);   // en del milstolpar bär rådata i stället för text: visa då bara rubriken
        tom(mTidigare);
        for (let j = i - 1; j >= 0 && j >= i - 2; j--) mTidigare.append(api.el('li', {}, [api.el('span', { text: api.kl(milstolpar[j].ts) }), String(milstolpar[j].rubrik || '')]));
        mTidigare.hidden = !mTidigare.firstChild;
        tona(mInnehall);
      }

      function visaRubrik(i) {
        const r = i >= 0 ? rubriker[i] : null;
        lRuta.classList.toggle('h-replay-tom', !r);
        satt(lNr, r && r.nummer != null ? 'nr ' + api.tal(r.nummer) : '');
        satt(lTid, r ? 'kl. ' + api.kl(r.ts) : '');
        satt(lRubrik, r ? String(r.rubrik || '') : 'Stadsbladet har inte kommit ut än. Första numret kommer kl. ' + api.kl(rubriker[0].ts) + '.');
        satt(lIngress, r ? String(r.ingress || '') : '');
        lIngress.hidden = !lIngress.textContent;
        tona(lInnehall);
      }

      function avlasning() {
        if (!minuter.length || !(maxV > 0)) return;
        const t = hovTs != null ? hovTs : ts;
        const i = klamma(antalTill(minuter.length, j => minuter[j].t, t) - 1, 0, minuter.length - 1);
        const nyckel = hovTs != null ? i : -1 - i;
        if (nyckel === visad.minI) return;
        visad.minI = nyckel;
        satt(avlast, 'kl. ' + api.kl(minuter[i].t) + ' · ' + api.tal(minV[i]) + ' inlägg den minuten');
      }

      function visa() {
        const tSek = (ts - start) / 1000;
        const minut = Math.floor(ts / 60000);
        if (minut !== visad.minut) { visad.minut = minut; klText = api.kl(ts); satt(klocka, klText); tid.setAttribute('aria-valuetext', 'kl. ' + klText); }

        let nk = 0, nl = 0;
        for (const n of kvNoder) if (tSek >= n.fran) { if (n.ledning) nl++; else nk++; }
        if (nk !== visad.nk || nl !== visad.nl) {
          visad.nk = nk; visad.nl = nl;
          satt(rKvarter.n, api.tal(nk + nl));
          satt(rKvarter.liten, led.length ? api.tal(nk) + ' teamens · ' + api.tal(nl) + ' ledningens' : '');
          karta.setAttribute('aria-label', 'Karta över staden kl. ' + api.kl(ts) + ': ' + api.tal(nk + nl) + ' av ' + api.tal(kvNoder.length) + ' kvarter har gått live.');
        }
        const hand = antalTill(N, sekVid, tSek), reak = hand > 0 ? pReak[hand - 1] : 0, djup = hand > 0 ? pDjup[hand - 1] : 0;
        if (hand !== visad.hand) { visad.hand = hand; satt(rHand.n, api.tal(hand)); }
        if (reak !== visad.reak) { visad.reak = reak; satt(rHand.liten, 'varav ' + api.tal(reak) + ' reaktioner'); }
        if (djup !== visad.djup) { visad.djup = djup; satt(rDjup.n, api.tal(djup)); satt(rDjup.liten, djup > 1 ? 'händelser som utlöste varandra' : ''); }

        if (milstolpar.length) { const i = antalTill(milstolpar.length, j => milstolpar[j].ts, ts) - 1; if (i !== visad.mil) { visad.mil = i; visaMilstolpe(i); } }
        if (rubriker.length) { const i = antalTill(rubriker.length, j => rubriker[j].ts, ts) - 1; if (i !== visad.rub) { visad.rub = i; visaRubrik(i); } }
        avlasning();

        const p = klamma((ts - start) / langd, 0, 1);
        const v = String(Math.round(p * TID_MAX)); if (tid.value !== v) tid.value = v;
        tid.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      }

      function knappText() {
        satt(spelaKnapp, spelar ? 'Paus' : ts >= slut ? 'Spela från början' : 'Spela');
        const sek = Math.round(FILM_MS / 1000 / fart);
        satt(spann, 'Hela dagen, ' + api.kl(start) + '–' + api.kl(slut) + ', på ungefär ' + api.tal(sek) + ' sekunder');
        fartKnappar.forEach((k, i) => k.setAttribute('aria-pressed', String(FARTER[i] === fart)));
      }

      // ---------- uppspelning ----------
      function begarBild() { if (!rafId) rafId = requestAnimationFrame(bild); }

      function bild(nu) {
        rafId = 0;
        const dt = senast ? klamma(nu - senast, 0, 100) : 16; senast = nu;
        if (spelar && !drar) {
          ts = Math.min(slut, ts + dt * fart * langd / FILM_MS);
          synlighet(nu, true);
          const nytt = antalTill(N, sekVid, (ts - start) / 1000);
          if (nytt > idx) { const steg = Math.max(1, Math.ceil((nytt - idx) / MAX_PER_BILD)); for (let i = idx; i < nytt; i += steg) handelse(i, nu); }
          idx = nytt;
          visa();
          if (ts >= slut) { spelar = false; villSpela = false; knappText(); senastTick = nu; api.tick(ts); }
          else if (nu - senastTick >= 100) { senastTick = nu; api.tick(ts); }
        }
        const mer = rita(nu, dt);
        ritaKurva();
        if (spelar || mer) begarBild(); else senast = 0;
      }

      function spolaTill(t) {
        const v = Number(t);
        if (!isFinite(v)) return;   // skräpvärde utifrån: stå kvar där filmen är i stället för att räkna med NaN
        ts = klamma(v, start, slut);
        idx = antalTill(N, sekVid, (ts - start) / 1000);
        synlighet(performance.now(), false);
        visa(); knappText(); api.tick(ts); begarBild();
      }
      function spela(auto) {
        if (spelar) return;
        if (ts >= slut) { if (auto) return; spolaTill(start); }
        spelar = true; villSpela = true; senast = 0; knappText(); begarBild();
      }
      function pausa(auto) {
        if (!auto) villSpela = false;
        if (spelar) { spelar = false; api.tick(ts); }
        knappText();
      }
      const vaxla = () => (spelar ? pausa(false) : spela(false));

      // ---------- reglage ----------
      spelaKnapp.addEventListener('click', vaxla);
      scen.addEventListener('click', vaxla);
      fartKnappar.forEach((k, i) => k.addEventListener('click', () => { fart = FARTER[i]; knappText(); }));

      tid.addEventListener('pointerdown', () => { drar = true; });
      tid.addEventListener('input', () => spolaTill(start + (Number(tid.value) / TID_MAX) * langd));
      tid.addEventListener('change', () => { drar = false; });
      const slapp = () => { if (drar) { drar = false; senast = 0; if (spelar) begarBild(); } };
      window.addEventListener('pointerup', slapp); window.addEventListener('pointercancel', slapp); tid.addEventListener('blur', slapp);

      const kurvTs = e => { const r = kurva.getBoundingClientRect(), b = Math.max(1, r.width - 2 * INSATS); return start + klamma((e.clientX - r.left - INSATS) / b, 0, 1) * langd; };
      let kurvDrar = false;
      kurva.addEventListener('pointerdown', e => { if (e.button > 0) return; kurvDrar = true; drar = true; try { kurva.setPointerCapture(e.pointerId); } catch (err) { /* går bra ändå */ } hovTs = kurvTs(e); spolaTill(hovTs); });
      kurva.addEventListener('pointermove', e => { hovTs = kurvTs(e); if (kurvDrar) spolaTill(hovTs); else { avlasning(); begarBild(); } });
      // Släpper vi bara kurvans eget drag och inte spärren i slapp() står filmen still fast knappen säger Paus.
      const kurvSlut = () => { if (!kurvDrar) return; kurvDrar = false; slapp(); };
      kurva.addEventListener('pointerup', kurvSlut); kurva.addEventListener('pointercancel', kurvSlut);
      kurva.addEventListener('pointerleave', () => { if (kurvDrar) return; hovTs = null; avlasning(); begarBild(); });
      kurva.addEventListener('lostpointercapture', () => { kurvSlut(); if (hovTs != null && !kurva.matches(':hover')) { hovTs = null; avlasning(); begarBild(); } });

      rot.addEventListener('keydown', e => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        const knapp = e.target && e.target.tagName === 'BUTTON';
        if (e.key === ' ' || e.code === 'Space') { if (knapp) return; e.preventDefault(); vaxla(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { if (e.key === 'ArrowDown' && e.target !== tid) return; e.preventDefault(); spolaTill(ts - STEG_MS); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { if (e.key === 'ArrowUp' && e.target !== tid) return; e.preventDefault(); spolaTill(ts + STEG_MS); }
        else if (e.key === 'Home' && e.target === tid) { e.preventDefault(); spolaTill(start); }
        else if (e.key === 'End' && e.target === tid) { e.preventDefault(); spolaTill(slut); }
      });

      // Andra sektioner ber filmen spola: gå dit och stanna.
      document.addEventListener('historia:hoppa', e => {
        const t = Number(e && e.detail && e.detail.ts);
        if (!isFinite(t)) return;
        pausa(false); spolaTill(t);
      });

      // ---------- storlek, typsnitt, porträtt ----------
      const nyStorlek = () => { mat(false); begarBild(); };
      if (window.ResizeObserver) new ResizeObserver(nyStorlek).observe(rot); else window.addEventListener('resize', nyStorlek);
      if (document.fonts && document.fonts.load) {
        Promise.all(['600 13px "Inter"', '400 11px "JetBrains Mono"', '600 11px "JetBrains Mono"'].map(f => document.fonts.load(f).catch(() => null)))
          .then(() => { mat(true); begarBild(); }).catch(() => null);
      }
      for (const n of kvNoder) {
        const url = n.k && n.k.porträtt;
        if (typeof url !== 'string' || !/^(\/(?!\/)|https:\/\/)/.test(url)) continue;
        const img = new Image(); img.decoding = 'async';
        img.onload = () => { n.bild = img; byggSprite(n); begarBild(); };
        img.onerror = () => { n.bild = null; };   // utan porträtt får rutan en ton av kvarterets färg
        img.src = url;
      }

      // ---------- första bilden, och start när filmen syns ----------
      mat(true);
      idx = antalTill(N, sekVid, (ts - start) / 1000);
      synlighet(performance.now(), false);
      visa(); knappText(); begarBild();

      if (window.IntersectionObserver) {
        new IntersectionObserver(poster => {
          for (const p of poster) {
            if (p.intersectionRatio >= 0.34) { if (villSpela && !lugn && !spelar) spela(true); }
            else if (!p.isIntersecting && spelar) pausa(true);
          }
        }, { threshold: [0, 0.35] }).observe(scen);
      }
    },
  };
})();
