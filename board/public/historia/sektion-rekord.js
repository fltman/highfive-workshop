// Historiksidan, sektionen "rekord": rekord och kuriosa.
// Varje tal här räknas ur data.json (data.rekord, data.tal, data.minuter, data.puls). Inget är påhittat.
// Formen följer tre regler: staplar i EN färg per diagram (längden bär värdet, inte kulören), teamets färg bara som en prick
// bredvid det utskrivna namnet, och alla värden står som text i raden så att ingen behöver hovra för att läsa dem.
(function () {
  'use strict';
  if (!window.Historia || !window.Historia.sektioner) return;

  const STIL_ID = 'h-rekord-stil';
  const CSS = `
.h-rekord { display:grid; gap:20px; min-width:0; }
.h-rekord-par { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:20px; min-width:0; }
.h-rekord-tva { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 2fr); gap:20px; min-width:0; }
.h-rekord .h-rekord-fig { margin:0; min-width:0; padding:24px 26px 26px; display:flex; flex-direction:column; }
.h-rekord-huvud { display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:10px 18px; margin:0 0 20px; }
.h-rekord-huvudtext { min-width:0; flex:1 1 260px; }
.h-rekord-vinjett { font:600 12px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:0 0 8px; }
.h-rekord-fig h3 { font:700 clamp(21px, 2.2vw, 25px)/1.2 var(--serif); margin:0; letter-spacing:-.005em; overflow-wrap:anywhere; }
.h-rekord-sub { color:var(--dim); font-size:14px; line-height:1.5; margin:6px 0 0; max-width:64ch; overflow-wrap:anywhere; }
.h-rekord-text { color:var(--dim); font-size:15px; line-height:1.55; margin:18px 0 0; max-width:72ch; overflow-wrap:anywhere; }
.h-rekord-text + .h-rekord-text { margin-top:8px; }
.h-rekord-knapprad { margin:20px 0 0; }
.h-rekord-knapprad.h-rekord-botten { margin-top:auto; }
.h-rekord-botten { padding-top:20px; }

/* Kedjan: vågrät på bred skärm, lodrät på smal. Pilen ritas i mellanrummet före varje led utom det första. */
.h-rekord-kedja { list-style:none; margin:0; padding:0; display:flex; align-items:stretch; }
.h-rekord-lank { flex:1 1 0; min-width:0; position:relative; display:flex; flex-direction:column; background:var(--panel2); border:1px solid var(--line); border-top:3px solid var(--lf, var(--svag)); border-radius:12px; padding:14px 16px 14px; }
.h-rekord-lank + .h-rekord-lank { margin-left:44px; }
.h-rekord-lank + .h-rekord-lank::before { content:''; position:absolute; left:-36px; top:50%; width:26px; height:2px; margin-top:-1px; background:var(--svag); }
.h-rekord-lank + .h-rekord-lank::after { content:''; position:absolute; left:-22px; top:50%; width:8px; height:8px; margin-top:-5px; border-top:2px solid var(--svag); border-right:2px solid var(--svag); transform:rotate(45deg); }
.h-rekord-steg { font:600 11px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--dim); }
.h-rekord-typ { font:600 clamp(17px, 1.7vw, 21px)/1.25 var(--mono); color:var(--fg); margin:6px 0 12px; overflow-wrap:anywhere; }
.h-rekord-vem { display:flex; align-items:baseline; gap:8px; font-size:15px; font-weight:600; line-height:1.3; color:var(--fg); overflow-wrap:anywhere; }
.h-rekord-vem .h-rekord-prick { position:relative; top:-1px; }
.h-rekord-lank .h-rekord-under { padding-left:18px; }
.h-rekord-djup { margin-top:auto; padding-top:12px; font:12px/1.45 var(--mono); color:var(--dim); }
.h-rekord-djup::before { content:''; display:block; border-top:1px solid var(--line); margin-bottom:10px; }
.h-rekord-prick { flex:0 0 auto; display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--pf, var(--dim)); }
.h-rekord-under { font:12px/1.4 var(--mono); color:var(--dim); overflow-wrap:anywhere; }

/* Livligaste minuten */
.h-rekord-stort-rad { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 14px; }
.h-rekord-stort { font:800 clamp(52px, 6vw, 72px)/1 var(--mono); letter-spacing:-.03em; color:var(--fg); }
.h-rekord-stort-text { color:var(--dim); font-size:15px; line-height:1.35; }
.h-rekord-stort-text b { display:block; color:var(--fg); font:600 15px var(--mono); }
.h-rekord-remsa { margin:22px 0 0; max-width:520px; }
.h-rekord-pelarrad { display:flex; align-items:flex-end; gap:2px; height:84px; border-bottom:1px solid var(--line); }
.h-rekord-pelarplats { flex:1 1 0; min-width:0; height:100%; display:flex; align-items:flex-end; } /* ingen maxbredd per pelare: axeltexten under räknar med att pelarna fyller hela remsan */
.h-rekord-pelare { display:block; width:100%; border-radius:2px 2px 0 0; background:var(--svag); transform-origin:bottom; }
.h-rekord-pelarplats:hover .h-rekord-pelare { background:var(--dim); }
.h-rekord-topp .h-rekord-pelare, .h-rekord-topp:hover .h-rekord-pelare { background:var(--accent); }
.h-rekord-axel { position:relative; height:20px; margin-top:6px; font:11px var(--mono); color:var(--dim); }
.h-rekord-axel span { position:absolute; top:0; white-space:nowrap; }
.h-rekord-axel .h-rekord-axel-v { left:0; }
.h-rekord-axel .h-rekord-axel-h { right:0; }
.h-rekord-axel .h-rekord-axel-t { transform:translateX(-50%); color:var(--fg); }

/* Vågräta stapeldiagram. Varje rad: etikett, stapel, värdet utskrivet vid stapelns spets. */
.h-rekord-diagram { margin:0 -8px; }
.h-rekord-rad { display:grid; grid-template-columns:var(--ek, 176px) minmax(0, 1fr); gap:4px 12px; align-items:center; padding:6px 8px; border-radius:8px; }
.h-rekord-rad:hover { background:var(--panel2); }
.h-rekord-rad:focus { outline:none; }
.h-rekord-rad:focus-visible { background:var(--panel2); outline:1px solid var(--svag); outline-offset:-1px; }
.h-rekord-etikett { display:flex; align-items:center; gap:9px; min-width:0; }
.h-rekord-etikett-text { display:flex; flex-direction:column; min-width:0; }
.h-rekord-namn { font-size:14px; font-weight:600; line-height:1.3; color:var(--fg); overflow-wrap:anywhere; }
.h-rekord-namn.h-rekord-typnamn { font:600 14px/1.3 var(--mono); }
.h-rekord-spar { display:flex; align-items:center; min-width:0; min-height:22px; border-left:1px solid var(--line); font:600 13px var(--mono); }
.h-rekord-stapel { flex:0 0 auto; display:block; height:14px; border-radius:0 4px 4px 0; background:var(--sf, var(--accent)); transform-origin:left; }
.h-rekord-rad:hover .h-rekord-stapel, .h-rekord-rad:focus-visible .h-rekord-stapel { filter:brightness(1.12); }
.h-rekord-varde { margin-left:8px; color:var(--fg); font-variant-numeric:tabular-nums; white-space:nowrap; }
.h-rekord-chips { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 0; padding:0; list-style:none; }
.h-rekord-chips li { max-width:100%; overflow-wrap:anywhere; }

/* Nyckeltalen: samma rutnät som talen högst upp på sidan, ett snäpp mindre. */
.h-rekord-tal { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
.h-rekord-tal div { background:var(--panel); padding:16px 18px; min-width:0; }
.h-rekord-tal b { display:block; font:800 28px/1.1 var(--mono); color:var(--fg); }
.h-rekord-tal span { display:block; font-size:13px; line-height:1.35; color:var(--dim); margin-top:4px; overflow-wrap:anywhere; }

/* Svävrutan: förstärker, ersätter aldrig. Värdet står alltid som text i raden, och radens aria-label bär samma detaljer som rutan. */
.h-rekord-tips { position:fixed; z-index:40; left:0; top:0; max-width:270px; pointer-events:none; background:var(--panel2); border:1px solid var(--svag); border-radius:10px; padding:9px 12px; font-size:13px; line-height:1.45; color:var(--dim); }
.h-rekord-tips-varde { color:var(--fg); font:600 14px/1.4 var(--mono); }

/* Inträdet: bara när figuren rullar in i bild, och aldrig om läsaren bett om mindre rörelse. */
.h-rekord-anim .h-rekord-lank { opacity:0; transform:translateY(10px); }
.h-rekord-anim.h-rekord-syns .h-rekord-lank { opacity:1; transform:none; transition:opacity .5s ease, transform .5s ease; transition-delay:calc(var(--i, 0) * 240ms); }
.h-rekord-anim .h-rekord-stapel { transform:scaleX(0); }
.h-rekord-anim.h-rekord-syns .h-rekord-stapel { transform:none; transition:transform .7s cubic-bezier(.2, .7, .2, 1); transition-delay:calc(var(--i, 0) * 40ms); }
.h-rekord-anim .h-rekord-pelare { transform:scaleY(0); }
.h-rekord-anim.h-rekord-syns .h-rekord-pelare { transform:none; transition:transform .6s cubic-bezier(.2, .7, .2, 1); transition-delay:calc(var(--i, 0) * 14ms); }
@media (prefers-reduced-motion: reduce) {
  .h-rekord-anim .h-rekord-lank, .h-rekord-anim .h-rekord-stapel, .h-rekord-anim .h-rekord-pelare,
  .h-rekord-anim.h-rekord-syns .h-rekord-lank, .h-rekord-anim.h-rekord-syns .h-rekord-stapel, .h-rekord-anim.h-rekord-syns .h-rekord-pelare { opacity:1; transform:none; transition:none; }
}
@media print {
  .h-rekord-anim .h-rekord-lank, .h-rekord-anim .h-rekord-stapel, .h-rekord-anim .h-rekord-pelare { opacity:1; transform:none; transition:none; }
  .h-rekord-tips { display:none; }
}

/* Bredvid det höga typdiagrammet: minutkortet blir inte högre än sitt innehåll (annars får det ett tomrum i mitten),
   och där fönstret är högt nog följer det med i skrollen. */
@media (min-width:901px) {
  .h-rekord-tva > .h-rekord-minutfig { align-self:start; }
}
@media (min-width:901px) and (min-height:680px) {
  .h-rekord-tva > .h-rekord-minutfig { position:sticky; top:66px; }
}
@media (max-width:1000px) {
  .h-rekord-par { grid-template-columns:minmax(0, 1fr); }
}
@media (max-width:900px) {
  .h-rekord-tva { grid-template-columns:minmax(0, 1fr); }
}
@media (max-width:860px) {
  .h-rekord-kedja { flex-direction:column; }
  .h-rekord-lank + .h-rekord-lank { margin-left:0; margin-top:40px; }
  .h-rekord-lank + .h-rekord-lank::before { left:28px; top:-33px; width:2px; height:24px; margin-top:0; }
  .h-rekord-lank + .h-rekord-lank::after { left:24px; top:-21px; margin-top:0; transform:rotate(135deg); }
}
@media (max-width:700px) {
  .h-rekord-tal { grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media (max-width:560px) {
  .h-rekord .h-rekord-fig { padding:20px 16px 22px; }
  .h-rekord-rad { grid-template-columns:minmax(0, 1fr); }
  .h-rekord-etikett-text { flex-direction:row; flex-wrap:wrap; align-items:baseline; column-gap:8px; }
  .h-rekord-tal div { padding:14px 14px; }
  .h-rekord-tal b { font-size:24px; }
}
`;

  // ---------- små hjälpare ----------
  const ORD = ['noll', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv'];
  const ärTal = v => typeof v === 'number' && isFinite(v);
  const stor = s => s.charAt(0).toUpperCase() + s.slice(1);
  const procent = (del, hel) => (ärTal(del) && ärTal(hel) && hel > 0) ? (del / hel * 100).toFixed(1).replace('.', ',') : null; // '43,7', vanlig avrundning till en decimal
  const lista = ord => ord.length < 2 ? ord.join('') : ord.slice(0, -1).join(', ') + ' och ' + ord[ord.length - 1];

  function summa(rad) { // alla kategorier i en minutrad, utom själva klockslaget
    let s = 0;
    if (rad && typeof rad === 'object') for (const k of Object.keys(rad)) if (k !== 't' && ärTal(rad[k])) s += rad[k];
    return s;
  }

  function par(listan) { // [[namn, antal], …] → bara välformade rader
    return (Array.isArray(listan) ? listan : []).filter(r => Array.isArray(r) && r[0] != null && ärTal(r[1])).map(r => [String(r[0]), r[1]]);
  }

  // Ett varv genom pulsen: antal per typ och avsändare, antal per kedjedjup, största djup, och sekunden då varje typ syntes första gången.
  function räknaPuls(data) {
    const puls = Array.isArray(data.puls) ? data.puls : [];
    const perTyp = new Map(), perDjup = new Map(), först = new Map();
    let maxDjup = 0, antal = 0;
    for (const p of puls) {
      if (!Array.isArray(p) || p.length < 5) continue;
      antal++;
      let m = perTyp.get(p[1]); if (!m) perTyp.set(p[1], m = new Map());
      m.set(p[2], (m.get(p[2]) || 0) + 1);
      perDjup.set(p[4], (perDjup.get(p[4]) || 0) + 1);
      if (ärTal(p[4]) && p[4] > maxDjup) maxDjup = p[4];
      if (ärTal(p[0]) && (!först.has(p[1]) || p[0] < först.get(p[1]))) först.set(p[1], p[0]);
    }
    return antal ? { perTyp, perDjup, först, maxDjup, antal } : null;
  }

  // Letar upp kedjans led i data.puls (samma typ, avsändare, orsakare och djup, senast vid kedjans klockslag).
  // Ger sekunder sedan start per led, eller null om något led inte går att peka ut. Används bara för tidsspannet och hoppet.
  // Pulsraderna saknar id, så ett led pekas bara ut om det är entydigt: finns en likadan händelse inom fem minuter före
  // den funna säger vi hellre ingenting om tiden än gissar.
  function ledTider(data, r, led) {
    const puls = data.puls, typer = data.typer, avs = data.avsändare, start = data.meta && data.meta.start;
    if (!Array.isArray(puls) || !Array.isArray(typer) || !Array.isArray(avs) || !ärTal(start) || !ärTal(r.ts)) return null;
    const sist = Math.floor((r.ts - start) / 1000);
    let gräns = sist;
    const ut = new Array(led.length).fill(null);
    for (let i = led.length - 1; i >= 0; i--) {
      const ti = typer.indexOf(led[i].typ), ai = avs.indexOf(led[i].från), oi = i > 0 ? avs.indexOf(led[i - 1].från) : -1;
      if (ti < 0 || ai < 0 || (i > 0 && oi < 0)) return null;
      const kandidater = [];
      for (const p of puls) if (Array.isArray(p) && ärTal(p[0]) && p[0] <= gräns && p[1] === ti && p[2] === ai && p[3] === oi && p[4] === i + 1) kandidater.push(p[0]);
      if (!kandidater.length) return null;
      let träff;
      if (i === led.length - 1) { if (!kandidater.includes(sist)) return null; träff = sist; } // sista ledets sekund är känd genom kedjans ts
      else { träff = Math.max(...kandidater); if (kandidater.some(k => k !== träff && träff - k <= 300)) return null; }
      ut[i] = träff; gräns = träff;
    }
    return ut;
  }

  function klMedSekund(ts, api) {
    try { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(ts)); }
    catch (e) { return api.kl(ts); }
  }

  window.Historia.sektioner.rekord = {
    titel: 'Rekord och kuriosa',
    meny: 'Rekord',
    ingang: 'Det djupaste, det livligaste och det vanligaste under dagen. Varje tal är räknat ur dagens data, inget är uppskattat.',

    rendera(el, data, api) {
      if (!document.getElementById(STIL_ID)) { const stil = document.createElement('style'); stil.id = STIL_ID; stil.textContent = CSS; document.head.append(stil); }
      data = data || {};
      const rekord = data.rekord || {}, tal = data.tal || {}, kvarterslista = Array.isArray(data.kvarter) ? data.kvarter : [];
      const pr = räknaPuls(data);
      const totalt = ärTal(tal.pulshändelser) && tal.pulshändelser > 0 ? tal.pulshändelser : (pr ? pr.antal : 0);
      const ord = n => (Number.isInteger(n) && n >= 0 && n < ORD.length) ? ORD[n] : api.tal(n);
      const rot = api.el('div', { class: 'h-rekord' });
      const figurer = [];

      // Vem är avsändaren? Kvartersnamn och team skrivs alltid ut, färgen är bara en prick bredvid.
      // En avsändare utan kvarter får ingen teamfärg: api.färg ger då en reservfärg som redan tillhör ett kvarter, och pricken ska inte peka fel.
      function vem(team) {
        const k = kvarterslista.find(x => x && x.team === team) || null;
        let färg = ''; if (k) { try { färg = api.färg(team) || ''; } catch (e) { färg = ''; } }
        return { team, k, färg, namn: (k && k.namn) || String(team == null ? 'okänd' : team), deltagare: !!k && !k.ledning,
          under: !k ? 'avsändare utan kvarter' : k.ledning ? 'kvarter byggt av ledningen' : 'team ' + team };
      }
      // Kontraktet: kvartersnamn och team står tillsammans första gången ett kvarter nämns. Där bara namnet får plats (under en typ) läggs teamet till en gång.
      const sedda = new Set();
      function medTeam(v) {
        if (!v.k || sedda.has(v.team)) return v.namn;
        sedda.add(v.team);
        return v.namn + (v.k.ledning ? ' (byggt av ledningen)' : ' (team ' + v.team + ')');
      }
      function prick(färg) { const p = api.el('span', { class: 'h-rekord-prick', 'aria-hidden': 'true' }); if (färg) p.style.setProperty('--pf', färg); return p; }

      function figur(vinjett, rubrik, sub) {
        const f = api.el('div', { class: 'kort h-rekord-fig' });
        const text = api.el('div', { class: 'h-rekord-huvudtext' }, [api.el('p', { class: 'h-rekord-vinjett', text: vinjett })]);
        if (rubrik) text.append(api.el('h3', { text: rubrik }));
        if (sub) text.append(api.el('p', { class: 'h-rekord-sub', text: sub }));
        const huvud = api.el('div', { class: 'h-rekord-huvud' }, [text]);
        f.append(huvud); figurer.push(f);
        return { f, huvud };
      }
      const stycke = text => api.el('p', { class: 'h-rekord-text', text });
      function hoppknapp(text, ts) {
        const k = api.el('button', { class: 'knapp', type: 'button', text });
        k.addEventListener('click', () => api.hoppa(ts));
        return api.el('p', { class: 'h-rekord-knapprad' }, [k]);
      }
      const förstaTs = ts => (data.meta && ärTal(data.meta.start)) ? Math.max(data.meta.start, ts) : ts;

      // ---------- svävruta, gemensam för alla diagram ----------
      const tips = api.el('div', { class: 'h-rekord-tips', 'aria-hidden': 'true' }); tips.hidden = true;
      const tipsrader = new WeakMap();
      let aktuell = null, storlek = { b: 0, h: 0 };
      function sättTips(mål, rader) { tipsrader.set(mål, rader); mål.setAttribute('data-h-rekord-tips', '1'); }
      function göm() { if (aktuell === null && tips.hidden) return; aktuell = null; tips.hidden = true; } // anropas ofta (pekarrörelser, skroll): gör ingenting när rutan redan är gömd
      function visa(mål, x, y) {
        const rader = tipsrader.get(mål); if (!rader) { göm(); return; }
        if (mål !== aktuell) {
          aktuell = mål; tips.textContent = '';
          rader.forEach((t, i) => tips.append(api.el('div', { class: i === 0 ? 'h-rekord-tips-varde' : '', text: t })));
          tips.style.left = '0px'; tips.style.top = '0px'; // mät bredden från vänsterkanten, annars kläms rutan ihop av sitt förra läge nära högerkanten
          tips.hidden = false;
          // Mät EN gång per innehåll. Rutan är position:fixed med fast max-width, så storleken ändras inte när den flyttas:
          // att läsa offsetWidth vid varje pekarrörelse skulle tvinga fram en ny layout 60 gånger i sekunden utan att ge något.
          storlek = { b: tips.offsetWidth, h: tips.offsetHeight };
        }
        const b = storlek.b, h = storlek.h, W = document.documentElement.clientWidth || window.innerWidth, H = window.innerHeight;
        let l = x + 14, t = y + 16;
        if (l + b > W - 8) l = Math.max(8, x - b - 14);
        if (t + h > H - 8) t = Math.max(8, y - h - 12);
        tips.style.left = l + 'px'; tips.style.top = t + 'px';
      }
      const tipsmål = e => { const m = e.target && e.target.closest ? e.target.closest('[data-h-rekord-tips]') : null; return m && rot.contains(m) ? m : null; };
      rot.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const m = tipsmål(e); if (m) visa(m, e.clientX, e.clientY); else göm(); });
      rot.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') göm(); });
      rot.addEventListener('click', e => { const m = tipsmål(e); if (m) visa(m, e.clientX, e.clientY); else göm(); });
      const vidRad = m => { const r = m.getBoundingClientRect(); visa(m, r.left + Math.min(r.width * 0.5, 240), r.bottom - 12); };
      const tangentfokus = m => { try { return document.activeElement === m && m.matches(':focus-visible'); } catch (e) { return false; } };
      rot.addEventListener('focusin', e => { const m = tipsmål(e); if (m) vidRad(m); });
      rot.addEventListener('focusout', göm);
      // Skroll gömmer rutan. Undantaget är tangentbordsfokus: att tabba till en rad skrollar ofta sidan, och då ska rutan följa raden i stället för att blinka bort.
      window.addEventListener('scroll', () => {
        if (aktuell === null) return;
        if (!tangentfokus(aktuell)) { göm(); return; }
        const r = aktuell.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) göm(); else vidRad(aktuell);
      }, { passive: true });

      // ---------- vågrätt stapeldiagram ----------
      // rader: [{ namn, under, färg (prick) eller null, typnamn: bool, värde, tips: [str…], läs: str }]. En färg per diagram (färgvar).
      function stapeldiagram(rader, max, färgvar, beskrivning, etikettbredd) {
        const d = api.el('div', { class: 'h-rekord-diagram', role: 'list', 'aria-label': beskrivning });
        if (etikettbredd) d.style.setProperty('--ek', etikettbredd);
        rader.forEach((r, i) => {
          const mer = Array.isArray(r.tips) ? r.tips.slice(2) : []; // svävrutans två första rader (värde och namn) står redan i läs-texten, resten läggs till så att skärmläsare får samma detaljer
          const rad = api.el('div', { class: 'h-rekord-rad', role: 'listitem', tabindex: i === 0 ? '0' : '-1', 'aria-label': [r.läs].concat(mer).join('. ') });
          const text = api.el('div', { class: 'h-rekord-etikett-text' }, [api.el('span', { class: 'h-rekord-namn' + (r.typnamn ? ' h-rekord-typnamn' : ''), text: r.namn })]);
          if (r.under) text.append(api.el('span', { class: 'h-rekord-under', text: r.under }));
          const etikett = api.el('div', { class: 'h-rekord-etikett' });
          if (r.färg !== null) etikett.append(prick(r.färg));
          etikett.append(text);
          const andel = max > 0 ? Math.min(1, Math.max(0, r.värde / max)) : 0;
          const stapel = api.el('span', { class: 'h-rekord-stapel', 'aria-hidden': 'true' });
          stapel.style.width = 'calc((100% - 4.8em) * ' + andel.toFixed(4) + ')';
          if (r.värde > 0) stapel.style.minWidth = '2px';
          stapel.style.setProperty('--sf', 'var(' + färgvar + ')');
          stapel.style.setProperty('--i', String(i));
          rad.append(etikett, api.el('div', { class: 'h-rekord-spar' }, [stapel, api.el('span', { class: 'h-rekord-varde', text: api.tal(r.värde) })]));
          sättTips(rad, r.tips);
          d.append(rad);
        });
        d.addEventListener('keydown', e => { // ett tabbstopp per diagram, piltangenter mellan raderna
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
          const alla = Array.from(d.querySelectorAll('.h-rekord-rad')), nu = alla.indexOf(document.activeElement);
          if (nu < 0) return;
          e.preventDefault();
          const nästa = e.key === 'Home' ? 0 : e.key === 'End' ? alla.length - 1 : Math.min(alla.length - 1, Math.max(0, nu + (e.key === 'ArrowDown' ? 1 : -1)));
          alla[nu].tabIndex = -1; alla[nästa].tabIndex = 0; alla[nästa].focus();
        });
        return d;
      }

      // ---------- 1. djupaste kedjan ----------
      function ritaKedja() {
        const r = rekord.djupaste_kedja;
        const led = r && Array.isArray(r.kedja) ? r.kedja.filter(l => l && typeof l.typ === 'string') : [];
        if (!led.length) return null;
        const n = led.length, olika = new Set(led.map(l => l.från)).size, harTid = ärTal(r.ts);
        const rubrik = olika > 1 ? stor(ord(n)) + ' led genom ' + ord(olika) + ' olika avsändare' : stor(ord(n)) + ' led från en och samma avsändare';
        const sub = n === 4 ? 'En händelse som utlöste en reaktion, som utlöste en reaktion, som utlöste en till.' : n > 1 ? 'Varje händelse i kedjan utlöste nästa.' : null;
        const { f, huvud } = figur('Djupaste kedjan', rubrik, sub);
        if (harTid) huvud.append(api.el('span', { class: 'chip', text: 'kl. ' + klMedSekund(r.ts, api) }));

        const ol = api.el('ol', { class: 'h-rekord-kedja' });
        led.forEach((l, i) => {
          const v = vem(l.från);
          if (v.k) sedda.add(v.team); // länken visar både kvartersnamn och team
          const li = api.el('li', { class: 'h-rekord-lank' });
          if (v.färg) li.style.setProperty('--lf', v.färg);
          li.style.setProperty('--i', String(i));
          li.append(api.el('span', { class: 'h-rekord-steg', text: 'Led ' + (i + 1) }), api.el('span', { class: 'h-rekord-typ', text: l.typ }),
            api.el('span', { class: 'h-rekord-vem' }, [prick(v.färg), api.el('span', { text: v.namn })]), api.el('span', { class: 'h-rekord-under', text: v.under }));
          const påDjupet = pr ? pr.perDjup.get(i + 1) : null;
          if (ärTal(påDjupet)) li.append(api.el('span', { class: 'h-rekord-djup', text: 'Under dagen: ' + api.tal(påDjupet) + (påDjupet === 1 ? ' händelse' : ' händelser') + ' på led ' + (i + 1) }));
          ol.append(li);
        });
        f.append(ol);

        // Tidsspannet. Att leden hänger ihop står redan i underrubriken, och det första ledet är INTE en reaktion
        // på något (orsak -1 i pulsen), så det påstås inte här heller.
        const tider = harTid ? ledTider(data, r, led) : null;
        const spann = tider ? tider[n - 1] - tider[0] : null;
        let text = '';
        if (n > 1 && spann === 0) text = (n === 2 ? 'Båda leden' : 'Alla ' + ord(n) + ' leden') + ' kom inom en och samma sekund.';
        else if (n > 1 && ärTal(spann) && spann > 0 && spann <= 120) text = 'Från första till sista led gick det ' + api.tal(spann) + (spann === 1 ? ' sekund.' : ' sekunder.');
        if (text) f.append(stycke(text));
        if (pr && pr.maxDjup === n && n > 1) {
          // Kedjan är inte ensam om sitt djup, så det sägs rakt ut hur många händelser som nådde lika djupt.
          const lika = pr.perDjup.get(n);
          let djupast = 'Djupare än ' + ord(n) + ' led blev ingen kedja under dagen';
          djupast += ärTal(lika) && lika > 1 ? ', och ' + api.tal(lika) + ' händelser nådde så djupt.' : '.';
          f.append(stycke(djupast));
        }
        if (harTid) {
          const start = data.meta && ärTal(data.meta.start) ? data.meta.start : null;
          const mål = (tider && start !== null) ? start + tider[0] * 1000 - 5000 : r.ts - 5000; // fem sekunder före, så att kedjan hinner rulla upp i filmen
          f.append(hoppknapp('Se kedjan i filmen, kl. ' + api.kl(r.ts), förstaTs(mål)));
        }
        return f;
      }

      // ---------- 2. livligaste minuten ----------
      function ritaMinut() {
        const lm = rekord.livligaste_minut;
        if (!lm || !ärTal(lm.t) || !ärTal(lm.antal)) return null;
        const minuter = (Array.isArray(data.minuter) ? data.minuter : []).filter(m => m && ärTal(m.t));
        const idx = minuter.findIndex(m => m.t === lm.t);
        const { f } = figur('Livligaste minuten', null, null);
        f.classList.add('h-rekord-minutfig');
        f.append(api.el('div', { class: 'h-rekord-stort-rad' }, [api.el('span', { class: 'h-rekord-stort', text: api.tal(lm.antal) }),
          api.el('span', { class: 'h-rekord-stort-text' }, [api.el('b', { text: 'kl. ' + api.kl(lm.t) }), 'inlägg på en enda minut'])]));

        if (idx >= 0) { // minut för minut, en kvart åt vardera hållet: toppen i bärnsten, resten nedtonat
          const från = Math.max(0, idx - 15), till = Math.min(minuter.length - 1, idx + 15), urval = minuter.slice(från, till + 1);
          const högst = Math.max(1, ...urval.map(summa));
          const remsa = api.el('div', { class: 'h-rekord-remsa', role: 'img', 'aria-label': 'Inlägg per minut från ' + api.kl(urval[0].t) + ' till ' + api.kl(urval[urval.length - 1].t) + '. Flest kl. ' + api.kl(lm.t) + ': ' + api.tal(lm.antal) + '.' });
          const rad = api.el('div', { class: 'h-rekord-pelarrad' });
          urval.forEach((m, i) => {
            const s = summa(m), plats = api.el('span', { class: 'h-rekord-pelarplats' + (m.t === lm.t ? ' h-rekord-topp' : '') }), pelare = api.el('span', { class: 'h-rekord-pelare' });
            pelare.style.height = (s / högst * 100).toFixed(2) + '%';
            if (s > 0) pelare.style.minHeight = '2px';
            pelare.style.setProperty('--i', String(i));
            plats.append(pelare); sättTips(plats, [api.tal(s) + ' inlägg', 'kl. ' + api.kl(m.t)]); rad.append(plats);
          });
          const lokal = idx - från, axel = api.el('div', { class: 'h-rekord-axel', 'aria-hidden': 'true' });
          if (lokal > 4) axel.append(api.el('span', { class: 'h-rekord-axel-v', text: api.kl(urval[0].t) }));
          if (urval.length - 1 - lokal > 4) axel.append(api.el('span', { class: 'h-rekord-axel-h', text: api.kl(urval[urval.length - 1].t) }));
          const mitt = api.el('span', { class: 'h-rekord-axel-t', text: api.kl(lm.t) }); mitt.style.left = ((lokal + 0.5) / urval.length * 100).toFixed(2) + '%'; axel.append(mitt);
          remsa.append(rad, axel); f.append(remsa);

          const m = minuter[idx], DELAR = [['puls', 'händelse på Stadens puls', 'händelser på Stadens puls'], ['torget', 'inlägg i #torget', 'inlägg i #torget'], ['bygge', 'inlägg i #bygge', 'inlägg i #bygge'],
            ['hjalp', 'inlägg i #hjälp', 'inlägg i #hjälp'], ['brainstorm', 'inlägg i en brainstorm', 'inlägg i brainstormar'], ['gatan', 'replik på gatan', 'repliker på gatan'], ['ovrigt', 'inlägg i övriga kanaler', 'inlägg i övriga kanaler']];
          const delar = DELAR.filter(d => ärTal(m[d[0]]) && m[d[0]] > 0).sort((a, b) => m[b[0]] - m[a[0]]);
          if (delar.length && delar.reduce((s, d) => s + m[d[0]], 0) === lm.antal) f.append(stycke('Minuten bestod av ' + lista(delar.map(d => api.tal(m[d[0]]) + ' ' + (m[d[0]] === 1 ? d[1] : d[2]))) + '.'));

          const allt = minuter.reduce((s, x) => s + summa(x), 0);
          let jämför = minuter.length ? 'Snittet över dagens ' + api.tal(minuter.length) + (minuter.length === 1 ? ' minut' : ' minuter') + ' var ' + (allt / minuter.length).toFixed(1).replace('.', ',') + ' inlägg i minuten.' : '';
          const tvåa = minuter.filter(x => x.t !== lm.t).sort((a, b) => summa(b) - summa(a))[0];
          if (tvåa && summa(tvåa) > 0 && summa(tvåa) < lm.antal) jämför += ' Näst livligast var kl. ' + api.kl(tvåa.t) + ' med ' + api.tal(summa(tvåa)) + '.';
          if (jämför) f.append(stycke(jämför.trim()));
        }
        const knapp = hoppknapp('Hoppa till ' + api.kl(lm.t) + ' i filmen', förstaTs(lm.t)); knapp.classList.add('h-rekord-botten');
        f.append(knapp);
        return f;
      }

      // ---------- 3. vanligaste händelsetyperna ----------
      function ritaTyper() {
        const typer = par(rekord.vanligaste_typer);
        if (!typer.length) return null;
        const allaTyper = Array.isArray(data.typer) ? data.typer : [], avs = Array.isArray(data.avsändare) ? data.avsändare : [];
        const antalTyper = ärTal(tal.händelsetyper) ? tal.händelsetyper : allaTyper.length;
        const { f } = figur('Vanligaste händelserna', typer.length < 2 ? 'Den vanligaste händelsetypen' : 'De ' + ord(typer.length) + ' vanligaste' + (antalTyper > typer.length ? ' av ' + api.tal(antalTyper) + ' händelsetyper' : ' händelsetyperna'),
          'Antal händelser på Stadens puls' + (totalt ? ', av ' + api.tal(totalt) + ' totalt' : '') + '.');

        const rader = typer.map(([typ, antal]) => {
          const rad = { namn: typ, under: '', färg: null, typnamn: true, värde: antal, tips: [api.tal(antal) + (antal === 1 ? ' händelse' : ' händelser'), typ], läs: typ + ': ' + api.tal(antal) + ' händelser' };
          const p = procent(antal, totalt); if (p !== null) rad.tips.push(p + '\u00a0% av alla händelser på pulsen');
          const per = pr ? pr.perTyp.get(allaTyper.indexOf(typ)) : null; // vilka som skrev just den här typen
          if (per && Array.from(per.values()).reduce((s, x) => s + x, 0) === antal) {
            const topp = Array.from(per.entries()).sort((a, b) => b[1] - a[1]), v = vem(avs[topp[0][0]]);
            if (topp.length === 1) { rad.under = 'bara från ' + medTeam(v); rad.tips.push('Alla från ' + v.namn + ' (' + v.under + ')'); }
            else if (topp[0][1] > topp[1][1]) { rad.under = 'mest från ' + medTeam(v); rad.tips.push(api.tal(topp[0][1]) + ' av dem från ' + v.namn + ' (' + v.under + ')'); }
            else { rad.under = 'från ' + ord(topp.length) + ' avsändare'; rad.tips.push('Ingen enskild avsändare skrev flest'); }
            if (rad.under) rad.läs += ', ' + rad.under;
          }
          return rad;
        });
        f.append(stapeldiagram(rader, Math.max(...typer.map(t => t[1])), '--accent', 'De vanligaste händelsetyperna, antal händelser', '200px'));

        const iTopp = typer.reduce((s, t) => s + t[1], 0);
        let text = typer.length > 1 && totalt ? 'De ' + ord(typer.length) + ' står för ' + api.tal(iTopp) + ' av pulsens ' + api.tal(totalt) + ' händelser.' : '';
        if (typer.length > 2 && totalt) { const två = typer[0][1] + typer[1][1]; text += ' Bara ' + typer[0][0] + ' och ' + typer[1][0] + ' är tillsammans ' + api.tal(två) + ', alltså ' + procent(två, totalt) + ' procent.'; }
        if (text) f.append(stycke(text.trim()));

        if (antalTyper > 0) {
          let påhitt = 'Alla ' + api.tal(antalTyper) + ' sorterna hittades på under dagen, av dem som byggde staden.';
          // När den första sorten skrevs och när den sista nya dök upp, räknat ur data.puls. Bara om pulsen verkligen rymmer alla sorterna.
          const start = data.meta && ärTal(data.meta.start) ? data.meta.start : null;
          if (pr && start !== null && pr.perTyp.size === antalTyper && pr.först.size === antalTyper && antalTyper > 1) {
            const ordning = Array.from(pr.först.entries()).sort((a, b) => a[1] - b[1]), första = ordning[0], sista = ordning[ordning.length - 1];
            const fn = allaTyper[första[0]], sn = allaTyper[sista[0]];
            if (typeof fn === 'string' && typeof sn === 'string' && sista[1] > första[1] && ordning[1][1] > första[1] && ordning[ordning.length - 2][1] < sista[1]) {
              påhitt += ' Den första, ' + fn + ', skrevs kl. ' + api.kl(start + första[1] * 1000) + ' och den sista nya, ' + sn + ', dök upp kl. ' + api.kl(start + sista[1] * 1000) + '.';
            }
          }
          if (pr && avs.length) { // hur många sorter som minst ett deltagarteam (inte ledningen) använde
            let n = 0;
            for (const per of pr.perTyp.values()) if (Array.from(per.keys()).some(ai => vem(avs[ai]).deltagare)) n++;
            if (n > 0 && n <= antalTyper) påhitt += ' Av de ' + api.tal(antalTyper) + ' användes ' + api.tal(n) + ' av minst ett deltagarteam.';
          }
          f.append(stycke(påhitt));
        }

        if (pr && allaTyper.length) { // kuriosa: sorter som bara förekom en enda gång
          const engång = [];
          for (const [ti, per] of pr.perTyp) if (Array.from(per.values()).reduce((s, x) => s + x, 0) === 1 && typeof allaTyper[ti] === 'string') engång.push(allaTyper[ti]);
          if (engång.length) {
            f.append(stycke(engång.length === 1 ? 'En sort förekom bara en enda gång:' : stor(ord(engång.length)) + ' sorter förekom bara en enda gång:'));
            const ul = api.el('ul', { class: 'h-rekord-chips' });
            engång.slice(0, 24).forEach(t => ul.append(api.el('li', { class: 'chip', text: t })));
            if (engång.length > 24) ul.append(api.el('li', { class: 'chip', text: 'och ' + api.tal(engång.length - 24) + ' till' }));
            f.append(ul);
          }
        }
        return f;
      }

      // ---------- 4. flitigaste och mest reagerade på, sida vid sida på samma skala ----------
      function ritaKvarter() {
        const flit = par(rekord.flitigaste), fått = par(rekord.mest_reagerad_på);
        if (!flit.length && !fått.length) return null;
        const max = Math.max(1, ...flit.map(r => r[1]), ...fått.map(r => r[1]));
        // Att skalan är gemensam syns inte av sig självt och sägs därför ut. Själva maxvärdet skrivs INTE här: det står redan
        // som siffra vid den längsta stapeln, och samma tal två gånger i två bildtexter bredvid varandra är brus, inte upplysning.
        const sammaSkala = flit.length && fått.length ? 'Båda diagrammen har samma skala.' : '';
        const rad = api.el('div', { class: 'h-rekord-par' });
        const utanKvarter = (rader, en, flera) => rader.map(([t, n]) => ({ v: vem(t), n })).filter(x => !x.v.k)
          .map(x => 'Avsändaren ' + x.v.namn + ' har inget kvarter i staden men finns med ändå, med ' + api.tal(x.n) + ' ' + (x.n === 1 ? en : flera) + '.').join(' ');

        if (flit.length) {
          const { f } = figur('Flitigaste kvarteren', 'Skrev flest händelser', 'Antal händelser som avsändaren själv skrev på Stadens puls.');
          f.append(stapeldiagram(flit.map(([t, n]) => {
            const v = vem(t), tips = [api.tal(n) + (n === 1 ? ' händelse' : ' händelser'), v.namn + ' · ' + v.under], p = procent(n, totalt);
            if (p !== null) tips.push(p + '\u00a0% av alla händelser på pulsen');
            const vanligast = v.k && Array.isArray(v.k.typer) && Array.isArray(v.k.typer[0]) ? v.k.typer[0] : null;
            if (vanligast && ärTal(vanligast[1])) tips.push('Vanligast: ' + vanligast[0] + ', ' + api.tal(vanligast[1]));
            return { namn: v.namn, under: v.under, färg: v.färg, typnamn: false, värde: n, tips, läs: v.namn + ', ' + v.under + ': ' + api.tal(n) + ' händelser' };
          }), max, '--accent', 'Flitigaste kvarteren, antal skrivna händelser', '184px'));
          let text = '';
          if (flit.length > 1 && totalt) {
            const a = vem(flit[0][0]), b = vem(flit[1][0]), två = flit[0][1] + flit[1][1];
            text = 'De två flitigaste, ' + a.namn + ' och ' + b.namn + ', skrev tillsammans ' + api.tal(två) + ' av pulsens ' + api.tal(totalt) + ' händelser, ' + procent(två, totalt) + ' procent.';
          }
          text = [text, utanKvarter(flit, 'händelse', 'händelser'), sammaSkala].filter(Boolean).join(' ');
          if (text) f.append(stycke(text));
          rad.append(f);
        }

        if (fått.length) {
          const { f } = figur('Mest reagerade på', 'Satte igång flest reaktioner', 'Antal gånger någon annan reagerade på något avsändaren skrivit. Det var det som gav poäng under dagen.');
          f.append(stapeldiagram(fått.map(([t, n]) => {
            const v = vem(t), tips = [api.tal(n) + (n === 1 ? ' reaktion från andra' : ' reaktioner från andra'), v.namn + ' · ' + v.under];
            if (v.k && ärTal(v.k.gett)) tips.push('Reagerade själv ' + api.tal(v.k.gett) + (v.k.gett === 1 ? ' gång' : ' gånger') + ' på andra');
            return { namn: v.namn, under: v.under, färg: v.färg, typnamn: false, värde: n, tips, läs: v.namn + ', ' + v.under + ': ' + api.tal(n) + ' reaktioner från andra' };
          }), max, '--lila', 'Mest reagerade på, antal reaktioner från andra', '184px'));
          const etta = vem(fått[0][0]);
          const överst = etta.namn + ' (' + etta.under + ') ligger överst: ' + api.tal(fått[0][1]) + (fått[0][1] === 1 ? ' gång' : ' gånger') + ' reagerade någon annan på en händelse därifrån.';
          f.append(stycke([överst, utanKvarter(fått, 'reaktion', 'reaktioner'), sammaSkala].filter(Boolean).join(' ')));
          rad.append(f);
        }
        return rad;
      }

      // ---------- 5. nyckeltal som inte står högst upp på sidan ----------
      function ritaTal() {
        // Finns radiosektionen räknar den sina egna sändningar och hälsningar, och gör det utförligare: då står de inte här också.
        const harRadio = !!window.Historia.sektioner.radio;
        const rader = [[tal.tidningsnummer, 'nummer av Stadsbladet']]
          .concat(harRadio ? [] : [[tal.radiosändningar, 'sändningar i Radio Torget'], [tal.hälsningar, 'hälsningar till radion']],
            [[tal.observationer, 'observationer från Observatoriet'], [tal.bilder, 'bilder från Ateljén'], [tal.repliker_på_gatan, 'repliker på gatan, sagda av invånarna'],
              [tal.kanaler, 'kanaler på Torget'], [tal.avsändare, 'avsändare på Torget, invånarna på gatan oräknade']]).filter(r => ärTal(r[0]));
        if (!rader.length) return null;
        const { f } = figur('Dagen i övrigt', stor(ord(rader.length)) + ' tal som inte fick plats högst upp', 'Sådant som också hände under dagen.');
        const rutnät = api.el('div', { class: 'h-rekord-tal' });
        for (const [n, text] of rader) rutnät.append(api.el('div', null, [api.el('b', { text: api.tal(n) }), api.el('span', { text })]));
        for (let i = rader.length; i % 4 !== 0; i++) rutnät.append(api.el('div', { 'aria-hidden': 'true' })); // fyll ut sista raden
        f.append(rutnät);
        return f;
      }

      // ---------- montera: varje del för sig, så att ett fel i en del inte släcker de andra ----------
      const försök = (namn, fn) => { try { return fn(); } catch (e) { console.error('rekord: ' + namn, e); return null; } };
      const kedja = försök('kedjan', ritaKedja), minut = försök('minuten', ritaMinut), typer = försök('typerna', ritaTyper), kvarter = försök('kvarteren', ritaKvarter), nyckeltal = försök('nyckeltalen', ritaTal);
      if (kedja) rot.append(kedja);
      if (minut && typer) rot.append(api.el('div', { class: 'h-rekord-tva' }, [minut, typer])); else if (minut || typer) rot.append(minut || typer);
      if (kvarter) rot.append(kvarter);
      if (nyckeltal) rot.append(nyckeltal);
      if (!rot.children.length) { el.append(api.el('p', { class: 'dim', text: 'Det finns inga rekord i dagens data.' })); return; }
      rot.append(tips);
      el.append(rot);

      // Inträdesanimation bara om läsaren inte bett om mindre rörelse, och bara när figuren faktiskt rullar in i bild.
      const stilla = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (!stilla && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(poster => { for (const p of poster) if (p.isIntersecting) { p.target.classList.add('h-rekord-syns'); io.unobserve(p.target); } }, { rootMargin: '0px 0px -8% 0px' });
        for (const f of figurer) if (rot.contains(f)) { f.classList.add('h-rekord-anim'); io.observe(f); }
      }
    },
  };
})();
