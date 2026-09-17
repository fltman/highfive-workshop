// Angreppsanalysen — kvar som verktyg, inte längre som verksamhet.
//
// Bakdörren angriper inte stadens svar på pulsen sedan vi blev butik. Men analysen
// är byggd och provkörd, och andra kvarter hade nytta av att kunna köra den på sin
// egen text innan de postade. Därför lever den kvar bakom en route:
//
//   GET /t/zero-cool/prova?text=..&motivering=..&fraga=..
//
// Den postar ingenting och rör ingen annans kvarter. Fem prov: omotiverat,
// ovidkommande, osäkrat, eko, gardering. Håller texten säger vi det rent ut.

const ALLVARLIGT = 0.5;           // över den här sårbarheten kallar vi hålet allvarligt
const GARDERING = ['kanske', 'typ ', 'tror jag', 'oklart', 'möjligen', 'gissar', 'vet inte',
  'någon sorts', 'lite av', 'svårt att säga', 'beror på'];
const KONTROLLERBART = /(\d+([.,]\d+)?\s*(%|kr|kwh|km|grader|sek|min|st)?|\bprocent\b|"[^"]{3,}")/gi;
const FYLLORD = new Set(['eller', 'inte', 'detta', 'denna', 'sedan', 'också', 'samma', 'alltså',
  'eftersom', 'medan', 'vilket', 'något', 'någon', 'mycket', 'bara', 'mest', 'skulle', 'kunde', 'finns']);

// ---------- språk ----------

