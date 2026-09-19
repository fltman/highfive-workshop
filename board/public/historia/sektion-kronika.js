// Krönikan: dagen som en välsatt långläsning. Renderar kronika.json (fjärde argumentet till rendera()).
// Saknas filen, eller är den tom, döljs hela sektionen och dess menylänk: ingen krönika, ingen rubrik.
// All text ur kronika.json är data och sätts med textContent (api.el(..., {text})), aldrig innerHTML.
// Det enda sektionen lägger till själv är etiketter ("Innehåll", "Kapitel 2 av 8", "Se det i filmen", "Pågår i filmen just nu")
// och uppgifter som slås upp i data.kvarter när citatets avsändare är ett känt team, kvarter eller en invånare.
(function () {
  'use strict';
  if (!window.Historia || !window.Historia.sektioner) return;

  const STIL_ID = 'h-kronika-stil';
  const FEM_MINUTER = 5 * 60 * 1000;
  const DUBBLA_CITATTECKEN = '"“”„«»';

  // Alla selektorer börjar med .h-kronika. Färger bara via variablerna i stil.css, plus teamfärgen
  // från api.färg() som läggs i --h-kronika-ton på ett citat (namnet skrivs alltid ut bredvid).
  // Brödtexten är 32em bred. Med Inters proportioner i löpande svensk text ger det ungefär 65–70 tecken
  // per rad, alltså den radlängd uppdraget ber om. Exakt antal beror på texten och på om Inter hinner laddas.
  const CSS = `
.h-kronika { --h-kronika-marg:12rem; --h-kronika-glipa:40px; --h-kronika-ton:var(--accent); font-size:18px; line-height:1.72; color:var(--fg); }
.h-kronika-huvud { max-width:760px; margin:6px 0 44px; }
.h-kronika-rubrik { font:700 clamp(26px, 3.4vw, 40px)/1.16 var(--serif); letter-spacing:-.01em; margin:0 0 16px; overflow-wrap:break-word; text-wrap:balance; }
.h-kronika-ingress { font-size:clamp(18px, 1.6vw, 21px); line-height:1.6; margin:0 0 .8em; max-width:32em; overflow-wrap:break-word; text-wrap:pretty; }
.h-kronika-ingress:last-child { margin-bottom:0; }

.h-kronika-toc { margin:0 0 52px; padding:18px 0 12px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.h-kronika-toc-etikett { font:600 12px/1.4 var(--mono); letter-spacing:.16em; text-transform:uppercase; color:var(--dim); margin:0 0 10px; }
.h-kronika-toc ol { list-style:none; margin:0; padding:0; columns:2 300px; column-gap:44px; }
.h-kronika-toc li { break-inside:avoid; margin:0; padding:0; }
.h-kronika-toc a { display:grid; grid-template-columns:7.4em minmax(0, 1fr); column-gap:14px; align-items:baseline; padding:7px 0; font-size:13px; color:var(--fg); text-decoration:none; }
.h-kronika-toc-utan-tid a { grid-template-columns:minmax(0, 1fr); }
.h-kronika-toc-utan-tid .h-kronika-toc-tid { display:none; }
.h-kronika-toc-tid { font:13px/1.5 var(--mono); color:var(--dim); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.h-kronika-toc-titel { font:700 17px/1.35 var(--serif); overflow-wrap:break-word; transition:color .15s; }
.h-kronika-toc a:hover .h-kronika-toc-titel, .h-kronika-toc a:focus-visible .h-kronika-toc-titel { color:var(--accent); }
.h-kronika-toc a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }

.h-kronika-kapitel { padding:44px 0 20px; border-top:1px solid var(--line); scroll-margin-top:66px; }
/* Kapitlet tar emot fokus när innehållsförteckningen hoppar dit. Ringen ritas innanför kanten så att
   den aldrig kan skjuta ut i sidled, och visas bara för den som styr med tangentbord. */
.h-kronika-kapitel:focus { outline:2px solid var(--accent); outline-offset:-2px; }
.h-kronika-kapitel:focus:not(:focus-visible) { outline:none; }
.h-kronika-forsta { border-top:0; padding-top:0; }
.h-kronika-marginal { display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 16px; margin:0 0 12px; }
.h-kronika-marginal:empty { display:none; }
.h-kronika-tid { font:600 14px/1.5 var(--mono); letter-spacing:.05em; color:var(--accent); margin:0; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.h-kronika-nr { font:12px/1.5 var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0; }
.h-kronika-nu-etikett { display:none; font:12px/1.5 var(--mono); color:var(--me); margin:0; }
.h-kronika-nu-etikett::before { content:""; display:inline-block; width:7px; height:7px; border-radius:50%; background:currentColor; margin-right:8px; vertical-align:1px; }
.h-kronika-nu .h-kronika-nu-etikett { display:block; }

.h-kronika-text { min-width:0; }
.h-kronika-kaprubrik { font:700 clamp(23px, 2.5vw, 31px)/1.2 var(--serif); letter-spacing:-.005em; margin:0 0 18px; max-width:760px; overflow-wrap:break-word; text-wrap:balance; }
.h-kronika-stycke { max-width:32em; margin:0 0 1.1em; overflow-wrap:break-word; text-wrap:pretty; }
.h-kronika-anfang::first-letter { float:left; font:900 3.3em/.84 var(--serif); padding:.05em .1em 0 0; color:var(--accent); }
.h-kronika-slut::after { content:""; display:inline-block; width:.48em; height:.48em; margin-left:.5em; background:var(--accent); }

.h-kronika-citat { margin:32px 0 36px; padding:2px 0 2px 24px; border-left:3px solid var(--h-kronika-ton); max-width:760px; }
.h-kronika-citat blockquote { margin:0; padding:0; }
.h-kronika-citat blockquote::before { content:"”"; content:"”" / ""; display:block; height:.52em; margin:-6px 0 10px; font:900 64px/1 var(--serif); color:var(--h-kronika-ton); }
.h-kronika-citat blockquote p { margin:0; font:italic 500 clamp(22px, 2.5vw, 30px)/1.36 var(--serif); overflow-wrap:break-word; text-wrap:balance; }
.h-kronika-citat-mellan blockquote p { font-size:clamp(20px, 2vw, 25px); line-height:1.4; }
.h-kronika-citat-lang blockquote p { font-size:clamp(18px, 1.7vw, 21px); line-height:1.5; }
.h-kronika-citat figcaption { margin:16px 0 0; display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 12px; font:13px/1.5 var(--mono); color:var(--dim); }
.h-kronika-vem { color:var(--fg); font-weight:600; overflow-wrap:anywhere; }
.h-kronika-vem::before { content:""; display:inline-block; width:20px; height:1px; margin-right:10px; background:var(--dim); vertical-align:.3em; }
.h-kronika-vem-under { overflow-wrap:anywhere; }

.h-kronika-filmrad { margin:4px 0 0; }
.h-kronika-film { appearance:none; -webkit-appearance:none; background:none; border:0; margin:0; padding:11px 0; display:inline-flex; align-items:center; gap:9px; font:600 13px/1.4 var(--mono); letter-spacing:.02em; color:var(--dim); cursor:pointer; text-align:left; transition:color .15s; }
.h-kronika-film::before { content:""; flex:none; width:0; height:0; border-style:solid; border-width:5px 0 5px 8px; border-color:transparent transparent transparent currentColor; }
.h-kronika-film-text { border-bottom:1px solid var(--svag); padding-bottom:1px; }
.h-kronika-film-tid { font-weight:400; font-variant-numeric:tabular-nums; }
.h-kronika-film:hover { color:var(--accent); }
.h-kronika-film:hover .h-kronika-film-text { border-bottom-color:var(--accent); }
.h-kronika-film:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:4px; color:var(--accent); }

@media (min-width:960px) {
  .h-kronika-huvud, .h-kronika-toc { margin-left:calc(var(--h-kronika-marg) + var(--h-kronika-glipa)); }
  .h-kronika-kapitel { display:grid; grid-template-columns:var(--h-kronika-marg) minmax(0, 1fr); column-gap:var(--h-kronika-glipa); align-items:start; }
  .h-kronika-marginal { grid-column:1; grid-row:1; display:block; position:sticky; top:72px; margin:0; padding-top:9px; }
  .h-kronika-text { grid-column:2; grid-row:1; }
  .h-kronika-tid { font-size:15px; margin-bottom:4px; }
  .h-kronika-nu-etikett { margin-top:8px; }
  .h-kronika-citat { margin:40px 0 44px; padding-left:30px; }
}
@media (max-width:700px) {
  .h-kronika { font-size:17px; line-height:1.68; }
  .h-kronika-stycke, .h-kronika-ingress { -webkit-hyphens:auto; hyphens:auto; }
  .h-kronika-citat { margin:28px 0 30px; padding-left:18px; }
  .h-kronika-citat blockquote::before { font-size:52px; }
  .h-kronika-toc a { grid-template-columns:7em minmax(0, 1fr); column-gap:10px; }
  .h-kronika-toc-utan-tid a { grid-template-columns:minmax(0, 1fr); }
}
`;

  // ---------- Tvätt av indata: kronika.json skrivs av någon annan, lita inte på formen ----------

  const text = v => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '').trim();
  // Tusentalsgrupper ("63 400 251 268") får fast mellanrum så att ett tal aldrig bryts över två rader. Syns inte, ändrar inga tecken.
  const hållIhopTal = s => s.replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0');
  const stycken = v => [].concat(v == null ? [] : v).map(text).flatMap(s => s.split(/\n\s*\n/)).map(s => hållIhopTal(s.trim())).filter(Boolean);
  const gemen = s => s.toLocaleLowerCase('sv');

  // "09:38 - 09:51" → "09:38–09:51". Bara strecket mellan två klockslag putsas, inget annat i texten rörs (ett datum förblir ett datum).
  const putsaTid = s => s.replace(/(\d{1,2}[:.]\d{2})\s*[-–—]\s*(?=\d{1,2}[:.]\d{2})/g, '$1–');

  // Pull quoten har ett eget dekorativt citattecken. Omsluts HELA citatet redan av dubbla citattecken
  // (och har inga fler inuti) tas det yttre paret bort så att det inte står dubbelt. Apostrofer rörs aldrig.
  function utanYttreCitattecken(s) {
    if (s.length < 3 || !DUBBLA_CITATTECKEN.includes(s[0]) || !DUBBLA_CITATTECKEN.includes(s[s.length - 1])) return s;
    const inre = s.slice(1, -1);
    for (const c of inre) if (DUBBLA_CITATTECKEN.includes(c)) return s;
    return inre.trim() || s;
  }

  function tvättaKapitel(k) {
    if (!k || typeof k !== 'object') return null;
    let citat = null;
    if (typeof k.citat === 'string') citat = { text: text(k.citat), vem: '' };
    else if (k.citat && typeof k.citat === 'object') citat = { text: text(k.citat.text), vem: text(k.citat.vem) };
    if (citat) citat.text = hållIhopTal(utanYttreCitattecken(citat.text));
    if (citat && !citat.text) citat = null;
    const ut = { tid: putsaTid(text(k.tid)), rubrik: text(k.rubrik), stycken: stycken(k.stycken), citat, råHoppa: k.hoppa_ts };
    if (!ut.rubrik && !ut.stycken.length && !ut.citat) return null;
    return ut;
  }

  function tvätta(kronika) {
    if (!kronika || typeof kronika !== 'object') return null;
    const kapitel = (Array.isArray(kronika.kapitel) ? kronika.kapitel : []).map(tvättaKapitel).filter(Boolean);
    const ut = { rubrik: text(kronika.rubrik), ingress: stycken(kronika.ingress), kapitel };
    if (!ut.rubrik && !ut.ingress.length && !kapitel.length) return null;
    return ut;
  }

  // hoppa_ts måste vara ett klockslag under workshopdagen (fem minuters marginal, sedan kläms det in i filmen).
  // Allt annat, till exempel sekunder i stället för millisekunder, ger ingen länk alls hellre än en länk som hamnar fel.
  // Bara tal och siffersträngar räknas: en lista eller ett objekt i JSON kan bli ett tal av misstag ([1789630711638] → 1789630711638).
  function giltigHoppa(rå, data) {
    if ((typeof rå !== 'number' && typeof rå !== 'string') || rå === '') return null;
    const ts = Number(rå);
    if (!Number.isFinite(ts) || ts <= 0 || ts > 8.64e15) return null;
    const meta = (data && data.meta) || {}, start = Number(meta.start), slut = Number(meta.slut);
    if (!Number.isFinite(start) || !Number.isFinite(slut) || slut <= start) return ts;
    if (ts < start - FEM_MINUTER || ts > slut + FEM_MINUTER) return null;
    return Math.min(Math.max(ts, start), slut);
  }

  // Gör om "HH:MM" till ts med dagens första inlägg som ankare: api.kl(start) ger svensk väggklocka för en känd ts,
  // resten är minuträkning. Håller så länge dagen saknar sommartidsskifte, vilket 17 september gör.
  function klocktolk(data, api) {
    const start = Number(data && data.meta && data.meta.start);
    if (!Number.isFinite(start) || start <= 0) return null; // Number(null) blir 0: utan dagens starttid finns ingen väggklocka att räkna från
    let m = null;
    try { m = /(\d{1,2})\D(\d{2})/.exec(api.kl(start)); } catch (e) { return null; }
    if (!m) return null;
    const startMinut = Number(m[1]) * 60 + Number(m[2]), bas = Math.floor(start / 60000) * 60000;
    return (h, min) => bas + (h * 60 + min - startMinut) * 60000;
  }

  // "09:38–09:51" → {från, till} i ts, slutminuten inräknad. Ett ensamt klockslag blir en minut. Går det inte att tolka: null.
  function tidsspann(tid, tillTs) {
    if (!tillTs) return null;
    const m = /(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/.exec(tid || '');
    if (!m) return null;
    const h1 = Number(m[1]), m1 = Number(m[2]);
    if (h1 > 23 || m1 > 59) return null;
    const från = tillTs(h1, m1);
    let till = från + 60000;
    if (m[3] != null) {
      const h2 = Number(m[3]), m2 = Number(m[4]);
      if (h2 <= 23 && m2 <= 59) { const t = tillTs(h2, m2) + 60000; if (t > från) till = t; }
    }
    return { från, till };
  }

  // Vem sa det? Krönikören skriver avsändaren fritt: "lp", "lp, 11:31", "strandkant (senare zero-cool)", "Doktor Tora Tokamak".
  // Känns ett team, ett kvartersnamn eller en invånare ur data.kvarter igen skrivs både kvartersnamn och team ut
  // (kontraktets regel 7), ledningens kvarter märks som ledningens, och citatlinjen får teamets färg.
  // Tre sätt att känna igen, i tur och ordning: hela strängen, dess början (följd av skiljetecken, inte av ett efternamn),
  // eller slutet av en parentes. Allt annat visas precis som det står, utan tillägg: hellre inget påstående än ett fel.
  function vemÄr(vem, data) {
    const rå = text(vem);
    if (!rå) return null;
    const bar = rå.replace(/^@/, ''), s = gemen(bar);
    const kandidater = [];
    for (const k of data && Array.isArray(data.kvarter) ? data.kvarter : []) {
      if (!k || typeof k !== 'object') continue;
      const team = text(k.team), namn = text(k.namn);
      const invånare = k.invånare && typeof k.invånare === 'object' ? text(k.invånare.namn) : '';
      if (invånare) kandidater.push({ nyckel: gemen(invånare), k, invånare });
      if (team) kandidater.push({ nyckel: gemen(team), k });
      if (namn && gemen(namn) !== gemen(team)) kandidater.push({ nyckel: gemen(namn), k });
    }
    const exakt = t => kandidater.find(c => c.nyckel === t) || null;

    let träff = exakt(s), hela = !!träff;
    if (!träff && s.length === bar.length) {
      for (const c of kandidater) {
        if (!s.startsWith(c.nyckel) || (träff && träff.nyckel.length >= c.nyckel.length)) continue;
        if (/^(?:[,;:(]|\s+(?:[^\s\p{Lu}]|$))/u.test(bar.slice(c.nyckel.length))) träff = c;
      }
    }
    if (!träff) {
      const m = /\(([^()]+)\)/.exec(s), ord = m ? m[1].trim().split(/\s+/) : [];
      for (let i = 0; i < ord.length && !träff; i++) träff = exakt(ord.slice(i).join(' ').replace(/^@/, ''));
    }
    if (!träff) return { namn: rå, under: '', team: null };

    const k = träff.k, team = text(k.team), namn = text(k.namn);
    if (träff.invånare) return { namn: hela ? träff.invånare : rå, under: text(k.invånare.roll), team: team || null };
    const kvarter = namn && team && gemen(namn) !== gemen(team) ? namn + ' (' + team + ')' : (namn || team);
    const ledning = k.ledning === true ? 'byggt av workshopledningen' : '';
    if (hela) return { namn: kvarter, under: ledning, team: team || null };
    // Delträff: krönikörens ord står kvar, kvarteret läggs till under om det inte redan står där.
    const stårRedan = (!namn || s.includes(gemen(namn))) && (!team || s.includes(gemen(team)));
    return { namn: rå, under: stårRedan ? ledning : kvarter + (ledning ? ', ' + ledning : ''), team: team || null };
  }

  // ---------- DOM ----------

  function läggTillStil() {
    if (document.getElementById(STIL_ID)) return;
    const s = document.createElement('style');
    s.id = STIL_ID; s.textContent = CSS;
    document.head.append(s);
  }

  function dölj(sek) {
    if (!sek) return;
    sek.hidden = true; sek.style.display = 'none';
    if (!sek.id) return;
    for (const a of document.querySelectorAll('#meny a')) {
      if (a.getAttribute('href') === '#' + sek.id) { a.hidden = true; a.style.display = 'none'; }
    }
  }

  // Filmen är sektionen "replay". Finns den inte (eller har den dolt sig) visas inga länkar dit: hellre ingen länk än en död.
  // Har filmen kraschat när den ritades (kärnan skriver då ut ett fel i dess yta) räknas den också som borta.
  function filmenFinns() {
    const r = document.getElementById('replay');
    if (!r) return !!window.Historia.sektioner.replay;
    if (r.hidden || r.style.display === 'none') return false;
    let fel = null;
    try { fel = r.querySelector(':scope > div > .fel'); } catch (e) { fel = null; }
    return !fel;
  }

  const lugnRörelse = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // api.hoppa() spolar filmen och skrollar mjukt upp till den. Den som bett om mindre rörelse får samma hopp utan åkningen:
  // ett direkt skroll efteråt avbryter det mjuka.
  function hoppaTill(ts, api) {
    api.hoppa(ts);
    if (!lugnRörelse()) return;
    const r = document.getElementById('replay');
    if (r) { try { r.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (e) { /* det mjuka skrollet duger */ } }
  }

  function citatEl(citat, data, api) {
    const n = citat.text.length;
    const fig = api.el('figure', { class: 'h-kronika-citat' + (n > 220 ? ' h-kronika-citat-lang' : n > 110 ? ' h-kronika-citat-mellan' : '') });
    fig.append(api.el('blockquote', null, api.el('p', { text: citat.text })));
    const v = vemÄr(citat.vem, data);
    if (v) {
      const fc = api.el('figcaption', null, api.el('span', { class: 'h-kronika-vem', text: v.namn }));
      if (v.under) fc.append(api.el('span', { class: 'h-kronika-vem-under', text: v.under }));
      fig.append(fc);
      if (v.team) { try { fig.style.setProperty('--h-kronika-ton', api.färg(v.team)); } catch (e) { /* accentfärgen duger */ } }
    }
    return fig;
  }

  function innehåll(kapitel, api, idFör) {
    const harTid = kapitel.some(k => k.tid);
    const nav = api.el('nav', { class: 'h-kronika-toc' + (harTid ? '' : ' h-kronika-toc-utan-tid'), 'aria-label': 'Krönikans kapitel' });
    nav.append(api.el('p', { class: 'h-kronika-toc-etikett', text: 'Innehåll · ' + api.tal(kapitel.length) + ' kapitel' }));
    const ol = api.el('ol', { role: 'list' });
    kapitel.forEach((k, i) => {
      const a = api.el('a', { href: '#' + idFör(i) }, [
        api.el('span', { class: 'h-kronika-toc-tid', text: k.tid }),
        api.el('span', { class: 'h-kronika-toc-titel', text: k.rubrik || 'Kapitel ' + (i + 1) }),
      ]);
      // Stommen har mjuk skroll på hela sidan. Den som bett om mindre rörelse får ett direkt hopp i stället.
      a.addEventListener('click', e => {
        const mål = document.getElementById(idFör(i));
        if (!lugnRörelse() || !mål) return;
        e.preventDefault();
        try { mål.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (fel) { mål.scrollIntoView(); }
        try { history.replaceState(null, '', '#' + idFör(i)); } catch (fel) { /* adressen är inte viktig */ }
        try { mål.focus({ preventScroll: true }); } catch (fel) { /* fokus är en artighet */ }
      });
      ol.append(api.el('li', null, a));
    });
    nav.append(ol);
    return nav;
  }

  function rendera(el, data, api, kronika) {
    const k = tvätta(kronika);
    if (!k) { dölj(el.parentElement || el); return; }
    läggTillStil();

    const sekId = (el.parentElement && el.parentElement.id) || 'kronika';
    const idFör = i => sekId + '-kapitel-' + (i + 1);
    const antal = k.kapitel.length;
    const harFilm = filmenFinns() && typeof api.hoppa === 'function';
    const tillTs = klocktolk(data, api);
    const kapTagg = k.rubrik ? 'h4' : 'h3'; // rubriknivåerna ska inte hoppa över ett steg när krönikan saknar egen rubrik
    const art = api.el('article', { class: 'h-kronika' });

    if (k.rubrik || k.ingress.length) {
      const huvud = api.el('header', { class: 'h-kronika-huvud' });
      if (k.rubrik) huvud.append(api.el('h3', { class: 'h-kronika-rubrik', text: k.rubrik }));
      for (const t of k.ingress) huvud.append(api.el('p', { class: 'h-kronika-ingress', text: t }));
      art.append(huvud);
    }

    if (antal > 4) art.append(innehåll(k.kapitel, api, idFör));

    const delar = [], spann = [];
    let sistaStycke = null;
    k.kapitel.forEach((kap, i) => {
      const sek = api.el('section', { class: 'h-kronika-kapitel' + (i === 0 ? ' h-kronika-forsta' : ''), id: idFör(i), tabindex: '-1' });
      const s = harFilm ? tidsspann(kap.tid, tillTs) : null;

      const marg = api.el('div', { class: 'h-kronika-marginal' });
      if (kap.tid) marg.append(api.el('p', { class: 'h-kronika-tid', text: kap.tid }));
      if (antal > 1) marg.append(api.el('p', { class: 'h-kronika-nr', text: 'Kapitel ' + (i + 1) + ' av ' + antal }));
      if (s) marg.append(api.el('p', { class: 'h-kronika-nu-etikett', text: 'Pågår i filmen just nu' }));

      const kropp = api.el('div', { class: 'h-kronika-text' });
      if (kap.rubrik) {
        const h = api.el(kapTagg, { class: 'h-kronika-kaprubrik', id: idFör(i) + '-rubrik', text: kap.rubrik });
        sek.setAttribute('aria-labelledby', h.id);
        kropp.append(h);
      } else sek.setAttribute('aria-label', 'Kapitel ' + (i + 1));

      // Citatet dras ut mitt i kapitlet: efter första stycket av två, andra av tre eller fyra, och så vidare.
      const efter = Math.ceil(kap.stycken.length / 2);
      kap.stycken.forEach((t, j) => {
        const p = api.el('p', { class: 'h-kronika-stycke', text: t });
        if (i === 0 && j === 0 && t.length >= 160 && /^\p{L}/u.test(t)) p.classList.add('h-kronika-anfang');
        kropp.append(p);
        sistaStycke = p;
        if (kap.citat && j + 1 === efter) kropp.append(citatEl(kap.citat, data, api));
      });
      if (kap.citat && !kap.stycken.length) kropp.append(citatEl(kap.citat, data, api));

      const ts = harFilm ? giltigHoppa(kap.råHoppa, data) : null;
      if (ts != null) {
        let klockslag = '';
        try { klockslag = api.kl(ts); } catch (e) { klockslag = ''; }
        const knapp = api.el('button', { type: 'button', class: 'h-kronika-film' }, api.el('span', { class: 'h-kronika-film-text', text: 'Se det i filmen' }));
        if (klockslag) { knapp.append(api.el('span', { class: 'h-kronika-film-tid', text: klockslag })); knapp.setAttribute('aria-label', 'Se det i filmen, klockan ' + klockslag); }
        knapp.addEventListener('click', () => hoppaTill(ts, api));
        kropp.append(api.el('p', { class: 'h-kronika-filmrad' }, knapp));
      }

      sek.append(marg, kropp);
      art.append(sek);
      delar.push(sek); spann.push(s);
    });
    // Slutmärket sätts bara när sista kapitlets brödtext slutar med ett stycke (ett ensamt stycke följs av sitt citat).
    // Filmlänken får stå under märket: den är en väg vidare, inte en del av texten.
    const sista = antal ? k.kapitel[antal - 1] : null;
    if (sistaStycke && sista && sista.stycken.length && (sista.stycken.length > 1 || !sista.citat)) sistaStycke.classList.add('h-kronika-slut');

    el.append(art);

    // Följ filmen: varje kapitel vars tidsspann rymmer filmens klocka får en liten markering i marginalen.
    // Kapitlen är tematiska och får överlappa i tid ("09:38–10:32" och "09:41–09:52"), så flera kan vara märkta samtidigt.
    // Lyssnaren kan ropas varje bildruta, så DOM rörs bara när ett kapitel börjar eller slutar gälla.
    if (spann.some(Boolean) && typeof api.påTid === 'function') {
      const märkt = spann.map(() => false);
      api.påTid(ts => {
        if (typeof ts !== 'number' || !Number.isFinite(ts)) return;
        for (let j = 0; j < spann.length; j++) {
          const s = spann[j], på = !!s && ts >= s.från && ts < s.till;
          if (på === märkt[j]) continue;
          märkt[j] = på;
          if (på) delar[j].classList.add('h-kronika-nu'); else delar[j].classList.remove('h-kronika-nu');
        }
      });
    }
  }

  window.Historia.sektioner.kronika = {
    titel: 'Krönikan',
    meny: 'Krönikan',
    ingang: 'Dagen berättad som en långläsning, kapitel för kapitel, med klockslaget som vinjett.',
    rendera,
  };
})();
