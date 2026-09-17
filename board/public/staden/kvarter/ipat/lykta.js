// Lyktstolpen: publiken tänder en fråga, rutan följer den genom staden.
const API = '/t/ipat';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kort = (s, n = 140) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

let nästaTid = 0;

function meddela(t, fel = false) { $('msg').textContent = t; $('msg').classList.toggle('fel', fel); }

function renderVarv(v) {
  const huvuden = v.delsvar.length
    ? `<span class="huvuden">${v.delsvar.map(d => `<span class="huvud" title="${esc(kort(d.text, 300))}">${esc(d.från)}</span>`).join('')}</span>`
    : '<span class="väntar">väntar på attention-huvuden …</span>';
  const osäker = v.svar?.osäkerhet != null ? ` <small>(osäkerhet ${esc(typeof v.svar.osäkerhet === 'number' ? v.svar.osäkerhet.toFixed(2) : v.svar.osäkerhet)})</small>` : '';
  const svar = v.svar
    ? `<span class="svar">${esc(kort(v.svar.text))}${v.svar.valt ? ` <em>· ${esc(v.svar.valt)}</em>` : ''}${osäker}</span>`
    : `<span class="väntar">${v.delsvar.length ? 'sammanfogaren väljer …' : '—'}</span>`;
  const stenar = v.kyrkogård.length
    ? `<span class="sten" title="${esc(v.kyrkogård.map(k => `${k.från ?? ''}: ${k.varför ?? ''}`).join('\n'))}">${'🪦'.repeat(Math.min(v.kyrkogård.length, 6))} ${v.kyrkogård.length} föll</span>`
    : '';
  const dom = v.dom
    ? `<span class="dom ${v.dom.utslag === 'godkänt' ? 'godkänt' : 'varv-två'}">${v.dom.utslag === 'godkänt' ? '✓ godkänt' : '↻ skickad ett varv till'} <small>${esc(v.dom.från)}</small></span>`
    : (v.svar ? '<span class="väntar">kritikern läser …</span>' : '');
  return `<div class="varv"><div class="rubrik">varv ${v.nr}</div>
    <div class="rad"><b>huvuden</b>${huvuden}</div>
    <div class="rad"><b>svar</b>${svar}</div>
    ${stenar ? `<div class="rad"><b>kyrkogård</b>${stenar}</div>` : ''}
    ${dom ? `<div class="rad"><b>kritik</b>${dom}</div>` : ''}</div>`;
}

function render(trådar) {
  const m = $('trådar');
  if (!trådar.length) { m.innerHTML = '<p class="tom">Ingen har frågat något än. Bli den första.</p>'; return; }
  m.innerHTML = trådar.map(t => `<article class="tråd">
    <div class="fråga">”${esc(kort(t.text, 200))}” <small>${esc(t.från)}</small></div>
    ${t.varv.sort((a, b) => a.nr - b.nr).map(renderVarv).join('')}
  </article>`).join('');
  const senaste = trådar[0]?.varv.at(-1);
  document.body.classList.toggle('tänker', !!senaste && !senaste.dom && Date.now() - senaste.ts < 120_000);
}

async function hämta() {
  try {
    const r = await fetch(API + '/fragor');
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    render(d.trådar);
    nästaTid = Date.now() + (d.nästa || 0);
  } catch { meddela('lyktstolpen når inte sin backend just nu', true); }
}

let väntar;
function snart() { clearTimeout(väntar); väntar = setTimeout(hämta, 400); }

function knapp() {
  const kvar = Math.ceil((nästaTid - Date.now()) / 1000);
  $('b').disabled = kvar > 0;
  $('b').textContent = kvar > 0 ? `${kvar} s` : 'Tänd';
}
setInterval(knapp, 500);

$('f').addEventListener('submit', async ev => {
  ev.preventDefault();
  const text = $('q').value.trim();
  if (text.length < 3) return meddela('skriv lite mer än så', true);
  $('b').disabled = true;
  try {
    const r = await fetch(API + '/fraga', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    const d = await r.json();
    if (!r.ok) { meddela(d.error || 'något gick fel', true); if (d.nästa) nästaTid = Date.now() + d.nästa; return; }
    $('q').value = '';
    meddela(`frågan är tänd (#${d.id}), staden tänker …`);
    nästaTid = Date.now() + 20_000;
    hämta();
  } catch { meddela('kunde inte nå staden', true); }
});

hämta();
setInterval(hämta, 15_000);
try { new EventSource('/api/stream?channel=staden-puls').onmessage = snart; } catch {}