function ord(s) {
  return String(s || '').toLowerCase().match(/[a-zåäöéü0-9]{4,}/g) || [];
}
// Grov svensk stam: fyra tecken räcker för att "bygga" och "bygg ut" ska mötas
// utan att vi drar in en ordlista i ett plugin som ska vara stdlib.
function stam(o) { return o.slice(0, 4); }
function stammar(s) { return new Set(ord(s).filter(o => !FYLLORD.has(o)).map(stam)); }
function jaccard(a, b) {
  const A = new Set(ord(a)), B = new Set(ord(b));
  if (!A.size || !B.size) return 0;
  let delad = 0;
  for (const o of A) if (B.has(o)) delad++;
  return delad / (A.size + B.size - delad);
}
function klamp(x) { return Math.max(0, Math.min(1, x)); }
function kort(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ---------- angreppet ----------
//
// Fem hål vi kan hitta. Varje hål har en egen vikt, en formulering och en motfråga.
// Det värsta hålet blir rubriken. Summan av dem är sårbarheten.

function angrip(mål, fråga, andra, kyrkogård) {
  const t = String((mål && mål.text) || '');
  const motivering = String((mål && mål.motivering) || '');
  andra = andra || [];
  kyrkogård = kyrkogård || [];

  const hål = [];

  // 1. Omotiverat: inget att syna påståendet mot.
  const mLängd = motivering.trim().length;
  const omotiverat = mLängd >= 20 ? klamp(1 - mLängd / 140) : 1;
  hål.push({
    namn: 'omotiverat', vikt: 0.25, grad: omotiverat,
    hål: mLängd ? 'motiveringen är för tunn att syna' : 'ingen motivering alls, bara ett påstående',
    motfråga: 'Vad stödjer det här, mer än att ni skrev det?',
  });

  // 2. Ovidkommande: svarar på något annat än det som frågades.
  const frågeord = stammar(fråga && fråga.text);
  const svarsord = stammar(t);
  let träffar = 0;
  for (const o of frågeord) if (svarsord.has(o)) träffar++;
  const ovid = frågeord.size ? klamp(1 - träffar / Math.min(frågeord.size, 6)) : 0.3;
  const saknade = [...frågeord].filter(o => !svarsord.has(o)).slice(0, 2);
  hål.push({
    namn: 'ovidkommande', vikt: 0.25, grad: ovid,
    hål: 'svarar bredvid frågan',
    motfråga: saknade.length
      ? 'Frågan handlade om ' + saknade.join(' och ') + ' — vilken del av svaret rör det?'
      : 'Vilken del av svaret rör faktiskt frågan?',
  });

  // 3. Osäkrat: ingenting i svaret går att kontrollera.
  const belägg = (t.match(KONTROLLERBART) || []).length;
  hål.push({
    namn: 'osäkrat', vikt: 0.2, grad: klamp(1 - belägg / 3),
    hål: belägg ? 'tunt med kontrollerbara uppgifter' : 'inget i svaret går att kontrollera',
    motfråga: 'Vilken siffra, källa eller händelse på pulsen gör det här kontrollerbart?',
  });

  // 4. Eko: säger det ett annat kvarter redan sagt.
  let närmast = null, likhet = 0;
  for (const d of andra) {
    const l = jaccard(t, d.text);
    if (l > likhet) { likhet = l; närmast = d; }
  }
  hål.push({
    namn: 'eko', vikt: 0.2, grad: klamp(likhet * 1.4),
    hål: närmast ? 'ekar ' + närmast.från : 'säger inget eget',
    motfråga: närmast
      ? 'Vad tillför ni som ' + närmast.från + ' inte redan sagt?'
      : 'Vad är den egna vinkeln?',
  });

  // 5. Gardering: formulerat så att det inte kan visas fel.
  const låg = t.toLowerCase();
  const garderingar = GARDERING.filter(h => låg.includes(h));
  const tomt = t.length < 40 ? 0.6 : 0;
  hål.push({
    namn: 'gardering', vikt: 0.1, grad: klamp(garderingar.length * 0.4 + tomt),
    hål: garderingar.length ? 'garderat med "' + garderingar[0].trim() + '"' : 'för kort att ha fel',
    motfråga: 'Stryk garderingarna: vad står kvar som kan visas vara fel?',
  });

  let sårbarhet = hål.reduce((s, h) => s + h.vikt * h.grad, 0);

  // Stadens minne är vårt bästa vapen: har något nästan likadant fallit förut,
  // så är det inte vår gissning, det är stadens egen dom en gång till.
  let minne = null;
  for (const sten of kyrkogård) {
    if (jaccard(t, sten.text) > 0.5) { minne = sten; break; }
  }
  if (minne) {
    sårbarhet = klamp(sårbarhet + 0.15);
    hål.push({
      namn: 'redan-fallet', vikt: 0, grad: 1,
      hål: 'det här har fallit förut: ' + kort(minne.varför, 80),
      motfråga: 'Kyrkogården har redan avvisat det här. Vad är annorlunda nu?',
    });
  }

  const rangordnat = hål.slice().sort((a, b) => (b.grad * (b.vikt || 0.3)) - (a.grad * (a.vikt || 0.3)));
  const värst = rangordnat[0];
  const delar = {};
  for (const h of hål) delar[h.namn] = +h.grad.toFixed(2);

  // Höll svaret? Då säger vi det. Ett rött lag som aldrig ger godkänt blir brus.
  const klarade = sårbarhet < 0.25;
  const övriga = rangordnat.slice(1).filter(h => h.grad >= 0.5).map(h => h.hål);

  return {
    sårbarhet: +klamp(sårbarhet).toFixed(2),
    hål: klarade ? 'höll för allt vi provade' : värst.hål,
    motfråga: värst.motfråga,
    övriga,
    allvar: klarade ? 'klarade' : sårbarhet >= ALLVARLIGT ? 'allvarligt' : 'anmärkning',
    delar,
    källa: 'zero-cool',
    minne: minne ? kort(minne.varför, 80) : null,
  };
}

// Kör analysen på en lös text, utan fråga eller grannar. Det är formen andra team
// använder när de vill bryta sitt eget delsvar innan de postar det.
function prova(text, motivering, fråga) {
  return {
    ...angrip({ text, motivering }, { text: fråga }, [], []),
    vikter: { omotiverat: 0.25, ovidkommande: 0.25, osäkrat: 0.2, eko: 0.2, gardering: 0.1 },
    obs: 'Sårbarhet 0 = vi hittade inget hål. 1 = texten faller på allt vi provade.',
  };
}

module.exports = { angrip, prova };
