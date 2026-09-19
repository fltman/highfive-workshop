// Historiksidan, sektionen "radio": en återblick över hur staden lät.
// Allt kommer ur data.radio. Ljudet ligger kvar på servern under /ljud/.
// Spelaren härmar etern: två Audio-element, ett för rösten och ett för musiken. När ett manus spelas ligger musiken under
// på låg volym, när rösten tystnar tonas den upp. Ingenting startar av sig självt, bara en sak låter åt gången, och ljudet
// pausas om sektionen rullas ur bild eller fliken göms.
(function () {
  'use strict';
  if (!window.Historia || !window.Historia.sektioner) return;

  const STIL_ID = 'h-radio-stil';
  const CSS = `
.h-radio { display:grid; gap:20px; min-width:0; }
/* Egna display-regler nedan skulle annars slå ut webbläsarens [hidden]. */
.h-radio [hidden] { display:none !important; }

/* Studion: det som spelas just nu, förloppet, tillståndet i klartext och knapparna. */
.h-radio-studio { display:grid; gap:14px; min-width:0; padding:22px 24px 24px; position:relative; }
.h-radio-vinjett { font:600 12px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:0; }
.h-radio-nu { display:flex; align-items:flex-start; gap:12px; min-width:0; }
.h-radio-lampa { flex:0 0 auto; width:11px; height:11px; margin-top:8px; border-radius:50%; background:var(--svag); border:1px solid var(--line); }
.h-radio-studio.h-radio-pa .h-radio-lampa { background:var(--röd); border-color:var(--röd); animation:h-radio-puls 1.9s ease-in-out infinite; }
.h-radio-studio.h-radio-vilar .h-radio-lampa { background:var(--accent); border-color:var(--accent); }
@keyframes h-radio-puls { 0%, 100% { opacity:1; } 50% { opacity:.3; } }
.h-radio-nutext { min-width:0; flex:1 1 auto; }
.h-radio-sort { display:block; font:600 11px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--dim); }
.h-radio-nutitel { display:block; font:700 clamp(19px, 2.1vw, 24px)/1.25 var(--serif); margin:4px 0 0; overflow-wrap:anywhere; }
.h-radio-nuunder { display:block; font-size:14px; line-height:1.5; color:var(--dim); margin-top:5px; max-width:70ch; overflow-wrap:anywhere; }
.h-radio-spar { height:6px; border-radius:999px; background:var(--panel2); border:1px solid var(--line); overflow:hidden; }
.h-radio-fyll { display:block; height:100%; width:0; background:var(--accent); transition:width .25s linear; }
.h-radio-tider { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 14px; margin:0; font:12px var(--mono); color:var(--dim); font-variant-numeric:tabular-nums; }
.h-radio-status { margin:0; font-size:14px; line-height:1.5; color:var(--fg); overflow-wrap:anywhere; }
.h-radio-knappar { display:flex; flex-wrap:wrap; gap:10px; }
.h-radio button.knapp[disabled] { opacity:.4; cursor:default; }
.h-radio button.knapp[disabled]:hover { background:transparent; }
.h-radio button.knapp.fylld[disabled]:hover { background:var(--accent); }
.h-radio-felruta { display:grid; gap:5px; margin:0; }
.h-radio-felruta span { display:block; border-left:2px solid var(--röd); padding-left:9px; font:12px/1.5 var(--mono); color:var(--dim); overflow-wrap:anywhere; }
.h-radio-not { margin:0; font-size:13px; line-height:1.55; color:var(--dim); max-width:74ch; overflow-wrap:anywhere; }
.h-radio-not + .h-radio-not { margin-top:8px; }

/* Spellistan */
.h-radio-rubrik { font:600 12px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 10px; }
.h-radio-lista { list-style:none; margin:0; padding:0; display:grid; gap:10px; min-width:0; }
.h-radio-rad { background:var(--panel); border:1px solid var(--line); border-radius:12px; min-width:0; overflow:hidden; }
.h-radio-rad[aria-current="true"] { border-color:var(--accent); background:var(--panel2); }
.h-radio-topp { display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding:14px 16px; min-width:0; }
.h-radio-kl { flex:0 0 auto; font:600 13px var(--mono); color:var(--accent); font-variant-numeric:tabular-nums; }
.h-radio-titel { flex:1 1 220px; min-width:0; margin:0; font:600 16px/1.35 var(--sans); color:var(--fg); overflow-wrap:anywhere; }
.h-radio-meta { flex:1 1 100%; margin:0; font:12px/1.5 var(--mono); color:var(--dim); overflow-wrap:anywhere; }
.h-radio-radspar { height:3px; background:var(--line); }
.h-radio-radfyll { display:block; height:100%; width:0; background:var(--accent); transition:width .25s linear; }
.h-radio-detalj { padding:14px 16px 18px; border-top:1px solid var(--line); display:grid; gap:16px; min-width:0; }
.h-radio-manus { margin:0; font-size:15px; line-height:1.68; color:var(--fg); max-width:62ch; overflow-wrap:anywhere; white-space:pre-wrap; }
.h-radio-manusrubrik { margin:0 0 6px; font:600 11px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--dim); }

/* Hälsningar */
.h-radio-halsningar { list-style:none; margin:0; padding:0; display:grid; gap:10px; min-width:0; }
/* min() i stället för ett fast minsta mått: annars kan spalten inte krympa under 300 px och kortet spränger sidan på smal skärm. */
.h-radio-brett .h-radio-halsningar { grid-template-columns:repeat(auto-fit, minmax(min(300px, 100%), 1fr)); }
.h-radio-halsning { background:var(--panel2); border:1px solid var(--line); border-left:2px solid var(--me); border-radius:10px; padding:11px 14px 12px; min-width:0; }
.h-radio-vantar .h-radio-halsning { border-left-color:var(--lila); }
.h-radio-hhuvud { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; min-width:0; }
.h-radio-hnamn { font:600 14px/1.4 var(--sans); color:var(--fg); overflow-wrap:anywhere; }
.h-radio-htid { font:12px var(--mono); color:var(--dim); font-variant-numeric:tabular-nums; }
.h-radio-htext { margin:6px 0 0; font-size:14px; line-height:1.6; color:var(--dim); max-width:66ch; overflow-wrap:anywhere; }

/* Fakta */
.h-radio-tal { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
.h-radio-tal div { background:var(--panel); padding:16px 18px; min-width:0; }
.h-radio-tal b { display:block; font:800 28px/1.15 var(--mono); color:var(--fg); overflow-wrap:anywhere; }
.h-radio-tal span { display:block; margin-top:4px; font-size:13px; line-height:1.4; color:var(--dim); overflow-wrap:anywhere; }
.h-radio-faktatext { margin:14px 0 0; font-size:14px; line-height:1.6; color:var(--dim); max-width:74ch; overflow-wrap:anywhere; }
.h-radio-faktatext + .h-radio-faktatext { margin-top:8px; }

@media (max-width:560px) {
  .h-radio-studio { padding:18px 16px 20px; }
  .h-radio .h-radio-kort { padding:18px 16px 20px; }
  .h-radio-topp { padding:13px 13px; }
  .h-radio-detalj { padding:13px 13px 16px; }
  .h-radio-titel { flex-basis:100%; }
  .h-radio-knappar button.knapp { flex:1 1 auto; }
  .h-radio-tal b { font-size:24px; }
}
@media (prefers-reduced-motion: reduce) {
  .h-radio-fyll, .h-radio-radfyll { transition:none; }
  .h-radio-studio.h-radio-pa .h-radio-lampa { animation:none; }
}
`;

  const MUSIK_FULL = 0.75;     // samma nivåer som radiosidan använde i etern
  const MUSIK_UNDER = 0.17;
  const MIN_MUSIK_SEK = 9;     // saknas låtens längd i data: så länge räknar vi med att musikpartiet är, för tidsangivelsen
  const STILLA_GRÄNS = 15;     // sekunder utan att ljudet rör sig innan vi ger upp och går vidare
  const LADDA_GRÄNS = 45;      // ett steg som bara buffrar får längre tid än ett som står still med data i handen
  const MAX_FEL = 3;

  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const text = v => (typeof v === 'string' && v.trim()) ? v.trim() : '';
  const nu = () => (window.performance && typeof performance.now === 'function') ? performance.now() : Date.now();

  function mmss(s) {
    const n = Math.max(0, Math.floor(Number(s) || 0));
    return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  }

  // Bara egna filer under /ljud/ på den här servern. Ett värde ur data.json kommer ur Torgets innehåll, som deltagarna
  // skriver, så kravet ställs på resultatet: adressen MÅSTE hamna under /ljud/. Bakstreck räknas som snedstreck av
  // webbläsarens URL-tolkning ("/\\värd/fil" blir en annan värd), och ".." tar sig ut ur mappen, så båda avvisas.
  function ljudUrl(fil) {
    const f = text(fil);
    if (!f || f.indexOf('\\') >= 0 || f.indexOf('//') >= 0 || /^[a-z][a-z0-9+.-]*:/i.test(f)) return '';
    const p = f.charAt(0) === '/' ? f : '/ljud/' + f;
    return (p.indexOf('/ljud/') === 0 && p.split('/').indexOf('..') < 0) ? p : '';
  }

  window.Historia.sektioner.radio = {
    titel: 'Så lät staden',
    meny: 'Radio',
    ingang: 'Radio Torget sände under förmiddagen: en agent skrev manus utifrån vad som hände i staden, en röst läste upp dem och musiken låg under. Allt ljud finns kvar, så det går att lyssna igen.',

    rendera(el, data, api) {
      // Kärnan ritar varje sektion en gång, men om rendera() ändå körs om ska den förra omgångens ljud, lyssnare och
      // observatör bort först: annars pausar och tystar två uppsättningar spelare varandra.
      if (typeof el.__hRadioStäda === 'function') { try { el.__hRadioStäda(); } catch (e) { console.error('radio: städning', e); } }
      el.__hRadioStäda = null;
      el.textContent = '';
      if (!document.getElementById(STIL_ID)) {
        const stil = document.createElement('style'); stil.id = STIL_ID; stil.textContent = CSS; document.head.append(stil);
      }
      const r = (data && data.radio && typeof data.radio === 'object') ? data.radio : null;
      const sändningar = (r && Array.isArray(r.sändningar) ? r.sändningar : [])
        .filter(s => s && typeof s === 'object')
        .slice()
        .sort((a, b) => (num(a.ts) || 0) - (num(b.ts) || 0));
      const musikbibliotek = (r && Array.isArray(r.musik) ? r.musik : []).filter(m => m && typeof m === 'object' && ljudUrl(m.fil));
      const olästa = (r && Array.isArray(r.olästa_hälsningar) ? r.olästa_hälsningar : []).filter(h => h && typeof h === 'object');
      const jingel = r ? ljudUrl(r.jingel) : '';

      if (!sändningar.length && !olästa.length && !musikbibliotek.length) {
        el.append(api.el('p', { class: 'dim', text: 'Det finns inget radiomaterial i dagens data.' }));
        return;
      }

      const rot = api.el('div', { class: 'h-radio' });
      const röstnamn = (r && text(r.röst)) || text(sändningar.length && sändningar[0].röst) || '';
      const rader = [];                                   // en post per rad i spellistan, fylls längre ner

      const klAv = ts => (num(ts) === null ? '--:--' : api.kl(num(ts)));
      const slut = t => /[.!?…]$/.test(String(t || '')) ? '' : '.';   // titlar som "Roadhouse, 3 A.M." ska inte få två punkter
      const längdText = s => {
        const n = Math.round(Number(s) || 0);
        if (n <= 0) return 'okänd längd';
        const m = Math.floor(n / 60), rest = n % 60;
        const sek = api.tal(rest) + (rest === 1 ? ' sekund' : ' sekunder');
        if (!m) return sek;
        const min = api.tal(m) + (m === 1 ? ' minut' : ' minuter');
        return rest ? min + ' och ' + sek : min;
      };

      // ---------- musiken till varje sändning ----------
      // `låt` i data är musiksegmentet som postades direkt EFTER pratet, alltså låten som följde sändningen i etern.
      // Spelaren lägger den under rösten och tonar upp den efteråt, men bara den som kommer ur data får kallas så:
      // faller vi tillbaka på en bädd ur biblioteket är det spelarens eget val och inget som hände den dagen.
      const bäddar = musikbibliotek.filter(m => m.sort === 'bädd');
      const låtar = musikbibliotek.filter(m => m.sort === 'låt');
      const reserv = bäddar.length ? bäddar : (låtar.length ? låtar : musikbibliotek.filter(m => m.sort !== 'jingel'));
      // Låten börjar samtidigt som sändningen och loopar under rösten. Det som hörs i klartext efteråt är resten av
      // spåret. Saknas längden i data gissar vi lågt: tidsangivelsen blir då för kort, inte för lång.
      function restAv(m, s) {
        const låt = num(m && m.sek) || 0, tal = num(s && s.sek) || 0;
        if (!låt) return MIN_MUSIK_SEK;
        const rest = låt - (tal % låt);          // låten loopar under rösten, så resten räknas i varvet den står i
        return Math.max(1, Math.round(rest));
      }

      function musikFör(i) {
        const s = sändningar[i];
        const l = s && s.låt && typeof s.låt === 'object' ? s.låt : null;
        if (l && ljudUrl(l.fil)) return { titel: text(l.titel) || 'okänd låt', fil: ljudUrl(l.fil), sort: 'låt', efter: true, sek: num(l.sek) || 0 };
        if (!reserv.length) return null;
        const b = reserv[i % reserv.length];
        return { titel: text(b.titel) || 'okänt spår', fil: ljudUrl(b.fil), sort: b.sort === 'bädd' ? 'bädd' : 'låt', efter: false, sek: num(b.sek) || 0 };
      }

      // ---------- ljudmotorn ----------
      const röst = new Audio(), musik = new Audio();
      röst.preload = 'auto'; musik.preload = 'auto';
      let väntadRöst = '', väntadMusik = '';          // vilken url respektive element ska spela just nu
      let kö = [], köIndex = -1, aktivtSteg = null;   // aktuell spellista och var i den vi är
      let körSort = '', pausad = false, gen = 0;      // gen kasserar svar från gamla uppspelningar
      let tick = null, tickSist = 0, sistaTid = -1, stillaSedan = 0, laddatSedan = 0;
      let slutTimer = null, musikSpelar = false, felräknare = 0;
      let hoppade = 0, felIRad = 0, röstVäckt = false;   // hoppade sändningar totalt, misslyckanden i rad, och om rösten är upplåst av en gest

      function sättVol(v) { const x = Math.max(0, Math.min(1, Number(v) || 0)); try { musik.volume = x; } catch (e) { /* ignorera */ } }
      function volym() { try { return Number(musik.volume) || 0; } catch (e) { return 0; } }

      let tonId = null, tonSort = '';
      function avbrytTon() {
        if (tonId === null) return;
        if (tonSort === 'raf') cancelAnimationFrame(tonId); else clearInterval(tonId);
        tonId = null; tonSort = '';
      }
      function tona(mål, ms) {
        avbrytTon();
        const från = volym();
        if (!(ms > 0) || Math.abs(mål - från) < 0.005) { sättVol(mål); return; }
        const t0 = nu();
        const raf = typeof window.requestAnimationFrame === 'function';
        if (raf) {
          tonSort = 'raf';
          const steg = () => {
            const k = Math.min(1, (nu() - t0) / ms);
            sättVol(från + (mål - från) * k);
            if (k < 1) tonId = requestAnimationFrame(steg); else { tonId = null; tonSort = ''; }
          };
          tonId = requestAnimationFrame(steg);
        } else {
          tonSort = 'int';
          tonId = setInterval(() => {
            const k = Math.min(1, (nu() - t0) / ms);
            sättVol(från + (mål - från) * k);
            if (k >= 1) avbrytTon();
          }, 40);
        }
      }

      function felrad(txt) {
        if (felräknare >= MAX_FEL) return;
        felräknare++;
        felruta.append(api.el('span', { text: txt }));
      }

      function spela(element, vidFel) {
        const g = gen;
        try {
          const p = element.play();
          if (p && typeof p.catch === 'function') p.catch(e => {
            if (g !== gen || pausad) return;                       // vi bytte spår eller pausade: inget att rapportera
            if (e && e.name === 'AbortError') return;              // vår egen pause() avbröt uppspelningen
            if (vidFel) vidFel();
          });
        } catch (e) { if (g === gen && vidFel) vidFel(); }
      }

      // Byter musikspår bara när det behövs: samma fil som redan rullar får fortsätta, det är så det låter som radio.
      function sättMusik(m, loopa) {
        if (!m || !m.fil) { musikSpelar = false; try { musik.pause(); } catch (e) { /* ignorera */ } väntadMusik = ''; return; }
        musik.loop = !!loopa;
        const samma = musikSpelar && väntadMusik && musik.src === väntadMusik && musik.src.slice(-m.fil.length) === m.fil && !musik.ended;
        if (!samma) {
          try { musik.pause(); } catch (e) { /* ignorera */ }
          musik.src = m.fil;
          väntadMusik = musik.src;
          try { musik.currentTime = 0; } catch (e) { /* ignorera */ }
        }
        musikSpelar = true;
        spela(musik, () => { musikSpelar = false; musikFel(m); });
      }

      // Samma väg för ett avvisat play() som för ett error-event: ett steg som ÄR musik ska hoppas över, inte stå kvar
      // och brinna upp sin väggklocka i tystnad. En bädd under en sändning får däremot bara en rad, rösten fortsätter.
      function musikFel(m) {
        const titel = (m && m.titel) || (aktivtSteg && aktivtSteg.musik && aktivtSteg.musik.titel) || 'okänt spår';
        if (aktivtSteg && aktivtSteg.sort === 'jingel') misslyckas('Ljudet till vinjetten gick inte att spela.');
        else if (aktivtSteg && aktivtSteg.sort === 'musik') misslyckas('Musikpartiet "' + titel + '" gick inte att spela.');
        else felrad('Musiken "' + titel + '" gick inte att spela. Rösten fortsätter utan den.');
      }

      function stoppaTick() { if (tick !== null) { clearInterval(tick); tick = null; } }
      function startaTick() { stoppaTick(); tickSist = nu(); sistaTid = -1; stillaSedan = 0; laddatSedan = 0; tick = setInterval(tickFn, 250); }

      function tickFn() {
        const t = nu(), dt = Math.max(0, (t - tickSist) / 1000);
        tickSist = t;
        if (!aktivtSteg || pausad) return;
        const element = (aktivtSteg.sort === 'jingel' || aktivtSteg.sort === 'musik') ? musik : röst;
        let c = 0, d = 0, redo = 4;
        try { c = Number(element.currentTime) || 0; d = Number(element.duration); redo = Number(element.readyState); } catch (e) { /* ignorera */ }
        const total = (isFinite(d) && d > 0) ? d : (num(aktivtSteg.sek) || num(aktivtSteg.längd) || 0);
        visaFörlopp(c, total);
        if (Math.abs(c - sistaTid) > 0.01) { sistaTid = c; stillaSedan = 0; laddatSedan = 0; felIRad = 0; return; }
        // Ett element utan data framför sig (readyState < 3 = HAVE_FUTURE_DATA) står inte still, det buffrar. På ett
        // trögt wifi ska det inte räknas som ett trasigt ljud, men det får inte heller hänga för evigt: egen, längre gräns.
        if (isFinite(redo) && redo < 3) {
          laddatSedan += dt;
          if (laddatSedan > LADDA_GRÄNS) misslyckas('Ljudet till ' + stegNamn(aktivtSteg) + ' gick inte att hämta.');
          return;
        }
        stillaSedan += dt;
        if (stillaSedan > STILLA_GRÄNS) misslyckas('Ljudet till ' + stegNamn(aktivtSteg) + ' gick inte att spela.');
      }

      function rensaTimers() {
        stoppaTick();
        if (slutTimer !== null) { clearTimeout(slutTimer); slutTimer = null; }
      }

      // Ett ljud som inte går att spela ska ge en diskret rad och sedan gå vidare, aldrig stanna i uppspelningsläge.
      // Går allt fel i rad är det inte ett spår som saknas utan ljudet som inte går att nå: då är det ärligare att
      // stanna och säga det än att låtsas spela sex minuter tystnad. Antalet hoppade sändningar sammanfattas på slutet,
      // eftersom felrutan bara rymmer MAX_FEL rader.
      function misslyckas(txt) {
        if (!aktivtSteg || aktivtSteg.klar) return;
        felrad(txt);
        if (aktivtSteg.sort === 'sändning') hoppade++;
        felIRad++;
        if (felIRad >= MAX_FEL) { stoppa('Ljudet går inte att nå just nu. Prova igen om en stund.'); return; }
        nästa();
      }
      const stegNamn = steg => steg && steg.sort === 'jingel' ? 'vinjetten' : (steg && steg.titel ? 'sändningen "' + steg.titel + '"' : 'sändningen');

      // Händelserna bindas EN gång och frågar alltid vilket steg som är aktivt, så inga lyssnare blir kvar att städa.
      röst.addEventListener('ended', () => {
        if (!aktivtSteg || pausad || aktivtSteg.sort !== 'sändning') return;
        if (väntadRöst && röst.src !== väntadRöst) return;      // ett gammalt spår som hann ta slut
        felIRad = 0;                                            // ett steg spelade hela vägen: kedjan av misslyckanden är bruten
        nästa();
      });
      röst.addEventListener('error', () => {
        if (!aktivtSteg || aktivtSteg.sort !== 'sändning' || !röst.error) return;
        if (väntadRöst && röst.src !== väntadRöst) return;
        misslyckas('Ljudet till ' + stegNamn(aktivtSteg) + ' gick inte att spela.');
      });
      musik.addEventListener('ended', () => {
        if (!aktivtSteg || pausad || (aktivtSteg.sort !== 'jingel' && aktivtSteg.sort !== 'musik')) return;
        if (väntadMusik && musik.src !== väntadMusik) return;
        felIRad = 0;
        nästa();
      });
      musik.addEventListener('error', () => {
        if (!aktivtSteg || !musik.error) return;
        if (väntadMusik && musik.src !== väntadMusik) return;
        musikSpelar = false;
        musikFel(aktivtSteg.musik);   // en bädd som saknas stoppar inte sändningen, men ett musikparti hoppas över
      });

      function tystna(direkt) {
        gen++;
        rensaTimers();
        avbrytTon();
        musikSpelar = false;
        try { röst.pause(); } catch (e) { /* ignorera */ }
        try { musik.pause(); } catch (e) { /* ignorera */ }
        if (direkt) { try { röst.currentTime = 0; } catch (e) { /* ignorera */ } }
      }

      function stoppa(statustext) {
        tystna(true);
        kö = []; köIndex = -1; aktivtSteg = null; körSort = ''; pausad = false;
        sättVol(MUSIK_FULL);
        visaFörlopp(0, 0);
        visaNu('Radio Torget', 'Tyst', 'Ljudet startar först när du trycker på en knapp.');
        sättLäge('Tyst');
        sättStatus(statustext || 'Stoppat. Ingenting spelas.');
        uppdatera();
      }

      function starta(steg, sort, statustext) {
        tystna(true);
        felräknare = 0; felruta.textContent = '';
        hoppade = 0; felIRad = 0;
        kö = steg; köIndex = -1; körSort = sort; pausad = false;
        sättVol(sort === 'hel' ? MUSIK_FULL : MUSIK_UNDER);
        if (statustext) sättStatus(statustext);
        nästa();
      }

      // Ett steg lämnas bara EN gång. Både 'ended', 'error', ett avvisat play-löfte och vakthunden kan peka på samma
      // misslyckande, och utan den här spärren skulle kön hoppa över nästa steg.
      function nästa() {
        if (aktivtSteg) { if (aktivtSteg.klar) return; aktivtSteg.klar = true; }
        rensaTimers();
        gen++;
        köIndex++;
        if (köIndex >= kö.length) { avsluta(); return; }
        aktivtSteg = kö[köIndex];
        startaSteg(aktivtSteg);
        uppdatera();
      }

      function startaSteg(steg) {
        if (steg.sort === 'jingel') {
          try { röst.pause(); } catch (e) { /* ignorera */ }
          sättMusik({ titel: 'Radio Torget', fil: steg.fil }, false);
          sättVol(MUSIK_FULL);
          visaNu('Vinjett', 'Radio Torget', 'Signaturen som inledde varje sändning.');
          sättLäge('Vinjett, ingen röst över');
          sättStatus('Vinjetten spelas.');
        } else if (steg.sort === 'sändning') {
          sättMusik(steg.musik, true);
          tona(MUSIK_UNDER, 700);
          try { röst.pause(); } catch (e) { /* ignorera */ }
          try { röst.muted = false; } catch (e) { /* ignorera */ }   // väckningen tystade elementet: det får aldrig hänga kvar här
          röst.src = steg.fil;
          väntadRöst = röst.src;
          try { röst.currentTime = 0; } catch (e) { /* ignorera */ }
          spela(röst, () => misslyckas('Ljudet till ' + stegNamn(steg) + ' gick inte att spela.'));
          const musikOrd = !steg.musik ? ''
            : steg.musik.efter
              ? 'Låten som följde sändningen tonas upp när rösten tystnar: ' + steg.musik.titel + slut(steg.musik.titel)
              : 'Spelaren lägger ' + (steg.musik.sort === 'bädd' ? 'bädden ' : 'låten ') + steg.musik.titel + ' under rösten.';
          const under = steg.musik
            ? (röstnamn ? 'Rösten ' + röstnamn + ' ovanpå musik på låg volym. ' : 'Rösten ovanpå musik på låg volym. ') + musikOrd
            : (röstnamn ? 'Rösten ' + röstnamn + ' ensam. ' : '') + 'Ingen musik under den här sändningen.';
          visaNu('Sändning ' + api.tal(steg.i + 1) + ' av ' + api.tal(sändningar.length) + ', kl. ' + steg.kl, steg.titel, under);
          sättLäge(steg.musik ? 'Musiken ligger under rösten' : 'Rösten ensam, ingen musik');
          sättStatus('Spelar sändning ' + api.tal(steg.i + 1) + ' av ' + api.tal(sändningar.length) + '.');
        } else {
          sättMusik(steg.musik, false);   // loopen släpps: låten ska få spela ut, inte klippas av en klocka
          tona(MUSIK_FULL, 1400);
          try { röst.pause(); } catch (e) { /* ignorera */ }
          const titel = steg.musik ? steg.musik.titel : 'okänt spår';
          const när = körSort === 'hel' ? (steg.sist ? 'efter sista sändningen' : 'mellan sändningarna') : 'efter sändningen';
          visaNu('Musik', steg.musik ? steg.musik.titel : 'Musik', 'Musiken tonas upp ' + när + ' och låten spelas ut.');
          sättLäge('Musiken uppe, rösten tyst');
          sättStatus('Musiken tonas upp: ' + titel + slut(titel));
        }
        startaTick();
      }

      function avsluta() {
        const färdig = körSort;
        gen++;
        rensaTimers();
        aktivtSteg = null; kö = []; köIndex = -1; pausad = false;
        try { röst.pause(); } catch (e) { /* ignorera */ }
        tona(0, 1000);
        const g = gen;
        slutTimer = setTimeout(() => {
          slutTimer = null;
          if (g !== gen) return;
          musikSpelar = false;
          try { musik.pause(); } catch (e) { /* ignorera */ }
          sättVol(MUSIK_FULL);
          uppdatera();                       // uttoningen är över: Stoppa ska inte längre gå att trycka på
        }, 1150);
        visaFörlopp(0, 0);
        visaNu('Radio Torget', 'Tyst', 'Ljudet startar först när du trycker på en knapp.');
        sättLäge('Tyst');
        sättStatus((färdig === 'hel' ? 'Återblicken är slut. Så lät staden.' : 'Sändningen är slut.')
          + (hoppade ? ' ' + api.tal(hoppade) + (hoppade === 1 ? ' sändning gick inte att spela.' : ' sändningar gick inte att spela.') : ''));
        körSort = '';
        uppdatera();
      }

      function pausa(orsak) {
        // Slutets uttoning har inget aktivt steg men låter ändå i drygt en sekund. Den ska gå att tysta på samma sätt
        // som allt annat, annars fortsätter den i en gömd flik utan att någon kan stoppa den.
        if (!aktivtSteg) {
          if (slutTimer === null) return;
          tystna(true);                       // rensaTimers() inuti tystna släcker slutTimer
          sättVol(MUSIK_FULL);
          sättLäge('Tyst');
          uppdatera();
          return;
        }
        if (pausad) return;
        pausad = true;
        gen++;                                  // gamla play-löften ska inte rapportera fel
        avbrytTon();
        stoppaTick();
        try { röst.pause(); } catch (e) { /* ignorera */ }
        try { musik.pause(); } catch (e) { /* ignorera */ }
        sättLäge('Pausat');
        sättStatus(orsak || 'Pausat.');
        uppdatera();
      }

      function fortsätt() {
        if (!aktivtSteg || !pausad) return;
        pausad = false;
        gen++;
        const steg = aktivtSteg;
        if (musikSpelar) spela(musik, () => { musikSpelar = false; felrad('Musiken gick inte att spela vidare.'); });
        if (steg.sort === 'sändning') {
          tona(MUSIK_UNDER, 400);                            // en ton som frös mitt i pausen ska hitta rätt nivå igen
          spela(röst, () => misslyckas('Ljudet till ' + stegNamn(steg) + ' gick inte att spela.'));
          sättLäge(steg.musik ? 'Musiken ligger under rösten' : 'Rösten ensam, ingen musik');
          sättStatus('Fortsätter sändning ' + api.tal(steg.i + 1) + ' av ' + api.tal(sändningar.length) + '.');
        } else if (steg.sort === 'jingel') {
          tona(MUSIK_FULL, 400);
          sättLäge('Vinjett, ingen röst över');
          sättStatus('Fortsätter vinjetten.');
        } else {
          tona(MUSIK_FULL, 400);
          sättLäge('Musiken uppe, rösten tyst');
          sättStatus('Fortsätter musiken.');
        }
        startaTick();
        uppdatera();
      }

      // ---------- spellistor ----------
      const jingelPost = musikbibliotek.find(m => m.sort === 'jingel' && ljudUrl(m.fil) === jingel) || null;
      function köHel() {
        const steg = [];
        if (jingel) steg.push({ sort: 'jingel', fil: jingel, i: -1, sek: (jingelPost && num(jingelPost.sek)) || 0 });
        sändningar.forEach((s, i) => {
          const fil = ljudUrl(s.fil);
          if (!fil) return;                                  // en sändning utan ljudfil får inget musikparti heller
          const m = musikFör(i);
          steg.push({ sort: 'sändning', i, fil, musik: m, titel: text(s.titel) || 'Utan rubrik', kl: klAv(s.ts), sek: num(s.sek) || 0 });
          if (m) steg.push({ sort: 'musik', i, musik: m, längd: restAv(m, s), sist: false });
        });
        for (let j = steg.length - 1; j >= 0; j--) if (steg[j].sort === 'musik') { steg[j].sist = true; break; }
        return steg;
      }
      function köEn(i) {
        const s = sändningar[i], fil = ljudUrl(s.fil), m = musikFör(i), steg = [];
        if (fil) steg.push({ sort: 'sändning', i, fil, musik: m, titel: text(s.titel) || 'Utan rubrik', kl: klAv(s.ts), sek: num(s.sek) || 0 });
        if (m) steg.push({ sort: 'musik', i, musik: m, längd: restAv(m, s), sist: false });   // en ensam sändning är ingen "sista sändning"
        return steg;
      }

      // ---------- studion ----------
      const studio = api.el('div', { class: 'kort h-radio-studio h-radio-kort' });
      studio.append(api.el('p', { class: 'h-radio-vinjett', text: 'Spelaren' }));

      const lampa = api.el('span', { class: 'h-radio-lampa', 'aria-hidden': 'true' });
      const nuSort = api.el('span', { class: 'h-radio-sort', text: 'Radio Torget' });
      const nuTitel = api.el('strong', { class: 'h-radio-nutitel', text: 'Tyst' });
      const nuUnder = api.el('span', { class: 'h-radio-nuunder', text: 'Ljudet startar först när du trycker på en knapp.' });
      studio.append(api.el('div', { class: 'h-radio-nu' }, [lampa, api.el('div', { class: 'h-radio-nutext' }, [nuSort, nuTitel, nuUnder])]));

      const fyll = api.el('span', { class: 'h-radio-fyll' });
      const spar = api.el('div', { class: 'h-radio-spar', role: 'progressbar', 'aria-label': 'Förlopp i det som spelas', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-valuetext': 'Ingenting spelas' }, [fyll]);
      const tidVänster = api.el('span', { text: '0:00' });
      const tidHöger = api.el('span', { text: 'Tyst' });   // ljudets läge i klartext, inte bara som färg på lampan
      studio.append(spar, api.el('p', { class: 'h-radio-tider' }, [tidVänster, tidHöger]));

      const status = api.el('p', { class: 'h-radio-status', role: 'status', 'aria-live': 'polite', text: 'Ingenting spelas.' });
      studio.append(status);

      // Hur lång hela återblicken blir: vinjett, alla sändningar och musikpartierna mellan dem.
      const heltid = köHel().reduce((s, x) => s + (x.sort === 'musik' ? x.längd : (num(x.sek) || 0)), 0);
      const heltidMin = Math.round(heltid / 60);
      const heltidText = heltid >= 60 ? 'ungefär ' + api.tal(heltidMin) + (heltidMin === 1 ? ' minut' : ' minuter') : längdText(heltid);
      const helKnapp = api.el('button', { class: 'knapp fylld', type: 'button', text: 'Spela hela återblicken' });
      if (heltid > 0) helKnapp.setAttribute('aria-label', 'Spela hela återblicken, ' + heltidText);
      const pausKnapp = api.el('button', { class: 'knapp', type: 'button', text: 'Pausa' });
      const stoppKnapp = api.el('button', { class: 'knapp', type: 'button', text: 'Stoppa' });
      studio.append(api.el('div', { class: 'h-radio-knappar' }, [helKnapp, pausKnapp, stoppKnapp]));

      const felruta = api.el('div', { class: 'h-radio-felruta' });
      studio.append(felruta);
      studio.append(api.el('p', {
        class: 'h-radio-not',
        text: 'Spelaren lägger rösten ovanpå musiken, precis som radiosidan gjorde: musiken sänks medan det pratas och tonas upp när rösten tystnar. '
          + 'Musiken under rösten är den låt som följde sändningen, alltså den som kom direkt efter pratet. Saknas den i data lägger spelaren en bädd ur radions musikbibliotek under i stället. Låten börjar när sändningen börjar och får sedan spela ut i sin helhet innan nästa sändning tar vid. '
          + (heltid > 0 ? 'Hela återblicken tar ' + heltidText + '. ' : '')
          + 'Ingenting startar av sig självt, och ljudet pausas om sektionen rullar ur bild eller om du byter flik.',
      }));
      // Två saker i materialet ser ut som fel om de inte sägs ut: klockslagen och hälsningarnas gruppering.
      studio.append(api.el('p', {
        class: 'h-radio-not',
        text: 'Tiden i listan är när sändningen gick ut. Klockslaget rösten läser upp är inte alltid detsamma. '
          + 'Hälsningarna står under den sändning vars manus faktiskt läser upp dem, hittad genom att söka namnet och orden i manustexten. Sex av sexton hälsningar hanns läsas upp.',
      }));
      rot.append(studio);

      function sättStatus(t) { status.textContent = t; }
      function visaNu(sort, titel, under) {
        nuSort.textContent = sort;
        nuTitel.textContent = titel || 'Utan rubrik';
        nuUnder.textContent = under || '';
      }
      function sättLäge(t) { tidHöger.textContent = t; }
      function visaFörlopp(gått, total) {
        const t = Number(total) || 0, g = Math.max(0, Math.min(t || 0, Number(gått) || 0));
        const andel = t > 0 ? Math.max(0, Math.min(100, g / t * 100)) : 0;
        fyll.style.width = andel.toFixed(1) + '%';
        tidVänster.textContent = t > 0 ? mmss(g) + ' av ' + mmss(t) : '0:00';
        spar.setAttribute('aria-valuenow', String(Math.round(andel)));
        spar.setAttribute('aria-valuetext', t > 0 ? (api.tal(Math.round(g)) + ' av ' + api.tal(Math.round(t)) + ' sekunder') : 'Ingenting spelas');
        const aktiv = rader[aktivtSteg && aktivtSteg.i >= 0 ? aktivtSteg.i : -1];
        if (aktiv) aktiv.fyll.style.width = (aktivtSteg && aktivtSteg.sort === 'sändning' ? andel : 100).toFixed(1) + '%';
      }

      // Väcker röst-elementet inuti användargesten. Kön börjar med vinjetten, som spelas på musik-elementet, och första
      // röst.play() kommer först ett halvt minut senare, utanför gesten: på iOS är varje medieelement låst tills det
      // startats av en gest, så då avvisas rösten och hela återblicken blir enbart musik. En ljudlös start här låser upp
      // elementet (och börjar hämta första manuset), och den pausas igen så snart löftet är klart.
      function väckRösten(steg) {
        if (röstVäckt) return;
        const första = steg.find(x => x && x.sort === 'sändning');
        if (!första || (steg[0] && steg[0].sort === 'sändning')) return;   // börjar kön med rösten behövs ingen väckning
        röstVäckt = true;                                                  // hindrar en andra väckning medan den här pågår
        const släpp = ok => {
          röstVäckt = !!ok;                                               // gick den inte igenom får nästa klick försöka igen
          try { röst.muted = false; } catch (e) { /* ignorera */ }
          if (aktivtSteg && aktivtSteg.sort === 'sändning') return;        // rösten hann bli den som ska låta: rör den inte
          try { röst.pause(); } catch (e) { /* ignorera */ }
          try { röst.currentTime = 0; } catch (e) { /* ignorera */ }
        };
        try {
          röst.muted = true;
          röst.src = första.fil;
          väntadRöst = röst.src;
          const p = röst.play();
          if (p && typeof p.then === 'function') p.then(() => släpp(true), () => släpp(false)); else släpp(true);
        } catch (e) { släpp(false); }
      }

      helKnapp.addEventListener('click', () => {
        const steg = köHel();
        if (!steg.length) { sättStatus('Det finns inget ljud att spela.'); return; }
        väckRösten(steg);
        starta(steg, 'hel', 'Startar återblicken.');
      });
      pausKnapp.addEventListener('click', () => { if (pausad) fortsätt(); else pausa('Pausat. Tryck Fortsätt när du vill höra resten.'); });
      stoppKnapp.addEventListener('click', () => stoppa('Stoppat. Allt ljud är tyst.'));

      // ---------- spellistan ----------
      if (sändningar.length) {
        const låda = api.el('div');
        låda.append(api.el('h3', { class: 'h-radio-rubrik', text: 'Sändningarna, i tidsordning' }));
        const ol = api.el('ol', { class: 'h-radio-lista', role: 'list' });   // list-style:none tar bort listsemantiken i Safari utan role
        sändningar.forEach((s, i) => {
          const kl = klAv(s.ts);
          const titel = text(s.titel) || 'Utan rubrik';
          const sek = num(s.sek) || 0;
          const fil = ljudUrl(s.fil);
          const m = musikFör(i);
          const hälsningar = Array.isArray(s.hälsningar) ? s.hälsningar.filter(h => h && typeof h === 'object') : [];

          const li = api.el('li', { class: 'h-radio-rad' });
          const spelknapp = api.el('button', { class: 'knapp', type: 'button', text: 'Spela' });
          spelknapp.setAttribute('aria-label', 'Spela sändningen klockan ' + kl + ': ' + titel);
          if (!fil) { spelknapp.disabled = true; spelknapp.setAttribute('aria-label', 'Ljudfil saknas för sändningen klockan ' + kl); spelknapp.textContent = 'Ljud saknas'; }

          const detaljId = 'h-radio-detalj-' + i;
          const manusknapp = api.el('button', { class: 'knapp', type: 'button', text: 'Läs manus' });
          manusknapp.setAttribute('aria-expanded', 'false');
          manusknapp.setAttribute('aria-controls', detaljId);
          manusknapp.setAttribute('aria-label', 'Läs manuset till sändningen klockan ' + kl);

          const metadelar = [längdText(sek)];
          if (num(s.tecken)) metadelar.push(api.tal(num(s.tecken)) + ' tecken');
          if (text(s.röst)) metadelar.push('röst: ' + text(s.röst));
          // Bara det som står i data hamnar i metaraden: låten EFTER pratet. En bädd som spelaren själv valt hör inte hemma här.
          if (m && m.efter) metadelar.push('låten efter: ' + m.titel);
          if (hälsningar.length) metadelar.push(api.tal(hälsningar.length) + (hälsningar.length === 1 ? ' hälsning uppläst' : ' hälsningar upplästa'));

          const topp = api.el('div', { class: 'h-radio-topp' }, [
            spelknapp,
            api.el('span', { class: 'h-radio-kl', text: 'kl. ' + kl }),
            api.el('h4', { class: 'h-radio-titel', text: titel }),   // h2 (sektionen) > h3 (blocket) > h4 (sändningen)
            manusknapp,
            api.el('p', { class: 'h-radio-meta', text: metadelar.join(' · ') }),
          ]);
          const radfyll = api.el('span', { class: 'h-radio-radfyll' });
          const radspar = api.el('div', { class: 'h-radio-radspar', 'aria-hidden': 'true' }, [radfyll]);
          radspar.hidden = true;

          const detalj = api.el('div', { class: 'h-radio-detalj', id: detaljId });
          detalj.hidden = true;
          const manusruta = api.el('div');
          manusruta.append(api.el('p', { class: 'h-radio-manusrubrik', text: 'Manuset som lästes upp' }));
          manusruta.append(api.el('p', { class: 'h-radio-manus', text: text(s.text) || 'Manuset saknas i dagens data.' }));
          detalj.append(manusruta);
          if (hälsningar.length) {
            const h = api.el('div');
            // Hälsningarna är kopplade till sändningen genom att namnet och orden finns i just det här manuset.
            h.append(api.el('p', { class: 'h-radio-manusrubrik', text: hälsningar.length === 1 ? 'Hälsningen som lästes upp i den här sändningen' : 'Hälsningarna som lästes upp i den här sändningen' }));
            h.append(hälsningslista(hälsningar));
            detalj.append(h);
          }

          li.append(topp, radspar, detalj);
          ol.append(li);

          const rad = { li, spelknapp, manusknapp, detalj, radspar, fyll: radfyll, öppen: false, auto: false, stängd: false, kl, titel, fil };
          rader.push(rad);

          spelknapp.addEventListener('click', () => {
            if (!fil) return;
            if (aktivtSteg && aktivtSteg.i === i) { stoppa('Stoppat. Allt ljud är tyst.'); return; }
            const steg = köEn(i);
            if (!steg.length) { sättStatus('Det finns inget ljud för den sändningen.'); return; }
            starta(steg, 'en', 'Startar sändningen klockan ' + kl + '.');
          });
          // Ett eget val om manuset ska stängas väger tyngre än automatiken: annars öppnar nästa tillståndsbyte det igen.
          manusknapp.addEventListener('click', () => { sättÖppen(rad, !rad.öppen); rad.auto = false; rad.stängd = !rad.öppen; });
        });
        låda.append(ol);
        rot.append(låda);
      }

      function sättÖppen(rad, öppen) {
        rad.öppen = !!öppen;
        rad.detalj.hidden = !öppen;
        rad.manusknapp.setAttribute('aria-expanded', öppen ? 'true' : 'false');
        rad.manusknapp.textContent = öppen ? 'Dölj manus' : 'Läs manus';
        rad.manusknapp.setAttribute('aria-label', (öppen ? 'Dölj manuset till sändningen klockan ' : 'Läs manuset till sändningen klockan ') + rad.kl);
      }

      function hälsningslista(lista) {
        const ul = api.el('ul', { class: 'h-radio-halsningar', role: 'list' });
        for (const h of lista) {
          const li = api.el('li', { class: 'h-radio-halsning' });
          const huvud = api.el('div', { class: 'h-radio-hhuvud' }, [api.el('span', { class: 'h-radio-hnamn', text: text(h.namn) || 'Anonym' })]);
          if (text(h.sort)) huvud.append(api.el('span', { class: 'chip', text: text(h.sort) }));
          if (num(h.ts) !== null) huvud.append(api.el('span', { class: 'h-radio-htid', text: 'kl. ' + api.kl(num(h.ts)) }));
          li.append(huvud, api.el('p', { class: 'h-radio-htext', text: text(h.text) || 'Utan text.' }));
          ul.append(li);
        }
        return ul;
      }

      // ---------- vad UI:t ska visa efter varje tillståndsbyte ----------
      function uppdatera() {
        const aktiv = aktivtSteg && aktivtSteg.i >= 0 ? aktivtSteg.i : -1;
        rader.forEach((rad, i) => {
          const på = i === aktiv;
          if (på) rad.li.setAttribute('aria-current', 'true'); else rad.li.removeAttribute('aria-current');
          rad.radspar.hidden = !på;
          if (!på) rad.fyll.style.width = '0%';
          if (rad.fil) {
            // Knappen stoppar allt ljud, inte bara raden. Mitt i den hela återblicken ska den därför inte lova något annat.
            rad.spelknapp.textContent = på ? 'Stoppa' : 'Spela';
            rad.spelknapp.setAttribute('aria-label', !på ? ('Spela sändningen klockan ' + rad.kl + ': ' + rad.titel)
              : (körSort === 'hel' ? 'Stoppa hela återblicken' : 'Stoppa sändningen klockan ' + rad.kl));
          }
          if (på && !rad.öppen && !rad.stängd) { sättÖppen(rad, true); rad.auto = true; }
          if (!på && rad.auto) { sättÖppen(rad, false); rad.auto = false; }
          if (!på) rad.stängd = false;                      // valet gäller den spelande raden, inte för alltid
        });
        const igång = !!aktivtSteg;
        studio.classList.toggle('h-radio-pa', igång && !pausad);
        studio.classList.toggle('h-radio-vilar', igång && pausad);
        pausKnapp.disabled = !igång;
        pausKnapp.textContent = pausad ? 'Fortsätt' : 'Pausa';
        stoppKnapp.disabled = !(igång || slutTimer !== null);   // slutets uttoning låter fortfarande och ska gå att tysta
      }

      // ---------- fakta ----------
      const upplästa = sändningar.reduce((s, x) => s + (Array.isArray(x.hälsningar) ? x.hälsningar.filter(h => h && typeof h === 'object').length : 0), 0);
      const speltid = sändningar.reduce((s, x) => s + (num(x.sek) || 0), 0);
      const teckenSumma = sändningar.reduce((s, x) => s + (num(x.tecken) || 0), 0);
      const tecken = num(r && r.tecken_totalt) !== null ? num(r.tecken_totalt) : teckenSumma;

      const faktarader = [];
      if (sändningar.length) faktarader.push([api.tal(sändningar.length), sändningar.length === 1 ? 'sändning i Radio Torget' : 'sändningar i Radio Torget']);
      if (speltid > 0) faktarader.push([mmss(speltid), 'sammanlagd speltid, alltså ' + längdText(speltid)]);
      if (tecken) faktarader.push([api.tal(tecken), 'tecken uppläst text']);
      if (röstnamn) faktarader.push([röstnamn, 'rösten som läste upp manusen']);
      if (låtar.length) faktarader.push([api.tal(låtar.length), 'låtar i musikbiblioteket' + (bäddar.length ? ', utöver ' + api.tal(bäddar.length) + ' bäddar' : '')]);
      faktarader.push([api.tal(upplästa), upplästa === 1 ? 'hälsning hann läsas upp i etern' : 'hälsningar hann läsas upp i etern']);
      faktarader.push([api.tal(olästa.length), olästa.length === 1 ? 'hälsning hann aldrig läsas upp' : 'hälsningar hann aldrig läsas upp']);

      if (faktarader.length) {
        const fakta = api.el('div', { class: 'kort h-radio-kort' });
        fakta.append(api.el('h3', { class: 'h-radio-rubrik', text: 'Radion i siffror' }));
        const rutnät = api.el('div', { class: 'h-radio-tal' });
        for (const [värde, txt] of faktarader) rutnät.append(api.el('div', null, [api.el('b', { text: värde }), api.el('span', { text: txt })]));
        fakta.append(rutnät);

        const första = sändningar.length ? num(sändningar[0].ts) : null;
        const sista = sändningar.length ? num(sändningar[sändningar.length - 1].ts) : null;
        let spann = '';
        if (första !== null && sista !== null) spann = första === sista ? ' Sändningen gick kl. ' + api.kl(första) + '.' : ' Den första gick kl. ' + api.kl(första) + ', den sista kl. ' + api.kl(sista) + '.';
        fakta.append(api.el('p', {
          class: 'h-radio-faktatext',
          text: 'Musiken var färdiga låtar. Det enda som skapades under dagen var rösten: manusen skrevs utifrån vad som hänt i staden och lästes upp' + (röstnamn ? ' av ' + röstnamn : '') + '.' + spann,
        }));
        // Kontraktets regel 7: ledningens kvarter ska hållas isär från deltagarteamens, och uppgiften står i data.kvarter.
        const radiokvarter = (Array.isArray(data.kvarter) ? data.kvarter : []).find(k => k && typeof k === 'object' && (k.team === 'radion' || text(k.namn) === 'Radio Torget')) || null;
        if (radiokvarter && radiokvarter.ledning) {
          fakta.append(api.el('p', {
            class: 'h-radio-faktatext',
            text: (text(radiokvarter.namn) || 'Radio Torget') + (text(radiokvarter.team) ? ' (team ' + text(radiokvarter.team) + ')' : '') + ' byggdes av workshopledningen, inte av ett deltagarteam.',
          }));
        }
        if (upplästa + olästa.length > 0) {
          fakta.append(api.el('p', {
            class: 'h-radio-faktatext',
            text: 'Av ' + api.tal(upplästa + olästa.length) + ' hälsningar från lyssnarna nådde ' + api.tal(upplästa) + ' fram till etern.',
          }));
        }
        rot.append(fakta);
      }

      // ---------- de olästa hälsningarna ----------
      if (olästa.length) {
        const låda = api.el('div', { class: 'kort h-radio-kort h-radio-brett h-radio-vantar' });
        låda.append(api.el('h3', { class: 'h-radio-rubrik', text: 'Kom in men hanns aldrig läsas upp' }));
        låda.append(api.el('p', { class: 'h-radio-not', text: 'Rösten tystnade före lyssnarna. De här ' + api.tal(olästa.length) + ' hälsningarna ligger kvar i kön och väntar fortfarande på sin sändning.' }));
        låda.append(hälsningslista(olästa.slice().sort((a, b) => (num(a.ts) || 0) - (num(b.ts) || 0))));
        rot.append(låda);
      }

      el.append(rot);
      visaFörlopp(0, 0);
      uppdatera();

      // ---------- pausa när sektionen inte syns eller fliken göms ----------
      let io = null;
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(poster => {
          for (const p of poster) if (!p.isIntersecting) pausa('Sektionen rullades ur bild, så ljudet pausades. Tryck Fortsätt.');
        }, { threshold: 0 });
        io.observe(rot);
      }
      const vidFlik = () => { if (document.hidden) pausa('Fliken göms, så ljudet pausades. Tryck Fortsätt.'); };
      // pagehide: sidan kan komma tillbaka ur bfcache med bakåtknappen, så gå via paustillståndet i stället för att bara
      // tysta. Annars står lampan kvar på rött och statusraden påstår att en sändning spelas fast allt är tyst.
      const vidLämna = () => { if (aktivtSteg || slutTimer !== null) pausa('Sidan lämnades, så ljudet pausades. Tryck Fortsätt.'); else tystna(true); };
      document.addEventListener('visibilitychange', vidFlik);
      window.addEventListener('pagehide', vidLämna);

      el.__hRadioStäda = () => {
        if (io) { io.disconnect(); io = null; }
        document.removeEventListener('visibilitychange', vidFlik);
        window.removeEventListener('pagehide', vidLämna);
        tystna(true);
      };
    },
  };
})();
