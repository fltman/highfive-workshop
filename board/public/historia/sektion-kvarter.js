// Sektionen "kvarter": ett minneskort per kvarter. Deltagarnas kvarter först, i den ordning de gick live,
// alla kvarter i en lista, i den ordning de gick live. Varje kort har id "kvarter-<team>" så att /historia#kvarter-willebus länkar rakt dit.
// All text ur data sätts med textContent (api.el(..., {text})), aldrig innerHTML. Alla fält får vara null eller tomma: då ritas den delen inte.
(function () {
  'use strict';
  if (!window.Historia || !window.Historia.sektioner) return;

  const PR_BAS = 'https://github.com/fltman/highfive-workshop/pull/';
  const GITHUB = 'https://github.com/';
  const STIL_ID = 'h-kvarter-stil';
  const TITEL_TAK = 160;              // tools/historia.py kapar PR-titlar vid 160 tecken: en så lång titel är avklippt
  const SPALT_MIN = 330, SPALT_GAP = 18, SPALT_MAX = 3;
  // Bannern är 1280:543. Det är måttet på så gott som alla platsporträtt (tools/portratt.sh ber om brett liggande format och skalar till 1280 px bredd),
  // så de allra flesta bilder visas oberörda. Enstaka porträtt har annan proportion: de beskärs kring mitten av object-fit: cover.

  const CSS = `
.h-kvarter { min-width:0; }
.h-kvarter a:focus-visible, .h-kvarter button:focus-visible, .h-kvarter summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.h-kvarter-etikett { font:600 11px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 8px; }
.h-kvarter-hitta { margin:0 0 22px; }
.h-kvarter-hopplista { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 10px; padding:0; list-style:none; }
.h-kvarter-hopplista li { min-width:0; max-width:100%; }
.h-kvarter-hopp { display:inline-flex; align-items:center; gap:7px; max-width:100%; padding:5px 12px; border:1px solid var(--line); border-radius:999px; background:var(--panel); color:var(--fg); font-size:13.5px; line-height:1.3; overflow-wrap:anywhere; transition:border-color .2s; }
.h-kvarter-hopp:hover { border-color:var(--h-kvarter-f, var(--accent)); text-decoration:none; }
.h-kvarter-hopp small { font:11.5px var(--mono); color:var(--dim); }
.h-kvarter-prick { flex:none; display:inline-block; width:9px; height:9px; border-radius:50%; background:var(--h-kvarter-f, var(--dim)); }
.h-kvarter-forklaring { color:var(--dim); font-size:14.5px; line-height:1.55; max-width:760px; margin:0; padding-left:14px; border-left:2px solid var(--line); }
.h-kvarter-forklaring + .h-kvarter-forklaring { padding-top:8px; }
.h-kvarter-underrubrik { font:700 clamp(22px, 2.6vw, 28px)/1.2 var(--serif); margin:44px 0 6px; }
.h-kvarter-underingang { color:var(--dim); font-size:15.5px; line-height:1.55; max-width:760px; margin:0 0 22px; overflow-wrap:anywhere; }
.h-kvarter-rutnat { display:flex; align-items:flex-start; gap:18px; min-width:0; }
.h-kvarter-spalt { flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:18px; }
.h-kvarter-kort { position:relative; min-width:0; background:var(--panel); border:1px solid var(--line); border-top:3px solid var(--h-kvarter-f, var(--line)); border-radius:14px; overflow:hidden; scroll-margin-top:72px; transition:border-color .2s, box-shadow .2s; }
.h-kvarter-kort.h-kvarter-vald { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
.h-kvarter-banner { position:relative; aspect-ratio:1280 / 543; background:var(--panel2); overflow:hidden; }
.h-kvarter-banner img { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:cover; object-position:center; }
@supports not (aspect-ratio: 1 / 1) { .h-kvarter-banner { height:0; padding-top:42.42%; } }
.h-kvarter-banner::after { content:""; position:absolute; inset:0; background:linear-gradient(to bottom, transparent 62%, var(--panel)); pointer-events:none; }
.h-kvarter-kropp { padding:16px 20px 20px; }
.h-kvarter-live { font:600 11.5px/1.5 var(--mono); letter-spacing:.08em; text-transform:uppercase; color:var(--accent); margin:0 0 6px; }
.h-kvarter-live span { color:var(--dim); }
.h-kvarter-namn { font:900 clamp(24px, 2.4vw, 29px)/1.12 var(--serif); letter-spacing:-.01em; margin:0 0 8px; overflow-wrap:anywhere; }
.h-kvarter-vem { display:flex; flex-wrap:wrap; align-items:center; gap:3px 8px; font:12.5px/1.5 var(--mono); color:var(--dim); margin:0; overflow-wrap:anywhere; }
.h-kvarter-vem b { color:var(--fg); font-weight:600; }
.h-kvarter-vem a { color:var(--fg); text-decoration:underline; text-decoration-color:var(--svag); text-underline-offset:3px; }
.h-kvarter-vem a:hover { text-decoration-color:var(--fg); }
.h-kvarter-bygge { margin:14px 0 0; font-size:15px; line-height:1.45; color:var(--dim); }
.h-kvarter-bygge b { font:600 15px var(--mono); color:var(--fg); font-variant-numeric:tabular-nums; }
.h-kvarter-nyckeltal { list-style:none; margin:14px 0 0; padding:12px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); display:grid; gap:7px; }
.h-kvarter-nyckeltal li { display:grid; grid-template-columns:72px minmax(0, 1fr); gap:12px; align-items:baseline; font-size:14.5px; line-height:1.35; color:var(--dim); }
.h-kvarter-nyckeltal b { font:800 21px/1 var(--mono); color:var(--fg); text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
.h-kvarter-nyckeltal li.h-kvarter-fatt b { color:var(--accent); }
.h-kvarter-tyst { margin:14px 0 0; padding:12px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); font-size:14.5px; color:var(--dim); }
.h-kvarter-del { margin:18px 0 0; min-width:0; }
.h-kvarter-chips { display:flex; flex-wrap:wrap; gap:6px; margin:0; padding:0; list-style:none; }
.h-kvarter-chip { display:inline-flex; align-items:baseline; gap:6px; max-width:100%; font:12px/1.5 var(--mono); padding:2px 9px; border-radius:999px; border:1px solid var(--line); background:var(--panel2); color:var(--fg); overflow-wrap:anywhere; }
.h-kvarter-chip b { font-weight:600; }
.h-kvarter-chip span { color:var(--dim); }
.h-kvarter-prlista { list-style:none; margin:0; padding:0; display:grid; gap:11px; }
.h-kvarter-pr { min-width:0; padding-left:12px; border-left:2px solid var(--line); }
.h-kvarter-prmeta { display:flex; flex-wrap:wrap; align-items:baseline; gap:0 10px; font:12px/1.6 var(--mono); color:var(--dim); margin:0; }
.h-kvarter-prmeta a, .h-kvarter-prnr { font-weight:600; font-size:13px; }
.h-kvarter-prmeta a { display:inline-block; padding:4px 8px 4px 0; }
.h-kvarter-prnr { color:var(--fg); }
.h-kvarter-prtitel { margin:1px 0 0; font-size:14px; line-height:1.45; color:var(--fg); overflow-wrap:anywhere; }
.h-kvarter-invnamn { margin:0; font-weight:600; font-size:15.5px; line-height:1.35; overflow-wrap:anywhere; }
.h-kvarter-invroll { margin:2px 0 0; color:var(--dim); font-size:14px; line-height:1.45; overflow-wrap:anywhere; }
.h-kvarter-citat { margin:10px 0 0; padding:11px 14px 10px; background:var(--panel2); border-left:2px solid var(--h-kvarter-f, var(--accent)); border-radius:0 10px 10px 0; }
.h-kvarter-citat p { margin:0; font:italic 500 15.5px/1.5 var(--serif); color:var(--fg); overflow-wrap:anywhere; }
.h-kvarter-citat cite { display:block; margin:7px 0 0; font:normal 11.5px/1.5 var(--mono); color:var(--dim); }
.h-kvarter-obs { margin:18px 0 0; padding:14px 16px; border:1px solid var(--line); border-radius:12px; background:var(--bg); min-width:0; }
.h-kvarter-obs .h-kvarter-etikett { margin:0; color:var(--lila); }
.h-kvarter-stjarnbild { margin:3px 0 0; font:italic 500 14.5px/1.4 var(--serif); color:var(--fg); overflow-wrap:anywhere; }
.h-kvarter-matare { height:8px; margin:12px 0 5px; border-radius:999px; background:var(--panel2); border:1px solid var(--line); overflow:hidden; }
.h-kvarter-matare i { display:block; height:100%; border-radius:999px; background:var(--lila); }
.h-kvarter-matartext { margin:0; font:12px/1.5 var(--mono); color:var(--dim); }
.h-kvarter-matartext b { color:var(--fg); font-weight:600; }
.h-kvarter-lasning { margin:12px 0 0; display:grid; gap:9px; }
.h-kvarter-lasning dt { font:600 10.5px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 1px; }
.h-kvarter-lasning dd { margin:0; font-size:14px; line-height:1.5; color:var(--fg); overflow-wrap:anywhere; }
.h-kvarter-lasning dd.h-kvarter-omen { font:italic 500 15px/1.5 var(--serif); }
.h-kvarter-mer { margin:10px 0 0; }
.h-kvarter-mer summary { cursor:pointer; font:12px/1.6 var(--mono); color:var(--dim); }
.h-kvarter-mer summary:hover { color:var(--fg); }
.h-kvarter-mer .h-kvarter-lasning { margin-top:8px; }
.h-kvarter-knapprad { margin:20px 0 0; }
.h-kvarter-tomt { color:var(--dim); }
@media (max-width:700px) {
  .h-kvarter-kropp { padding:14px 16px 18px; }
  .h-kvarter-rutnat, .h-kvarter-spalt { gap:14px; }
  .h-kvarter-underrubrik { margin-top:36px; }
  .h-kvarter-obs { padding:12px 13px; }
}
@media (max-width:420px) {
  .h-kvarter-nyckeltal li { grid-template-columns:64px minmax(0, 1fr); gap:10px; }
  .h-kvarter-nyckeltal b { font-size:19px; }
  .h-kvarter-knapprad .knapp { width:100%; }
}
@media (prefers-reduced-motion: reduce) {
  .h-kvarter-kort, .h-kvarter-hopp { transition:none; }
}
`;

  // ---------- små, stränga läsare: data är opålitligt och får sakna vad som helst ----------
  const txt = x => (typeof x === 'string' ? x.trim() : '');
  const num = x => (typeof x === 'number' && isFinite(x) ? x : null);
  const tid = x => { const n = num(x); return n !== null && n > 0 && n <= 8.64e15 ? n : null; };   // bara tidsstämplar som Date klarar: annars kastar api.kl
  const arr = x => (Array.isArray(x) ? x : []);
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : null);
  const boj = (n, en, flera) => (n === 1 ? en : flera);
  const kortId = team => 'kvarter-' + team.replace(/[^\wåäö-]/gi, '-');
  const tryggFarg = (api, team) => { try { return txt(api.färg(team)); } catch (e) { return ''; } };   // api.färg läser data.kvarter och tål inte trasiga rader

  function ordnaEfter(lista, falt) {                           // stigande på en tidsstämpel, stabilt, poster utan giltig tid sist
    return lista.map((k, i) => [k, i]).sort((a, b) => {
      const x = tid(a[0][falt]), y = tid(b[0][falt]);
      if (x === null && y === null) return a[1] - b[1];
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y || a[1] - b[1];
    }).map(p => p[0]);
  }

  function forstaHandelser(data) {                             // avsändare → ts för dess första händelse, ur data.puls (sekunder sedan meta.start)
    const ut = new Map(), avs = arr(data.avsändare), start = num(obj(data.meta) ? data.meta.start : null);
    if (start === null) return ut;
    for (const r of arr(data.puls)) {
      if (!Array.isArray(r)) continue;
      const sek = num(r[0]), vem = txt(avs[r[2]]);
      if (sek === null || !vem) continue;
      const ts = start + sek * 1000;
      if (!ut.has(vem) || ts < ut.get(vem)) ut.set(vem, ts);
    }
    return ut;
  }

  function etikett(api, text) { return api.el('p', { class: 'h-kvarter-etikett', text }); }

  function utlank(api, href, text, aria) {
    const attr = { href, target: '_blank', rel: 'noopener noreferrer', text };
    if (aria) attr['aria-label'] = aria;
    return api.el('a', attr);
  }

  // ---------- kortets delar. Varje del returnerar ett element eller null (null = rita ingenting) ----------
  function banner(api, k, namn) {
    const src = txt(k.porträtt);
    if (!src || !/^(\/(?!\/)|https:\/\/)/.test(src)) return null;
    const ram = api.el('div', { class: 'h-kvarter-banner' });
    const img = document.createElement('img');
    img.setAttribute('loading', 'lazy');                        // måste sättas före src för att gälla
    img.decoding = 'async';
    img.alt = 'Porträtt av kvarteret ' + namn;
    img.addEventListener('error', () => ram.remove());
    img.src = src;
    ram.append(img);
    return ram;
  }

  function liveRad(api, k, s) {
    const live = tid(k.live);
    const rad = api.el('p', { class: 'h-kvarter-live' });
    if (live !== null) rad.append('Gick live ' + api.kl(live));
    let extra = '';
    if (live !== null && s.rang && s.total) extra = 'nr ' + s.rang + ' av ' + s.total;
    if (extra) rad.append(api.el('span', { text: (live !== null ? ' · ' : '') + extra }));
    return rad.childNodes.length ? rad : null;
  }

  function vemRad(api, k, team, farg) {
    if (!team) return null;
    const rad = api.el('p', { class: 'h-kvarter-vem' });
    const prick = api.el('span', { class: 'h-kvarter-prick', 'aria-hidden': 'true' });
    if (farg) prick.style.setProperty('--h-kvarter-f', farg);
    const forst = api.el('span');
    if (k.ledning === true) forst.append(prick, ' byggt av workshopledningen · tekniskt namn ', api.el('b', { text: team }));
    else forst.append(prick, ' team ', api.el('b', { text: team }));
    rad.append(forst);
    const av = arr(k.av).map(txt).filter(Boolean);
    if (av.length) {
      const vilka = api.el('span'); vilka.append('· ');
      av.forEach((login, i) => {
        if (i > 0) vilka.append(i === av.length - 1 ? ' och ' : ', ');
        if (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(login)) vilka.append(utlank(api, GITHUB + login, login, login + ' på GitHub'));
        else vilka.append(api.el('b', { text: login }));
      });
      vilka.append(' på GitHub');
      rad.append(vilka);
    }
    return rad;
  }

  function byggeRad(api, k) {
    const antal = arr(k.pr).filter(obj).length;
    if (!antal) return null;                                   // inga pull requests: då är "0 rader" inte sant, bara okänt
    const rad = api.el('p', { class: 'h-kvarter-bygge' });
    rad.append(api.el('b', { text: api.tal(antal) }), ' ' + boj(antal, 'sammanfogat bidrag', 'sammanfogade bidrag'));
    const rader = num(k.rader);
    if (rader !== null && rader > 0) rad.append(' · ', api.el('b', { text: api.tal(rader) }), ' ' + boj(rader, 'rad', 'rader') + ' kod');
    return rad;
  }

  function nyckeltal(api, k) {
    const h = num(k.händelser), f = num(k.fått), g = num(k.gett);
    if (h === null && f === null && g === null) return null;
    if (h === 0 && !f && !g) return api.el('p', { class: 'h-kvarter-tyst', text: 'Inga egna händelser på Stadens puls.' });
    const led = k.ledning === true;
    const ul = api.el('ul', { class: 'h-kvarter-nyckeltal' });
    const rad = (n, text, klass) => { const li = api.el('li', klass ? { class: klass } : null); li.append(api.el('b', { text: api.tal(n) }), api.el('span', { text: ' ' + text })); ul.append(li); };   // mellanslaget syns inte i rutnätet men håller isär tal och ord för skärmläsare och kopiering
    if (h !== null) rad(h, boj(h, 'händelse', 'händelser') + (led ? ' postade kvarteret på Stadens puls' : ' postade ni på Stadens puls'));
    if (f !== null) rad(f, boj(f, 'gång', 'gånger') + (led ? ' reagerade andra på kvarteret' : ' reagerade andra på er'), f > 0 ? 'h-kvarter-fatt' : '');   // bärnsten bara när det finns något att lyfta fram
    if (g !== null) rad(g, boj(g, 'gång', 'gånger') + (led ? ' reagerade kvarteret på andra' : ' reagerade ni på andra'));
    return ul;
  }

  function typer(api, k) {
    const par = arr(k.typer).filter(t => Array.isArray(t) && txt(t[0]));
    if (!par.length) return null;
    const del = api.el('div', { class: 'h-kvarter-del' }, etikett(api, par.length === 1 ? 'Händelsetyp' : 'Vanligaste händelsetyperna'));
    const ul = api.el('ul', { class: 'h-kvarter-chips' });
    for (const t of par) {
      const chip = api.el('li', { class: 'h-kvarter-chip' }, api.el('b', { text: txt(t[0]) }));
      const n = num(t[1]);
      if (n !== null) chip.append(api.el('span', { text: ' ' + api.tal(n) + ' ' + boj(n, 'gång', 'gånger') }));
      ul.append(chip);
    }
    del.append(ul);
    return del;
  }

  function prLista(api, k) {
    const lista = ordnaEfter(arr(k.pr).filter(obj), 'ts');
    if (!lista.length) return null;
    const del = api.el('div', { class: 'h-kvarter-del' }, etikett(api, lista.length === 1 ? 'Bidraget' : 'Bidragen i tur och ordning'));
    const ol = api.el('ol', { class: 'h-kvarter-prlista' });
    for (const p of lista) {
      const li = api.el('li', { class: 'h-kvarter-pr' });
      const meta = api.el('p', { class: 'h-kvarter-prmeta' });
      const nr = num(p.nr);
      if (nr !== null && Number.isInteger(nr) && nr > 0) meta.append(utlank(api, PR_BAS + nr, '#' + nr, '#' + nr + ', pull request på GitHub'));
      else if (nr !== null) meta.append(api.el('span', { class: 'h-kvarter-prnr', text: '#' + nr }));
      const ts = tid(p.ts);
      if (ts !== null) meta.append(api.el('span', { text: 'kl. ' + api.kl(ts) }));
      const rader = num(p.rader);
      if (rader !== null && rader >= 0) meta.append(api.el('span', { text: '+' + api.tal(rader) + ' ' + boj(rader, 'rad', 'rader') }));
      if (meta.childNodes.length) li.append(meta);
      const ra = typeof p.titel === 'string' ? p.titel : '';
      let titel = ra.trim();
      if (Array.from(ra).length >= TITEL_TAK) {                  // mät den otrimmade titeln i tecken, så som Python kapade den
        if (!/\s$/.test(ra)) titel = titel.replace(/\s+\S*$/, '');  // snittet hamnade mitt i ett ord: släpp det halva ordet
        titel = titel.replace(/[\s,;:.(–—-]+$/, '') + ' …';
      }
      if (titel) li.append(api.el('p', { class: 'h-kvarter-prtitel', text: titel }));
      if (li.childNodes.length) ol.append(li);
    }
    if (!ol.childNodes.length) return null;
    del.append(ol);
    return del;
  }

  function invanare(api, k, farg) {
    const inv = obj(k.invånare), cit = obj(k.citat);
    const namn = inv ? txt(inv.namn) : '', roll = inv ? txt(inv.roll) : '', citat = cit ? txt(cit.text) : '';
    if (!namn && !roll && !citat) return null;
    const del = api.el('div', { class: 'h-kvarter-del' }, etikett(api, namn || roll ? 'Invånaren' : 'Från gatan'));
    if (namn) del.append(api.el('p', { class: 'h-kvarter-invnamn', text: namn }));
    if (roll) del.append(api.el('p', { class: 'h-kvarter-invroll', text: roll }));
    if (citat) {
      const bq = api.el('blockquote', { class: 'h-kvarter-citat' }, api.el('p', { text: citat }));
      if (farg) bq.style.setProperty('--h-kvarter-f', farg);
      const ts = tid(cit.ts);
      const vem = (namn ? namn + ', ' : '') + 'på gatan' + (ts !== null ? ' kl. ' + api.kl(ts) : '');
      bq.append(api.el('cite', { text: vem.charAt(0).toUpperCase() + vem.slice(1) }));
      del.append(bq);
    }
    return del;
  }

  function lasning(api, par) {
    const dl = api.el('dl', { class: 'h-kvarter-lasning' });
    for (const [rubrik, text, klass] of par) {
      if (!text) continue;
      dl.append(api.el('div', null, [api.el('dt', { text: rubrik }), api.el('dd', klass ? { class: klass, text } : { text })]));
    }
    return dl.childNodes.length ? dl : null;
  }

  function observatoriet(api, k) {
    const m = obj(k.mörker);
    if (!m) return null;
    const tal = num(m.tal), visar = txt(m.visar), doljer = txt(m.döljer), fruktar = txt(m.fruktar), omen = txt(m.omen), stjarnbild = txt(m.stjärnbild);
    if (tal === null && !visar && !doljer && !fruktar && !omen) return null;
    const ruta = api.el('div', { class: 'h-kvarter-obs' }, etikett(api, 'Observatoriets läsning'));
    if (stjarnbild) ruta.append(api.el('p', { class: 'h-kvarter-stjarnbild', text: 'Stjärnbild: ' + stjarnbild }));
    if (tal !== null) {
      const fyllt = Math.max(0, Math.min(100, tal)), visat = Math.round(fyllt);
      const matare = api.el('div', { class: 'h-kvarter-matare', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(fyllt), 'aria-label': 'Mörkertal ' + visat + ' av 100' });
      const fyllning = api.el('i'); fyllning.style.width = fyllt + '%';
      matare.append(fyllning);
      const rad = api.el('p', { class: 'h-kvarter-matartext' });
      rad.append('Mörkertal ', api.el('b', { text: String(visat) }), ' av 100');
      ruta.append(matare, rad);
    }
    const framme = lasning(api, [['Döljer', doljer], ['Omen', omen, 'h-kvarter-omen']]);
    if (framme) ruta.append(framme);
    const bakom = lasning(api, [['Visar', visar], ['Fruktar', fruktar]]);
    if (bakom) ruta.append(api.el('details', { class: 'h-kvarter-mer' }, [api.el('summary', { text: 'Resten av läsningen: vad kvarteret visar och fruktar' }), bakom]));
    return ruta;
  }

  function liveKnapp(api, k, namn, harReplay) {
    const live = tid(k.live);
    if (live === null || !harReplay) return null;
    const knapp = api.el('button', { type: 'button', class: 'knapp', text: 'Se när kvarteret gick live', 'aria-label': 'Se när kvarteret gick live: ' + namn + ', klockan ' + api.kl(live) + ', i filmen överst på sidan' });
    knapp.addEventListener('click', () => api.hoppa(live));
    return api.el('div', { class: 'h-kvarter-knapprad' }, knapp);
  }

  function byggKort(api, k, s) {
    const team = txt(k.team), namn = txt(k.namn) || team || 'Namnlöst kvarter';
    const farg = team ? tryggFarg(api, team) : '';
    const kort = api.el('article', { class: 'h-kvarter-kort', 'aria-label': namn });
    if (team && !s.sedda.has(kortId(team))) { kort.id = kortId(team); s.sedda.add(kort.id); }
    if (farg) kort.style.setProperty('--h-kvarter-f', farg);
    const kropp = api.el('div', { class: 'h-kvarter-kropp' });
    const delar = [liveRad(api, k, s), api.el('h4', { class: 'h-kvarter-namn', text: namn }), vemRad(api, k, team, farg), byggeRad(api, k), nyckeltal(api, k),
      typer(api, k), prLista(api, k), invanare(api, k, farg), observatoriet(api, k), liveKnapp(api, k, namn, s.harReplay)];
    for (const d of delar) if (d) kropp.append(d);
    const b = banner(api, k, namn);
    if (b) kort.append(b);
    kort.append(kropp);
    return kort;
  }

  // ---------- rutnät med kort av olika höjd: varje kort läggs i den för stunden kortaste spalten ----------
  function spalta(api, rutnat, kort) {
    let n = 0;
    const antal = () => Math.max(1, Math.min(SPALT_MAX, kort.length || 1, Math.floor(((rutnat.clientWidth || 0) + SPALT_GAP) / (SPALT_MIN + SPALT_GAP))));
    const bygg = () => {
      const ny = antal();
      if (ny === n) return;
      n = ny;
      const hojd = rutnat.offsetHeight;
      if (hojd) rutnat.style.minHeight = hojd + 'px';            // håll höjden under ombygget: annars krymper sidan ett ögonblick och skrollet hoppar
      const spalter = [];
      for (let i = 0; i < n; i++) spalter.push(api.el('div', { class: 'h-kvarter-spalt' }));
      while (rutnat.firstChild) rutnat.removeChild(rutnat.firstChild);
      for (const sp of spalter) rutnat.append(sp);
      for (const k of kort) {
        let mal = spalter[0];
        if (n > 1) for (const sp of spalter) if (sp.offsetHeight < mal.offsetHeight) mal = sp;
        mal.append(k);
      }
      rutnat.style.minHeight = '';
    };
    bygg();
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => requestAnimationFrame(bygg)).observe(rutnat);
    else window.addEventListener('resize', bygg);
  }

  function hopplank(api, k) {
    const team = txt(k.team);
    if (!team) return null;
    const namn = txt(k.namn) || team;
    const a = api.el('a', { class: 'h-kvarter-hopp', href: '#' + kortId(team) });
    const farg = tryggFarg(api, team);
    if (farg) a.style.setProperty('--h-kvarter-f', farg);
    a.append(api.el('span', { class: 'h-kvarter-prick', 'aria-hidden': 'true' }), api.el('span', { text: namn }));
    if (namn.toLowerCase() !== team.toLowerCase()) a.append(api.el('small', { text: team }));   // "Torget torget" säger inget, kortet visar det tekniska namnet ändå
    return api.el('li', null, a);
  }

  window.Historia.sektioner.kvarter = {
    titel: 'Kvarteren och de som byggde dem',
    meny: 'Kvarteren',
    ingang: 'Ett kort per kvarter, i den ordning de gick live. Leta upp ditt eget: här står vad ni byggde, vad det satte igång hos andra och vad staden sa om er.',
    rendera(el, data, api) {
      if (!document.getElementById(STIL_ID)) { const stil = document.createElement('style'); stil.id = STIL_ID; stil.textContent = CSS; document.head.append(stil); }
      const rot = api.el('div', { class: 'h-kvarter' });
      el.append(rot);

      const alla = arr(data && data.kvarter).filter(obj);
      if (!alla.length) { rot.append(api.el('p', { class: 'h-kvarter-tomt', text: 'Det finns inga kvarter i historiken.' })); return; }
      const deltagare = ordnaEfter(alla, 'live');   // en stad: alla kvarter i samma lista, i den ordning de gick live
      const ledning = [];
      const harReplay = !!window.Historia.sektioner.replay;

      // Hitta ditt kvarter: en länk per kort
      const hitta = api.el('nav', { class: 'h-kvarter-hitta', 'aria-label': 'Hoppa till ett kvarter' });
      for (const [rubrik, grupp] of [['Hitta ditt kvarter', deltagare], ['Ledningens kvarter', ledning]]) {
        const lankar = grupp.map(k => hopplank(api, k)).filter(Boolean);
        if (!lankar.length) continue;
        hitta.append(etikett(api, rubrik), api.el('ul', { class: 'h-kvarter-hopplista' }, lankar));
      }
      if (hitta.childNodes.length) rot.append(hitta);
      rot.append(api.el('p', { class: 'h-kvarter-forklaring', text: 'Så läser du talen: en reaktion är en händelse på Stadens puls som pekar ut någon annans händelse som sin orsak. Att andra reagerade på ens kvarter var det som gav poäng under dagen. Bidrag är sammanfogade pull requests, klockslaget är när de gick in, och rader kod är de rader som lades till i dem.' }));
      if (alla.some(k => obj(k.mörker))) {                       // läsningen är lek, och det ska den som hittar sitt kvarter få veta
        const o = alla.find(k => txt(k.team) === 'observatoriet');
        const vem = 'Observatoriet';
        rot.append(api.el('p', { class: 'h-kvarter-forklaring', text: 'Observatoriets läsning är det senaste som ' + vem + ' såg i kvarterets inre mörker. Mörkertalet går från 0 till 100. Läsningen hör till spelet i staden och är inget omdöme om er som byggde.' }));
      }

      const allaKort = [], sedda = new Set();
      const grupp = (rubrik, ingang, lista, sammanhang) => {
        if (!lista.length) return;
        rot.append(api.el('h3', { class: 'h-kvarter-underrubrik', text: rubrik }));
        if (ingang) rot.append(api.el('p', { class: 'h-kvarter-underingang', text: ingang }));
        const rutnat = api.el('div', { class: 'h-kvarter-rutnat' });
        rot.append(rutnat);
        const kort = lista.map(k => byggKort(api, k, sammanhang(k)));
        allaKort.push(...kort);
        spalta(api, rutnat, kort);
      };

      // Deltagarnas kvarter, i den ordning de gick live
      const medLive = deltagare.filter(k => tid(k.live) !== null);
      let text = api.tal(deltagare.length) + ' kvarter, i den ordning de gick live.';
      if (medLive.length) {
        const forst = medLive[0], t = txt(forst.team), n = txt(forst.namn) || t;
        if (n) text += ' Först ut var ' + n + (t && t !== n ? ' (team ' + t + ')' : '') + ' klockan ' + api.kl(forst.live) + '.';
      }
      const medBidrag = medLive.filter(k => arr(k.pr).filter(obj).length);
      if (medBidrag.length && medBidrag.every(k => k.live === Math.min(...arr(k.pr).filter(obj).map(p => tid(p.ts)).filter(t => t !== null)))) text += ' Ett kvarter räknas som live från att dess första bidrag sammanfogades' + (medBidrag.length < medLive.length ? ', och de kvarter som byggdes utan pull request från sin första händelse på Stadens puls.' : '.');
      const bidrag = deltagare.reduce((s, k) => s + arr(k.pr).filter(obj).length, 0);
      const rader = deltagare.reduce((s, k) => s + (arr(k.pr).filter(obj).length ? num(k.rader) || 0 : 0), 0);
      if (bidrag > 0 && rader > 0) text += ' Tillsammans blev det ' + api.tal(bidrag) + ' ' + boj(bidrag, 'sammanfogat bidrag', 'sammanfogade bidrag') + ' och ' + api.tal(rader) + ' ' + boj(rader, 'rad', 'rader') + ' kod.';
      grupp('Kvarteren', text, deltagare, k => {
        const live = tid(k.live);
        return { harReplay, sedda, total: medLive.length, rang: live === null ? 0 : medLive.indexOf(k) + 1 };   // platsen i den ordnade listan, så två kvarter med samma millisekund ändå får nr 3 och nr 4
      });

      // Ledningens kvarter hålls inte längre för sig: listan ovan är hela staden. Blocket ligger kvar för data där ledning finns.
      if (ledning.length) {
      let ledtext = api.tal(ledning.length) + ' kvarter som workshopledningen byggde, inte ett deltagarteam.';
      if (ledning.every(k => !arr(k.pr).length)) ledtext += ' De kom inte in som pull requests från ett team, så här finns inga bidrag eller rader kod att räkna.';
      const forsta = forstaHandelser(data), ledLive = ledning.filter(k => tid(k.live) !== null);
      if (ledLive.length && ledLive.every(k => forsta.has(txt(k.team)) && Math.abs(k.live - forsta.get(txt(k.team))) < 2000)) ledtext += ' De räknas som live från sin första händelse på Stadens puls.';
      grupp('Ledningens kvarter', ledtext, ledning, () => ({ harReplay, sedda, total: 0, rang: 0 }));
      }

      // Markera kortet som adressen pekar på (:target räcker inte, korten finns inte när sidan laddas)
      const markera = () => {
        let h = location.hash.slice(1);
        try { h = decodeURIComponent(h); } catch (e) { /* behåll den råa */ }
        for (const k of allaKort) k.classList.toggle('h-kvarter-vald', !!h && k.id === h);
      };
      window.addEventListener('hashchange', markera);
      markera();
    },
  };
})();
