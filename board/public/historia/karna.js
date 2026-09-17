// Historiksidans kärna: laddar data, ger sektionerna ett gemensamt api, och ritar hero-talen.
// En sektion registrerar sig så här (i sin egen fil sektion-<namn>.js):
//   Historia.sektioner.<namn> = { titel: 'Rubrik', ingang: 'En mening under rubriken', rendera(el, data, api) { ... } };
// rendera() får ett tomt <div> att fylla. Kastar den, visas felet i sektionen och resten av sidan lever vidare.
(function () {
  const H = window.Historia = { sektioner: {}, data: null, kronika: null };
  const PALETT = ['#ffb454', '#5fd7a7', '#9d8cff', '#5ce1ff', '#ff8fa3', '#c3e88d', '#f78c6c', '#82aaff', '#e6c07b', '#56d4c0', '#d19af8', '#ff5f7a', '#9ece6a', '#7dcfff', '#e0af68', '#bb9af7', '#73daca', '#f7768e'];
  const tid = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
  const lyssnare = new Set();
  const api = {
    kl: ts => tid.format(new Date(ts)),                                   // 'HH:MM' i svensk tid
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    tal: n => Number(n || 0).toLocaleString('sv-SE'),                      // 4 159
    kvarter: team => H.data.kvarter.find(k => k.team === team) || null,
    namn: team => (api.kvarter(team) || {}).namn || team,                  // 'willebus' → 'Genomfarten'
    färg: team => { const i = H.data.kvarter.findIndex(k => k.team === team); return PALETT[(i < 0 ? 17 : i) % PALETT.length]; },
    hoppa: ts => { document.dispatchEvent(new CustomEvent('historia:hoppa', { detail: { ts } })); const r = document.getElementById('replay'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    påTid: fn => { lyssnare.add(fn); return () => lyssnare.delete(fn); }, // replay-sektionen anropar api.tick(ts) när filmen rör sig
    tick: ts => { for (const fn of lyssnare) { try { fn(ts); } catch (e) { console.error(e); } } },
    el: (tagg, attr, barn) => { const e = document.createElement(tagg); for (const [k, v] of Object.entries(attr || {})) { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v); } for (const b of [].concat(barn || [])) e.append(b); return e; },
  };
  H.api = api;

  function heroTal(t) {
    const rader = [[t.inlägg, 'inlägg på Torget'], [t.pulshändelser, 'händelser på Stadens puls'], [t.i_kedja, 'av dem var reaktioner på någon annan'], [t.pr, 'sammanfogade bidrag från ' + t.forkar + ' forkar'],
      [t.rader_kod, 'rader kod skrivna av teamens agenter'], [t.kvarter, 'kvarter i staden'], [t.händelsetyper, 'olika sorters händelser, alla påhittade under dagen'], [t.timmar.toString().replace('.', ','), 'timmar från första hej till sista händelse']];
    const el = document.getElementById('tal'); el.innerHTML = '';
    for (const [n, text] of rader) { const d = api.el('div'); d.append(api.el('b', { text: typeof n === 'number' ? api.tal(n) : n }), api.el('span', { text })); el.append(d); }
  }

  H.starta = async function (ordning) {
    const main = document.getElementById('sektioner'), meny = document.getElementById('meny');
    try {
      [H.data, H.kronika] = await Promise.all([fetch('/historia/data.json').then(r => r.json()), fetch('/historia/kronika.json').then(r => r.ok ? r.json() : null).catch(() => null)]);
    } catch (e) { main.append(api.el('p', { class: 'fel', text: 'Kunde inte läsa historiken: ' + e.message })); return; }
    heroTal(H.data.tal);
    for (const namn of ordning) {
      const s = H.sektioner[namn]; if (!s) continue;
      const sek = api.el('section', { class: 'sektion', id: namn }); sek.append(api.el('h2', { text: s.titel })); if (s.ingang) sek.append(api.el('p', { class: 'ingang', text: s.ingang }));
      const yta = api.el('div'); sek.append(yta); main.append(sek); meny.append(api.el('a', { href: '#' + namn, text: s.meny || s.titel }));
      try { await s.rendera(yta, H.data, api, H.kronika); } catch (e) { console.error(namn, e); yta.append(api.el('p', { class: 'fel', text: 'Sektionen "' + namn + '" kunde inte ritas: ' + e.message })); }
    }
    if (location.hash) { const m = document.querySelector(location.hash.replace(/[^#\wåäö-]/gi, '')); if (m) m.scrollIntoView(); }
  };
})();
