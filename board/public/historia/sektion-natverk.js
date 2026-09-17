// Sektionen "natverk": vem reagerade på vem.
// Kvarteren står runt en cirkel (en stående oval på smala skärmar, så att namnen får plats i vågrät text). Varje rad i
// data.nätverk blir en båge som är bred hos den som ORSAKADE och smalnar av till en spets hos den som REAGERADE.
// Bredden följer kvadratroten av antalet, annars dränker Elverket och MyBank allt annat. Listan under diagrammet visar
// samma tal i rät skala, och tabellen längst ned har varenda relation, så ingen uppgift hänger på färg eller hovring.
(function () {
  'use strict';
  const H = window.Historia;
  if (!H || !H.sektioner) return;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const SPANN = 0.9;  // hur långt upp och ned på ovalen noderna går, som andel av halva höjden
  const GLAPP = 8;    // luft mellan cirkel och etikett (markeringsringen ska få plats emellan)
  const STIL_ID = 'h-natverk-stil';
  const SKILJE = String.fromCharCode(31);   // skiljer från och till i en nyckel. Kan inte förekomma i ett teamnamn.

  const CSS = `
.h-natverk { display:block; }
.h-natverk-slutsats { max-width:820px; margin:0 0 30px; padding:16px 20px; border-left:3px solid var(--accent); background:var(--panel); border-radius:0 12px 12px 0; font-size:18px; line-height:1.55; }
.h-natverk-slutsats b { font-weight:600; font-variant-numeric:tabular-nums; }
.h-natverk-rad { display:grid; grid-template-columns:minmax(0,1fr) minmax(280px,340px); gap:18px 28px; align-items:start; }
.h-natverk-yta { grid-column:1; grid-row:1; min-width:0; overflow:hidden; }
.h-natverk-yta svg { display:block; margin:0 auto; max-width:100%; height:auto; touch-action:manipulation; }
.h-natverk-panel { grid-column:2; grid-row:1 / span 2; position:sticky; top:66px; min-height:21em; }
.h-natverk-forklaring { grid-column:1; grid-row:2; font-size:14px; line-height:1.5; color:var(--dim); }
.h-natverk-forklaring p { margin:0 0 8px; max-width:720px; }
.h-natverk-fgrupp { display:flex; flex-wrap:wrap; align-items:center; gap:6px 16px; margin:0 0 10px; }
.h-natverk-fetikett { font:600 12px var(--mono); color:var(--dim); letter-spacing:.04em; text-transform:uppercase; flex:0 0 100%; }
.h-natverk-prov { display:inline-flex; align-items:center; gap:7px; font:12px var(--mono); color:var(--fg); font-variant-numeric:tabular-nums; }
.h-natverk-prov svg { display:block; flex:none; overflow:visible; }
.h-natverk-kant { opacity:.5; transition:opacity .18s ease; stroke:transparent; stroke-width:4px; stroke-linejoin:round; }
.h-natverk-aktiv .h-natverk-kant { opacity:.05; }
.h-natverk-aktiv .h-natverk-kant.h-natverk-pa { opacity:.95; }
.h-natverk-nod { cursor:pointer; outline:none; transition:opacity .18s ease; -webkit-tap-highlight-color:transparent; }
.h-natverk-aktiv .h-natverk-nod { opacity:.28; }
.h-natverk-aktiv .h-natverk-nod.h-natverk-pa { opacity:1; }
.h-natverk-traff { fill:none; pointer-events:all; }
.h-natverk-bakgrund { fill:none; pointer-events:all; }
.h-natverk-bas { fill:var(--bg); }
.h-natverk-ring { fill:none; stroke:none; stroke-width:1.5; }
.h-natverk-nod.h-natverk-vald .h-natverk-ring { stroke:var(--fg); }
.h-natverk-nod:focus-visible .h-natverk-ring { stroke:var(--accent); stroke-width:2; }
.h-natverk-etikett { fill:var(--fg); font-family:var(--sans); font-weight:500; user-select:none; -webkit-user-select:none; }
.h-natverk-team { fill:var(--dim); font-family:var(--mono); font-weight:400; }
.h-natverk-ptitel { display:flex; align-items:baseline; gap:10px; font:700 24px/1.15 var(--serif); margin:0 0 10px; overflow-wrap:anywhere; }
.h-natverk-prick { display:inline-block; flex:none; width:11px; height:11px; border-radius:50%; background:var(--dim); border:2px solid var(--dim); }
.h-natverk-prick.h-natverk-ihalig { background:var(--bg); }
.h-natverk-chips { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 14px; }
.h-natverk-fakta { margin:0 0 16px; padding:0; }
.h-natverk-fakta div { display:flex; justify-content:space-between; align-items:baseline; gap:14px; padding:7px 0; border-bottom:1px solid var(--line); }
.h-natverk-fakta dt { font-size:14px; line-height:1.35; color:var(--dim); }
.h-natverk-fakta dd { margin:0; font:600 18px var(--mono); color:var(--fg); font-variant-numeric:tabular-nums; white-space:nowrap; }
.h-natverk-punderrubrik { font:600 12px var(--mono); color:var(--dim); letter-spacing:.04em; text-transform:uppercase; margin:0 0 8px; }
.h-natverk-starkast { list-style:none; margin:0 0 12px; padding:0; }
.h-natverk-starkast li { display:flex; align-items:baseline; gap:9px; padding:5px 0; font-size:15px; line-height:1.4; }
.h-natverk-starkast .chip { flex:none; min-width:42px; text-align:center; }
.h-natverk-ptext { margin:0 0 12px; font-size:15px; line-height:1.5; }
.h-natverk-tips { margin:0; font-size:13px; line-height:1.45; color:var(--dim); }
.h-natverk-slapp { margin-top:6px; background:none; color:var(--accent); border:1px solid var(--accent); border-radius:9px; padding:6px 13px; font:600 12px var(--mono); cursor:pointer; }
.h-natverk-slapp:focus-visible { outline:2px solid var(--fg); outline-offset:2px; }
.h-natverk-h3 { font:700 24px/1.2 var(--serif); margin:44px 0 6px; }
.h-natverk-h3under { color:var(--dim); font-size:15px; margin:0 0 18px; max-width:760px; }
.h-natverk-topp { list-style:none; margin:0; padding:0; display:grid; grid-auto-flow:column; grid-template-columns:repeat(2, minmax(0,1fr)); grid-template-rows:repeat(var(--h-natverk-rader, 5), auto); gap:10px 28px; }
.h-natverk-rel { display:grid; grid-template-columns:30px minmax(0,1fr); gap:0 8px; padding:12px 14px; border:1px solid var(--line); border-radius:12px; background:var(--panel); }
.h-natverk-rel.h-natverk-pa { border-color:var(--accent); }
.h-natverk-rang { font:600 14px var(--mono); color:var(--svag); padding-top:2px; font-variant-numeric:tabular-nums; }
.h-natverk-relhuvud { display:flex; align-items:baseline; gap:8px; font-weight:600; font-size:16px; line-height:1.3; overflow-wrap:anywhere; }
.h-natverk-stapelrad { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:10px; margin:7px 0 5px; }
.h-natverk-stapel { height:6px; min-width:2px; border-radius:0 3px 3px 0; background:var(--dim); }
.h-natverk-varde { font:600 13px var(--mono); color:var(--fg); font-variant-numeric:tabular-nums; min-width:34px; text-align:right; }
.h-natverk-mening { font-size:14px; line-height:1.4; color:var(--dim); }
.h-natverk-alla { margin:26px 0 0; border:1px solid var(--line); border-radius:12px; background:var(--panel); }
.h-natverk-alla summary { cursor:pointer; padding:13px 16px; font:600 13px var(--mono); color:var(--accent); }
.h-natverk-alla summary:focus-visible { outline:2px solid var(--fg); outline-offset:2px; border-radius:12px; }
.h-natverk-tabellyta { overflow-x:auto; padding:0 6px 10px; }
.h-natverk-tabell { width:100%; border-collapse:collapse; font-size:14px; }
.h-natverk-tabell caption { text-align:left; color:var(--dim); font-size:13px; padding:0 10px 8px; }
.h-natverk-tabell th { text-align:left; font:600 12px var(--mono); color:var(--dim); padding:7px 10px; border-bottom:1px solid var(--line); }
.h-natverk-tabell td { padding:6px 10px; border-bottom:1px solid var(--line); overflow-wrap:anywhere; }
.h-natverk-tabell th.h-natverk-num, .h-natverk-tabell td.h-natverk-num { text-align:right; font-family:var(--mono); font-variant-numeric:tabular-nums; white-space:nowrap; }
.h-natverk-fot { color:var(--dim); font-size:14px; line-height:1.5; max-width:760px; margin:16px 0 0; }
@media (max-width:900px) {
  .h-natverk-rad { grid-template-columns:minmax(0,1fr); }
  .h-natverk-yta, .h-natverk-panel, .h-natverk-forklaring { grid-column:1; grid-row:auto; }
  .h-natverk-panel { position:static; min-height:0; }
}
@media (max-width:760px) {
  .h-natverk-topp { grid-auto-flow:row; grid-template-columns:minmax(0,1fr); grid-template-rows:none; }
  .h-natverk-slutsats { font-size:16px; padding:14px 16px; }
  .h-natverk-ptitel { font-size:21px; }
}
@media (prefers-reduced-motion: reduce) {
  .h-natverk-kant, .h-natverk-nod { transition:none; }
}
`;

  function stil() {
    if (document.getElementById(STIL_ID)) return;
    const st = document.createElement('style');
    st.id = STIL_ID;
    st.textContent = CSS;
    document.head.append(st);
  }

  function s(tagg, attr) {
    const e = document.createElementNS(SVGNS, tagg);
    for (const k in (attr || {})) e.setAttribute(k, attr[k]);
    return e;
  }

  const f1 = x => (Math.round(x * 10) / 10).toString();
  const kapa = (t, max) => (t.length > max ? t.slice(0, max - 1) + '…' : t);

  // Delar ett långt namn i två rader vid det mellanslag som ger jämnast rader.
  function brytNamn(namn, maxTecken) {
    const t = String(namn).trim();
    if (t.length <= maxTecken || t.indexOf(' ') < 0) return [t];
    let bast = null;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== ' ') continue;
      const langst = Math.max(i, t.length - i - 1);
      if (!bast || langst < bast.langst) bast = { i, langst };
    }
    return [t.slice(0, bast.i), t.slice(bast.i + 1)];
  }

  // Läser ut noder och bågar ur datat. Allt som visas senare kommer härifrån.
  function forbered(data, api) {
    const d = data || {};
    const kvarter = Array.isArray(d.kvarter) ? d.kvarter.filter(k => k && typeof k.team === 'string' && k.team) : [];
    const avs = Array.isArray(d.avsändare) ? d.avsändare : [];
    const pulsAntal = new Map();
    let egna = 0;
    if (Array.isArray(d.puls) && avs.length) {
      for (const p of d.puls) {
        if (!Array.isArray(p)) continue;
        const vem = avs[p[2]];
        if (typeof vem !== 'string') continue;
        pulsAntal.set(vem, (pulsAntal.get(vem) || 0) + 1);
        if (p[3] >= 0 && p[3] === p[2]) egna++;   // reaktion på den egna händelsen: finns inte i data.nätverk
      }
    }

    const sammanslagna = new Map();
    for (const r of (Array.isArray(d.nätverk) ? d.nätverk : [])) {
      if (!r || typeof r.från !== 'string' || typeof r.till !== 'string' || !r.från || !r.till || r.från === r.till) continue;
      const antal = Number(r.antal);
      if (!(antal > 0) || !Number.isFinite(antal)) continue;
      const nyckel = r.från + SKILJE + r.till;
      const finns = sammanslagna.get(nyckel);
      if (finns) finns.antal += antal; else sammanslagna.set(nyckel, { från: r.från, till: r.till, antal });
    }

    const noder = [], perTeam = new Map();
    const nod = (team, k) => {
      let n = perTeam.get(team);
      if (n) return n;
      const h = k && typeof k.händelser === 'number' && Number.isFinite(k.händelser) ? k.händelser : (pulsAntal.get(team) || 0);
      n = {
        team, k: k || null, utan: !k, ledning: !!(k && k.ledning),
        namn: k && typeof k.namn === 'string' && k.namn.trim() ? k.namn.trim() : team,
        handelser: Math.max(0, h), fatt: 0, gett: 0, kanter: [], grannar: new Set(),
        farg: k ? api.färg(team) : 'var(--dim)',   // avsändare utan kvarter har ingen egen färg i paletten: neutral grå
        el: null, x: 0, y: 0, r: 4,
      };
      perTeam.set(team, n); noder.push(n);
      return n;
    };
    for (const k of kvarter) nod(k.team, k);

    // Avsändare som finns i nätverket men inte har något kvarter: sist på cirkeln, störst först.
    const lösa = new Map();
    for (const r of sammanslagna.values()) for (const t of [r.från, r.till]) if (!perTeam.has(t)) lösa.set(t, (lösa.get(t) || 0) + r.antal);
    for (const [t] of [...lösa.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) nod(t, null);

    const kanter = [], kantPer = new Map();
    let total = 0, aMax = 0;
    for (const r of sammanslagna.values()) {
      const e = { a: perTeam.get(r.från), b: perTeam.get(r.till), antal: r.antal, el: null, li: null };
      e.a.fatt += r.antal; e.b.gett += r.antal;
      e.a.kanter.push(e); e.b.kanter.push(e);
      e.a.grannar.add(e.b); e.b.grannar.add(e.a);
      kanter.push(e); kantPer.set(r.från + SKILJE + r.till, e);
      total += r.antal; if (r.antal > aMax) aMax = r.antal;
    }
    kanter.sort((p, q) => q.antal - p.antal || (p.a.team < q.a.team ? -1 : p.a.team > q.a.team ? 1 : 0) || (p.b.team < q.b.team ? -1 : 1));
    kanter.forEach((e, i) => { e.i = i; });
    for (const n of noder) {
      n.kanter.sort((p, q) => q.antal - p.antal);
      // Kvarterens egna fält är samma tal som resten av sidan visar. De stämmer med summan av bågarna.
      if (n.k && typeof n.k.fått === 'number') n.fatt = n.k.fått;
      if (n.k && typeof n.k.gett === 'number') n.gett = n.k.gett;
    }

    let ordnad = kvarter.length > 1;
    for (let i = 1; i < kvarter.length && ordnad; i++) {
      const p = kvarter[i - 1].live, q = kvarter[i].live;
      if (typeof p !== 'number' || typeof q !== 'number' || q < p) ordnad = false;
    }
    let hMax = 0;
    for (const n of noder) if (n.handelser > hMax) hMax = n.handelser;
    return { noder, kanter, perTeam, kantPer, total, aMax, hMax, egna, ordnad, antalKvarter: kvarter.length, antalLösa: lösa.size };
  }

  H.sektioner.natverk = {
    titel: 'Vem reagerade på vem',
    meny: 'Nätverket',
    ingang: 'Varje gång ett kvarter reagerade på en händelse från ett annat uppstod en tråd mellan dem. Här är alla trådar på en gång: bågen går från den som orsakade till den som reagerade.',

    rendera(el, data, api) {
      stil();
      const m = forbered(data, api);
      const rot = api.el('div', { class: 'h-natverk' });
      el.append(rot);
      if (!m.kanter.length) {
        rot.append(api.el('p', { class: 'dim', text: 'Loggen innehåller inga reaktioner mellan kvarter, så det finns inget nätverk att rita.' }));
        return;
      }

      const ganger = n => (n === 1 ? '1 gång' : api.tal(n) + ' gånger');
      const handelser = n => (n === 1 ? '1 händelse' : api.tal(n) + ' händelser');
      const RAKNEORD = ['noll', 'en', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio'];
      const rakneord = n => RAKNEORD[n] || api.tal(n);
      const fullt = n => (n.namn.toLowerCase() !== n.team.toLowerCase() ? n.namn + ' (' + n.team + ')' : n.namn);
      const prick = n => {
        const p = api.el('span', { class: 'h-natverk-prick' + (n.ledning ? ' h-natverk-ihalig' : ''), 'aria-hidden': 'true' });
        p.style.borderColor = n.farg;
        if (!n.ledning) p.style.background = n.farg;
        return p;
      };
      const stycke = (klass, delar) => {   // strängar blir text, ['b', text] blir fetstil. Aldrig innerHTML.
        const p = api.el('p', { class: klass });
        for (const del of delar) p.append(Array.isArray(del) ? api.el('b', { text: del[1] }) : document.createTextNode(del));
        return p;
      };

      // ---- Det mest slående mönstret, i två meningar med tal ur datat ----
      let par = null;
      for (const e of m.kanter) {
        const om = m.kantPer.get(e.b.team + SKILJE + e.a.team);
        if (!om || om.antal > e.antal || (om.antal === e.antal && om.i < e.i)) continue;
        if (!par || e.antal + om.antal > par.summa) par = { e, om, summa: e.antal + om.antal };
      }
      const procent = (del) => Math.round(del / m.total * 100);
      // "Spiral" sägs bara när båda riktningarna är stora (den svagare minst hälften av den starkare) och paret är dagens
      // starkaste. Annars beskrivs den starkaste bågen som den är.
      if (par && par.summa >= m.kanter[0].antal && par.om.antal * 2 >= par.e.antal) {
        let näst = 0;
        for (const e of m.kanter) if (e !== par.e && e !== par.om && e.antal > näst) näst = e.antal;
        const mening2 = ['Tillsammans är det ', ['b', api.tal(par.summa)], ' av de ', ['b', api.tal(m.total)], ' gånger någon reagerade på någon annan under dagen, ungefär ' + procent(par.summa) + ' procent'];
        if (näst > 0) mening2.push(', och ingen annan relation kommer över ', ['b', api.tal(näst)]);
        mening2.push('.');
        rot.append(stycke('h-natverk-slutsats', [
          fullt(par.e.a) + ' och ' + fullt(par.e.b) + ' fastnade i en spiral: ' + par.e.b.namn + ' reagerade ', ['b', ganger(par.e.antal)], ' på ' + par.e.a.namn + ', och ' + par.e.a.namn + ' reagerade ', ['b', ganger(par.om.antal)], ' tillbaka. ',
        ].concat(mening2)));
      } else {
        const e = m.kanter[0];
        rot.append(stycke('h-natverk-slutsats', [
          'Den starkaste relationen går från ' + fullt(e.a) + ' till ' + fullt(e.b) + ': ', ['b', ganger(e.antal)], ' reagerade ' + e.b.namn + ' på ' + e.a.namn + '. ',
          'Det är ungefär ' + procent(e.antal) + ' procent av de ', ['b', api.tal(m.total)], ' gånger någon reagerade på någon annan under dagen.',
        ]));
      }

      // ---- Diagram, ruta och förklaring ----
      const rad = api.el('div', { class: 'h-natverk-rad' });
      const yta = api.el('div', { class: 'h-natverk-yta' });
      const svg = s('svg', { role: 'group', 'aria-label': 'Nätverksdiagram över vilka kvarter som reagerade på varandra. Samma uppgifter finns som lista och tabell längre ned.' });
      yta.append(svg);
      const panel = api.el('div', { class: 'kort h-natverk-panel', 'aria-live': 'polite' });
      const forklaring = api.el('div', { class: 'h-natverk-forklaring' });
      rad.append(yta, panel, forklaring);
      rot.append(rad);

      let hover = null, fast = null, senasteBredd = -1, väntar = false, panelNyckel = null;
      const aktuell = () => hover || (fast ? { typ: 'nod', team: fast } : null);

      function markera() {
        const v = aktuell();
        const vn = v && v.typ === 'nod' ? m.perTeam.get(v.team) || null : null;
        const vk = v && v.typ === 'kant' ? m.kanter[v.i] || null : null;
        svg.classList.toggle('h-natverk-aktiv', !!(vn || vk));
        for (const e of m.kanter) {
          const pa = !!((vn && (e.a === vn || e.b === vn)) || (vk && e === vk));
          if (e.el) e.el.classList.toggle('h-natverk-pa', pa);
          if (e.li) e.li.classList.toggle('h-natverk-pa', !!(vk && e === vk));
        }
        for (const n of m.noder) {
          if (!n.el) continue;
          const pa = vn ? (n === vn || vn.grannar.has(n)) : vk ? (n === vk.a || n === vk.b) : false;
          n.el.classList.toggle('h-natverk-pa', pa);
          n.el.classList.toggle('h-natverk-vald', !!vn && n === vn);
          n.el.setAttribute('aria-pressed', fast === n.team ? 'true' : 'false');
        }
      }

      function faktarad(dl, etikett, varde) {
        dl.append(api.el('div', {}, [api.el('dt', { text: etikett }), api.el('dd', { text: varde })]));
      }

      function ritaPanel() {
        const v = aktuell();
        // Rutans innehåll beror bara på vad som är markerat och vad som är fäst. Ritas den om med exakt samma innehåll
        // läser en skärmläsare upp den en gång till (aria-live), och en "Släpp"-knapp som just tagit emot tangentbords-
        // fokus byts ut mitt i steget, så att fokus tappas. Därför görs ingenting när läget är oförändrat.
        const nyckel = (v ? v.typ + SKILJE + (v.typ === 'nod' ? v.team : v.i) : '-') + SKILJE + (fast || '');
        if (nyckel === panelNyckel) return;
        panelNyckel = nyckel;
        panel.textContent = '';
        const vn = v && v.typ === 'nod' ? m.perTeam.get(v.team) || null : null;
        const vk = v && v.typ === 'kant' ? m.kanter[v.i] || null : null;

        if (vn) {
          const n = vn, vad = n.utan ? 'avsändaren' : 'kvarteret';
          panel.append(api.el('div', { class: 'h-natverk-ptitel' }, [prick(n), api.el('span', { text: n.namn })]));
          const chips = api.el('div', { class: 'h-natverk-chips' });
          chips.append(api.el('span', { class: 'chip', text: (n.utan ? 'avsändare ' : 'team ') + n.team }));
          chips.append(api.el('span', { class: 'chip', text: n.utan ? 'utan eget kvarter' : n.ledning ? 'byggt av workshopledningen' : 'deltagarteam' }));
          panel.append(chips);
          const dl = api.el('dl', { class: 'h-natverk-fakta' });
          faktarad(dl, 'Händelser postade på Stadens puls', api.tal(n.handelser));
          faktarad(dl, 'Fått: gånger andra reagerade på ' + vad, api.tal(n.fatt));
          faktarad(dl, 'Gett: gånger ' + vad + ' reagerade på andra', api.tal(n.gett));
          panel.append(dl);
          if (n.kanter.length) {
            panel.append(api.el('div', { class: 'h-natverk-punderrubrik', text: n.kanter.length > 3 ? 'De tre starkaste relationerna' : 'Relationerna' }));
            const ol = api.el('ol', { class: 'h-natverk-starkast' });
            for (const e of n.kanter.slice(0, 3)) {
              ol.append(api.el('li', {}, [
                api.el('span', { class: 'chip', text: e.a === n ? 'fått' : 'gett' }),
                api.el('span', { text: e.b.namn + ' reagerade ' + ganger(e.antal) + ' på ' + e.a.namn + '.' }),
              ]));
            }
            panel.append(ol);
            const resten = n.kanter.length - 3;
            if (resten > 0) panel.append(api.el('p', { class: 'h-natverk-tips', text: 'Därtill ' + (resten === 1 ? 'en svagare relation' : api.tal(resten) + ' svagare relationer') + '. Alla står i tabellen längst ned.' }));
          } else {
            panel.append(api.el('p', { class: 'h-natverk-ptext', text: 'Ingen reagerade på ' + n.namn + ', och ' + n.namn + ' reagerade inte på någon annan. Därför går inga bågar hit.' }));
          }
          if (fast === n.team) {
            const knapp = api.el('button', { class: 'h-natverk-slapp', type: 'button', text: 'Släpp' });
            knapp.addEventListener('click', () => { fast = null; hover = null; visa(); });
            panel.append(knapp);
          } else {
            panel.append(api.el('p', { class: 'h-natverk-tips', text: 'Tryck på cirkeln för att hålla kvar markeringen.' }));
          }
          return;
        }

        if (vk) {
          const e = vk, om = m.kantPer.get(e.b.team + SKILJE + e.a.team);
          panel.append(api.el('div', { class: 'h-natverk-ptitel' }, [prick(e.a), api.el('span', { text: fullt(e.a) + ' → ' + fullt(e.b) })]));
          panel.append(api.el('p', { class: 'h-natverk-ptext', text: ganger(e.antal) + ' reagerade ' + e.b.namn + ' på ' + e.a.namn + '.' }));
          panel.append(api.el('p', { class: 'h-natverk-ptext dim', text: om
            ? 'Åt andra hållet reagerade ' + e.a.namn + ' ' + ganger(om.antal) + ' på ' + e.b.namn + '.'
            : 'Åt andra hållet finns ingen reaktion i loggen: ' + e.a.namn + ' reagerade aldrig på ' + e.b.namn + '.' }));
          return;
        }

        panel.append(api.el('div', { class: 'h-natverk-ptitel' }, [api.el('span', { text: 'Peka på ett kvarter' })]));
        panel.append(api.el('p', { class: 'h-natverk-ptext', text: 'Håll muspekaren över ett kvarter i diagrammet, eller tryck på det. Då lyfts dess bågar fram, och här visas hur många händelser det postade, hur ofta andra reagerade på det och vilka det hade mest med att göra.' }));
        const dl = api.el('dl', { class: 'h-natverk-fakta' });
        faktarad(dl, 'Kvarter i diagrammet', api.tal(m.antalKvarter));
        if (m.antalLösa > 0) faktarad(dl, 'Avsändare i diagrammet utan eget kvarter', api.tal(m.antalLösa));
        faktarad(dl, 'Relationer (bågar)', api.tal(m.kanter.length));
        faktarad(dl, 'Reaktioner på någon annan', api.tal(m.total));
        panel.append(dl);
      }

      function visa() { markera(); ritaPanel(); }
      function satt(v) {
        const samma = (!v && !hover) || (v && hover && v.typ === hover.typ && v.team === hover.team && v.i === hover.i);
        if (samma) return;
        hover = v; visa();
      }

      // ---- Själva ritningen. Görs om när bredden ändras, så att texten alltid är i läsbar storlek. ----
      function layout() {
        const uppmatt = Math.floor(yta.clientWidth || 0);
        senasteBredd = uppmatt;
        const W = Math.max(280, Math.min(760, uppmatt || 640));
        const niva = W < 480 ? 0 : W < 640 ? 1 : 2;   // 0: bara kvartersnamn, 1: plus team, 2: plus "ledningen"
        const fs = [10.5, 11.5, 12.5][niva], fs2 = fs - 2, lh = Math.round(fs * 12.4) / 10;
        const rMin = 4, rMax = [9, 14, 20][niva];
        const wMin = [1.4, 1.6, 1.8][niva], wMax = [9, 13, 18][niva];
        const radie = h => (h > 0 && m.hMax > 0 ? Math.max(rMin, rMax * Math.sqrt(h / m.hMax)) : rMin);
        const tjocklek = a => (m.aMax > 0 ? Math.max(wMin, wMax * Math.sqrt(a / m.aMax)) : wMin);

        let fokusTeam = null;
        try { const ae = document.activeElement; if (ae && svg.contains(ae) && ae.getAttribute) fokusTeam = ae.getAttribute('data-team'); } catch (e) { /* ingen fokus att återställa */ }
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        svg.setAttribute('width', W); svg.setAttribute('height', W); svg.setAttribute('viewBox', (-W / 2) + ' ' + (-W / 2) + ' ' + W + ' ' + W);
        const bakgrund = s('rect', { class: 'h-natverk-bakgrund' });
        const gKanter = s('g', { 'aria-hidden': 'true' }), gNoder = s('g');
        svg.append(bakgrund, gKanter, gNoder);

        // 1. Noder och etiketter skapas först, så att etiketternas verkliga bredd kan mätas.
        const N = m.noder.length, nH = Math.ceil(N / 2), nV = N - nH;
        m.noder.forEach((n, i) => {
          n.hoger = i < nH;
          const j = i - nH;
          n.andel = n.hoger ? (nH > 1 ? -SPANN + 2 * SPANN * i / (nH - 1) : 0) : (nV > 1 ? SPANN - 2 * SPANN * j / (nV - 1) : 0);
          n.r = radie(n.handelser);
          const g = s('g', { class: 'h-natverk-nod', tabindex: '0', role: 'button', 'data-team': n.team, 'aria-pressed': 'false' });
          g.setAttribute('aria-label', fullt(n) + (n.utan ? ', avsändare utan eget kvarter' : n.ledning ? ', byggt av workshopledningen' : '') + ': ' +
            handelser(n.handelser) + ', andra reagerade ' + ganger(n.fatt) + ' på ' + (n.utan ? 'avsändaren' : 'kvarteret') + ', som reagerade ' + ganger(n.gett) + ' på andra.');
          n.traff = s('rect', { class: 'h-natverk-traff' });
          g.append(n.traff, s('circle', { class: 'h-natverk-ring', r: f1(n.r + 3.5) }), s('circle', { class: 'h-natverk-bas', r: f1(n.r + 2) }));
          const punkt = s('circle', { r: f1(n.ledning ? Math.max(1.5, n.r - 1) : n.r) });
          if (n.ledning) { punkt.style.fill = 'var(--bg)'; punkt.style.stroke = n.farg; punkt.style.strokeWidth = '2'; } else punkt.style.fill = n.farg;
          g.append(punkt);

          const rader = brytNamn(n.namn, niva === 0 ? 11 : 16).map(t => ({ t: kapa(t, 28), team: false }));
          if (niva > 0) {
            const delar = [];
            if (n.namn.toLowerCase() !== n.team.toLowerCase()) delar.push(n.team);
            if (niva > 1 || !delar.length) { if (n.ledning) delar.push('ledningen'); else if (n.utan) delar.push('utan kvarter'); }
            if (delar.length) rader.push({ t: kapa(delar.join(' · '), 32), team: true });
          }
          const tx = f1((n.hoger ? 1 : -1) * (n.r + GLAPP)), y0 = -((rader.length - 1) * lh) / 2 + fs * 0.34;
          const text = s('text', { class: 'h-natverk-etikett', 'text-anchor': n.hoger ? 'start' : 'end', 'font-size': fs, x: tx, 'aria-hidden': 'true' });
          let uppskattad = 0;
          rader.forEach((rd, k) => {
            const ts = s('tspan', { x: tx, y: f1(y0 + k * lh) });
            if (rd.team) { ts.setAttribute('class', 'h-natverk-team'); ts.setAttribute('font-size', fs2); }
            ts.textContent = rd.t;
            text.append(ts);
            uppskattad = Math.max(uppskattad, rd.t.length * (rd.team ? fs2 * 0.62 : fs * 0.6));
          });
          g.append(text);
          gNoder.append(g);
          n.el = g; n.hojd = rader.length * lh;
          let bredd = 0;
          try { bredd = text.getBBox().width; } catch (e) { bredd = 0; }
          n.lw = (bredd > 0 && Number.isFinite(bredd) ? bredd : uppskattad) + 3;   // tre pixlar i marginal mot kanten
        });

        // 2. Ovalens mått: så bred som etiketterna tillåter, och minst så hög att inga etiketter eller cirklar krockar.
        //    Ovalen behöver inte stå mitt i bilden. Har ena sidan kortare namn flyttas mitten (cx) ditåt, så att ovalen
        //    blir så bred som möjligt. Det gör mest nytta på smala skärmar, där namnen tar det mesta av bredden.
        const sidor = [m.noder.filter(n => n.hoger), m.noder.filter(n => !n.hoger)];
        const behov = n => n.r + GLAPP + n.lw, halvkorda = n => Math.sqrt(Math.max(0, 1 - n.andel * n.andel));
        let ax = 270;
        for (const p of sidor[0]) {
          if (!sidor[1].length) ax = Math.min(ax, (W / 2 - 2 - behov(p)) / (halvkorda(p) || 1));
          for (const q of sidor[1]) ax = Math.min(ax, (W - 4 - behov(p) - behov(q)) / ((halvkorda(p) + halvkorda(q)) || 1));
        }
        ax = Math.max(40, ax);
        let cxMin = -Infinity, cxMax = Infinity;
        for (const p of sidor[0]) cxMax = Math.min(cxMax, W / 2 - 2 - behov(p) - ax * halvkorda(p));
        for (const q of sidor[1]) cxMin = Math.max(cxMin, -W / 2 + 2 + behov(q) + ax * halvkorda(q));
        // Ryms ovalen mitt i bilden får den stå där. Ryms den inte alls (mycket smal yta) delas bristen lika på båda sidor.
        let cx = cxMin <= cxMax ? Math.max(cxMin, Math.min(cxMax, 0)) : (cxMin + cxMax) / 2;
        if (!Number.isFinite(cx)) cx = 0;
        let steg = 0;
        for (const sida of sidor) {
          for (let i = 1; i < sida.length; i++) {
            const p = sida[i - 1], q = sida[i];
            steg = Math.max(steg, (p.hojd + q.hojd) / 2 + 4, p.r + q.r + 5, p.hojd / 2 + q.r + 3, q.hojd / 2 + p.r + 3);
          }
        }
        const flest = Math.max(sidor[0].length, sidor[1].length);
        const ay = Math.max(ax, flest > 1 ? steg * (flest - 1) / (2 * SPANN) : 0);
        let yMin = Infinity, yMax = -Infinity;
        for (const n of m.noder) {
          n.y = n.andel * ay;
          n.x = cx + (n.hoger ? 1 : -1) * ax * halvkorda(n);
          n.el.setAttribute('transform', 'translate(' + f1(n.x) + ',' + f1(n.y) + ')');
          const halv = Math.max(n.r + 5, n.hojd / 2 + 3);
          yMin = Math.min(yMin, n.y - halv); yMax = Math.max(yMax, n.y + halv);
          // Träffytan täcker cirkel och etikett, minst 24 px hög men aldrig in på grannens rad.
          const th = Math.max(n.r + 2, Math.min(Math.max(n.hojd / 2 + 3, 12), steg > 0 ? steg / 2 : 12));
          const tb = n.r + 4 + n.r + GLAPP + n.lw + 2;
          n.traff.setAttribute('x', f1(n.hoger ? -(n.r + 4) : -(n.r + GLAPP + n.lw + 2)));
          n.traff.setAttribute('y', f1(-th)); n.traff.setAttribute('width', f1(tb)); n.traff.setAttribute('height', f1(th * 2));
        }
        yMin -= 5; yMax += 5;
        const Hh = Math.max(60, yMax - yMin);
        svg.setAttribute('height', f1(Hh));
        svg.setAttribute('viewBox', f1(-W / 2) + ' ' + f1(yMin) + ' ' + W + ' ' + f1(Hh));
        bakgrund.setAttribute('x', f1(-W / 2)); bakgrund.setAttribute('y', f1(yMin)); bakgrund.setAttribute('width', W); bakgrund.setAttribute('height', f1(Hh));

        // 3. Bågarna: en kvadratisk kurva som dras in mot mitten, ritad som en kil. De två riktningarna mellan samma par
        //    buktar åt var sitt håll, så att de syns som en lins i stället för att ligga på varandra.
        const skala = ax + ay;
        for (const e of m.kanter) {   // störst först, så att tunna bågar hamnar överst
          const a = e.a, b = e.b, dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
          e.el = null;
          if (!(dist > 0)) continue;
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, nx = -dy / dist, ny = dx / dist;
          const drag = 0.3 + 0.45 * Math.min(1, dist / skala);
          const px = cx + (mx - cx) * (1 - drag) + nx * dist * 0.11, py = my * (1 - drag) + ny * dist * 0.11;   // ovalens mitt är (cx, 0)
          const pos = t => { const u = 1 - t; return [u * u * a.x + 2 * u * t * px + t * t * b.x, u * u * a.y + 2 * u * t * py + t * t * b.y]; };
          let t1 = 1;   // spetsen stannar strax utanför mottagarens cirkel, så att riktningen syns
          for (let t = 0.99; t > 0.5; t -= 0.01) { const p = pos(t); if (Math.hypot(p[0] - b.x, p[1] - b.y) >= b.r + 3.5) { t1 = t; break; } }
          const w = tjocklek(e.antal), STEG = 26, fram = [], bak = [];
          for (let i = 0; i <= STEG; i++) {
            const sAndel = i / STEG, t = t1 * sAndel, p = pos(t);
            let tx = 2 * (1 - t) * (px - a.x) + 2 * t * (b.x - px), ty = 2 * (1 - t) * (py - a.y) + 2 * t * (b.y - py);
            const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
            const hw = (w / 2) * (1 - sAndel) + 0.35 * sAndel;
            fram.push(f1(p[0] - ty * hw) + ',' + f1(p[1] + tx * hw));
            bak.push(f1(p[0] + ty * hw) + ',' + f1(p[1] - tx * hw));
          }
          const bana = s('path', { class: 'h-natverk-kant', 'data-i': e.i, d: 'M' + fram.join('L') + 'L' + bak.reverse().join('L') + 'Z' });
          bana.style.fill = a.farg;
          const titel = s('title'); titel.textContent = fullt(a) + ' → ' + fullt(b) + ': ' + ganger(e.antal);
          bana.append(titel);
          gKanter.append(bana);
          e.el = bana;
        }

        ritaForklaring(tjocklek, radie, wMin, rMin);
        markera();
        if (fokusTeam) { const n = m.perTeam.get(fokusTeam); if (n && n.el && n.el.focus) { try { n.el.focus({ preventScroll: true }); } catch (e) { /* utan fokus går det också */ } } }
      }

      // Provvärden till förklaringen: det största talet, plus ett eller två jämna tal under det. Värden som är så små att
      // de ritas med minsta storlek tas inte med, för då hade provet visat fel skala.
      const provvarden = (max, matt, golv) => {
        const jamna = [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000].filter(x => x < max * 0.7 && matt(x) > golv + 0.05);
        const ut = [];
        if (jamna.length) {
          const stor = jamna[jamna.length - 1], liten = jamna.filter(x => x * 5 <= stor).pop();
          if (liten) ut.push(liten);
          ut.push(stor);
        }
        ut.push(max);
        return ut;
      };

      function ritaForklaring(tjocklek, radie, wMin, rMin) {
        forklaring.textContent = '';
        const g1 = api.el('div', { class: 'h-natverk-fgrupp' }, [api.el('span', { class: 'h-natverk-fetikett', text: 'Bågens bredd: antal reaktioner' })]);
        for (const v of provvarden(m.aMax, tjocklek, wMin)) {
          const w = tjocklek(v), hh = Math.max(w, 4) + 2;
          const bild = s('svg', { width: 58, height: f1(hh), viewBox: '0 ' + f1(-hh / 2) + ' 58 ' + f1(hh), 'aria-hidden': 'true' });
          const kil = s('path', { d: 'M1,' + f1(-w / 2) + 'L57,-0.35L57,0.35L1,' + f1(w / 2) + 'Z' });
          kil.style.fill = 'var(--dim)';
          bild.append(kil);
          g1.append(api.el('span', { class: 'h-natverk-prov' }, [bild, api.el('span', { text: api.tal(v) })]));
        }
        const g2 = api.el('div', { class: 'h-natverk-fgrupp' }, [api.el('span', { class: 'h-natverk-fetikett', text: 'Cirkelns yta: antal händelser postade' })]);
        for (const v of (m.hMax > 0 ? provvarden(m.hMax, radie, rMin) : [])) {
          const r = radie(v), d = Math.ceil(r * 2 + 2);
          const bild = s('svg', { width: d, height: d, viewBox: f1(-d / 2) + ' ' + f1(-d / 2) + ' ' + d + ' ' + d, 'aria-hidden': 'true' });
          const c = s('circle', { r: f1(r) }); c.style.fill = 'var(--dim)';
          bild.append(c);
          g2.append(api.el('span', { class: 'h-natverk-prov' }, [bild, api.el('span', { text: api.tal(v) })]));
        }
        const g3 = api.el('div', { class: 'h-natverk-fgrupp' }, [api.el('span', { class: 'h-natverk-fetikett', text: 'Cirkelns sort' })]);
        const sort = (slag, text) => {
          const bild = s('svg', { width: 14, height: 14, viewBox: '-7 -7 14 14', 'aria-hidden': 'true' });
          const c = s('circle', { r: slag === 'ihalig' ? 4.5 : 5.5 });
          if (slag === 'ihalig') { c.style.fill = 'var(--bg)'; c.style.stroke = 'var(--accent)'; c.style.strokeWidth = '2'; } else c.style.fill = slag === 'gra' ? 'var(--dim)' : 'var(--accent)';
          bild.append(c);
          g3.append(api.el('span', { class: 'h-natverk-prov' }, [bild, api.el('span', { text })]));
        };
        if (m.noder.some(n => !n.ledning && !n.utan)) sort('fylld', 'deltagarteam, i teamets färg');
        if (m.noder.some(n => n.ledning)) sort('ihalig', 'byggt av workshopledningen');
        if (m.noder.some(n => n.utan)) sort('gra', 'avsändare utan eget kvarter');
        forklaring.append(g1);
        if (m.hMax > 0) forklaring.append(g2);
        forklaring.append(g3);
        forklaring.append(api.el('p', { text: 'Bågen är bred hos den som orsakade händelsen och smalnar av till en spets hos den som reagerade. Färgen är orsakarens. Bredden följer kvadratroten av antalet, annars hade de största bågarna dränkt alla andra. De allra minsta bågarna och cirklarna ritas med en minsta storlek, annars hade de inte synts. Listan nedan visar talen i rät skala.' }));
        if (m.ordnad) forklaring.append(api.el('p', { text: 'Kvarteren står medsols i den ordning de kom till liv, med början högst upp till höger.' + (m.antalLösa > 0 ? ' Sist, uppe till vänster, står de avsändare som inte har något eget kvarter.' : '') }));
      }

      // ---- Händelser: delegerade, eftersom ritningen görs om vid storleksändring ----
      const hittaNod = mål => (mål && mål.closest ? mål.closest('.h-natverk-nod') : null);
      const hittaKant = mål => (mål && mål.closest ? mål.closest('.h-natverk-kant') : null);
      const vaxla = team => { if (!team) return; if (fast === team) { fast = null; hover = null; } else fast = team; visa(); };
      svg.addEventListener('pointerover', ev => {
        // Ett finger har ingen hovring. Utan den här spärren blinkar rutan till (och sidan under den hoppar) varje gång
        // någon börjar skrolla med fingret på diagrammet. På pekskärm är det trycket, alltså click, som markerar.
        if (ev.pointerType === 'touch') return;
        const g = hittaNod(ev.target);
        if (g) { satt({ typ: 'nod', team: g.getAttribute('data-team') }); return; }
        const k = hittaKant(ev.target);
        if (k) {
          // Är ett kvarter fäst svarar bara dess egna bågar, så att markeringen inte hoppar när pekaren korsar diagrammet.
          const i = Number(k.getAttribute('data-i')), e = m.kanter[i];
          if (e && (!fast || e.a.team === fast || e.b.team === fast)) { satt({ typ: 'kant', i }); return; }
        }
        satt(null);
      });
      svg.addEventListener('pointerleave', () => satt(null));
      svg.addEventListener('click', ev => {
        const g = hittaNod(ev.target);
        if (g) { vaxla(g.getAttribute('data-team')); return; }
        if (!hittaKant(ev.target) && fast) { fast = null; hover = null; visa(); }
      });
      svg.addEventListener('focusin', ev => {
        const g = hittaNod(ev.target);
        if (!g) return;
        let synlig = true;
        try { synlig = g.matches(':focus-visible'); } catch (e) { synlig = true; }
        if (synlig) satt({ typ: 'nod', team: g.getAttribute('data-team') });
      });
      svg.addEventListener('focusout', () => satt(null));
      svg.addEventListener('keydown', ev => {
        const g = hittaNod(ev.target);
        if (!g) return;
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); vaxla(g.getAttribute('data-team')); }
        else if (ev.key === 'Escape' && (fast || hover)) { fast = null; hover = null; visa(); }
      });

      // ---- De starkaste relationerna som meningar, med staplar i rät skala ----
      const topp = m.kanter.slice(0, 10);
      rot.append(api.el('h3', { class: 'h-natverk-h3', text: topp.length === 1 ? 'Den starkaste relationen' : 'De ' + rakneord(topp.length) + ' starkaste relationerna' }));
      rot.append(api.el('p', { class: 'h-natverk-h3under', text: 'Samma sak i ord, för den som hellre läser än tyder bågar. Pilen går från den som orsakade till den som reagerade, och staplarna är i rät skala.' }));
      const lista = api.el('ol', { class: 'h-natverk-topp' });
      lista.style.setProperty('--h-natverk-rader', String(Math.max(1, Math.ceil(topp.length / 2))));
      topp.forEach((e, i) => {
        const stapel = api.el('div', { class: 'h-natverk-stapel' });
        stapel.style.width = Math.max(0.5, e.antal / m.aMax * 100).toFixed(1) + '%';
        stapel.style.background = e.a.farg;
        const li = api.el('li', { class: 'h-natverk-rel' }, [
          api.el('span', { class: 'h-natverk-rang', text: (i + 1) + '.' }),
          api.el('div', {}, [
            api.el('div', { class: 'h-natverk-relhuvud' }, [prick(e.a), api.el('span', { text: fullt(e.a) + ' → ' + fullt(e.b) })]),
            api.el('div', { class: 'h-natverk-stapelrad' }, [api.el('div', {}, [stapel]), api.el('span', { class: 'h-natverk-varde', text: api.tal(e.antal) })]),
            api.el('div', { class: 'h-natverk-mening', text: ganger(e.antal) + ' reagerade ' + e.b.namn + ' på ' + e.a.namn + '.' }),
          ]),
        ]);
        li.addEventListener('pointerenter', ev => { if (ev.pointerType !== 'touch') satt({ typ: 'kant', i: e.i }); });
        li.addEventListener('pointerleave', () => satt(null));
        e.li = li;
        lista.append(li);
      });
      rot.append(lista);

      // ---- Tabellvy: varenda relation ----
      const alla = api.el('details', { class: 'h-natverk-alla' }, [api.el('summary', { text: m.kanter.length === 1 ? 'Visa den enda relationen som tabell' : 'Visa alla ' + api.tal(m.kanter.length) + ' relationer som tabell' })]);
      const tabell = api.el('table', { class: 'h-natverk-tabell' });
      tabell.append(api.el('caption', { text: 'En rad per båge i diagrammet, störst först.' }));
      tabell.append(api.el('thead', {}, [api.el('tr', {}, [
        api.el('th', { scope: 'col', text: 'Orsakade' }), api.el('th', { scope: 'col', text: 'Reagerade' }), api.el('th', { scope: 'col', class: 'h-natverk-num', text: 'Gånger' }),
      ])]));
      const tb = api.el('tbody');
      for (const e of m.kanter) tb.append(api.el('tr', {}, [api.el('td', { text: fullt(e.a) }), api.el('td', { text: fullt(e.b) }), api.el('td', { class: 'h-natverk-num', text: api.tal(e.antal) })]));
      tabell.append(tb);
      alla.append(api.el('div', { class: 'h-natverk-tabellyta' }, [tabell]));
      rot.append(alla);

      if (m.egna > 0) {
        // Sidans topp räknar alla reaktioner i kedja (data.tal.i_kedja). Skillnaden förklaras bara om talen faktiskt går ihop.
        const hela = data && data.tal ? data.tal.i_kedja : null;
        rot.append(api.el('p', { class: 'h-natverk-fot', text: 'Här räknas bara reaktioner på någon annan. De ' + api.tal(m.egna) + ' gånger någon reagerade på sin egen händelse är inte med' +
          (hela === m.total + m.egna ? ', och därför är summan här ' + api.tal(m.total) + ' och inte ' + api.tal(hela) + ' som överst på sidan.' : '.') }));
      }

      // ---- Första ritningen, och ny ritning när bredden eller typsnittet ändras ----
      ritaPanel();
      layout();
      let tvinga = false;
      const kanske = () => {
        if (väntar) return;
        väntar = true;
        const kör = () => {
          väntar = false;
          const ny = Math.floor(yta.clientWidth || 0);
          if (ny <= 0) return;   // sektionen syns inte just nu: inget att mäta mot. Nästa storleksändring försöker igen.
          if (tvinga || Math.abs(ny - senasteBredd) >= 2) { tvinga = false; layout(); }
        };
        if (window.requestAnimationFrame) window.requestAnimationFrame(kör); else setTimeout(kör, 50);
      };
      if (typeof ResizeObserver === 'function') new ResizeObserver(kanske).observe(yta);
      else window.addEventListener('resize', kanske);
      // Etiketterna mäts med det typsnitt som finns just då. När webbtypsnitten har laddats mäts de om, högst en gång per bildruta.
      const nyttTypsnitt = () => { tvinga = true; kanske(); };
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(nyttTypsnitt).catch(() => {});
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', nyttTypsnitt);
    },
  };
})();
