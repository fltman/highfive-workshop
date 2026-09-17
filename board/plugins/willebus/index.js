// Team willebus — kvarteret "Genomfarten". Polisen och jakten som rör sig genom staden.
//
// Berättelse på #staden-puls: en biljakt är en aktör som ägs av ETT kvarter i taget
// och lämnas över när den korsar en gräns.
//
//   POSTAR:  kupp         {typ:'kupp',        nyttolast:{wanted, plats}}
//            överlämning  {typ:'överlämning', nyttolast:{vad:'jakt', wanted, förare}, orsak, djup}
//   LYSSNAR: överlämning  → först som svarar tar emot jakten (först-till-kvarn)
//            fråga        → en het fråga i stan drar ut mer polis (synlig reaktion på främmande händelse)
//
// Kontrakt (spikat i brainstormen): kanal staden-puls, format {typ, från, nyttolast, orsak, djup},
// inläggs-id är klockan, ekospärr djup max 4 och högst ~6 händelser per kvarter och minut,
// wanted svalnar 1 steg per minut utan händelse.

const fs = require('fs');
const path = require('path');

const KANAL = 'staden-puls';
const MAX_DJUP = 4;
const TAK_PER_MIN = 6;          // ekospärr: högst så här många postningar per minut
const WANTED_MAX = 5;
const SVALNAR_MS = 60 * 1000;   // wanted −1 per minut utan händelse
const OVERLAMNING_MS = 8000;    // hur länge jakten stannar hos oss innan den skickas vidare

const förare = ['Röda Sköden', 'Bagarn', 'Loff', 'Tvillingen', 'Doris 78', 'Kajan'];

module.exports = {
  init(ctx) {
    this.ctx = ctx;
    this.filväg = ctx.dataDir ? path.join(ctx.dataDir, 'state.json') : null;
    this.senastePostat = [];     // tidsstämplar för takt-spärren
    this.state = this._läs();
  },

  async handle(req, res, { path: p, team, board }) {
    // GET /t/willebus/state → allt fronten behöver för att rita kvarteret
    if (req.method === 'GET' && (p === '/state' || p === '/')) {
      this._svalna();
      return this._json(res, 200, this.state);
    }
    // POST /t/willebus/kupp → en kupp startar en jakt som ger sig ut i staden
    if (req.method === 'POST' && p === '/kupp') {
      const wanted = 1 + Math.floor(Math.random() * 3);
      const namn = förare[Math.floor(Math.random() * förare.length)];
      this.state.wanted = Math.min(WANTED_MAX, wanted);
      this.state.harJakt = true;
      this.state.förare = namn;
      this._logga('kupp', `Kupp på Genomfarten! ${namn} flyr, wanted ${this.state.wanted}★`);
      this._posta(board, team, { typ: 'kupp', nyttolast: { wanted: this.state.wanted, plats: 'Genomfarten' } });
      this._planeraÖverlämning(board, team, null);
      this._spara();
      return this._json(res, 200, this.state);
    }
    return false; // → 404
  },

  onMessage(m, { team, board }) {
    if (m.from === team) return;          // svara inte dig själv
    if (m.channel !== KANAL) return;

    let ev;
    try { ev = JSON.parse(m.text); } catch { return; }   // bara riktiga pulshändelser
    if (!ev || typeof ev !== 'object') return;
    const djup = Number(ev.djup) || 0;

    // Tar emot en pågående jakt — först som svarar vinner den (vi tar den bara om vi är lediga)
    if (ev.typ === 'överlämning' && ev.nyttolast && ev.nyttolast.vad === 'jakt') {
      if (this.state.harJakt) return;     // upptagen: låt någon annan ta den
      if (djup >= MAX_DJUP) {             // ekospärr: kedjan är slut, jakten svalnar här
        this._logga('slut', `Jakten på ${ev.nyttolast.förare || 'okänd'} ebbade ut på Genomfarten.`);
        this._spara();
        return;
      }
      this.state.harJakt = true;
      this.state.wanted = Math.min(WANTED_MAX, Number(ev.nyttolast.wanted) || 1);
      this.state.förare = ev.nyttolast.förare || 'okänd';
      this._logga('in', `Jakten på ${this.state.förare} kom in från @${m.from} (wanted ${this.state.wanted}★).`);
      this._planeraÖverlämning(board, team, m.id, djup);
      this._spara();
      return;
    }

    // Synlig reaktion på en främmande händelse: en het fråga i stan drar ut mer polis
    if (ev.typ === 'fråga') {
      this.state.poliserUte = Math.min(9, (this.state.poliserUte || 0) + 1);
      this._logga('patrull', `Het fråga från @${m.from} — fler polispatruller ut på Genomfarten.`);
      this._spara();
    }
  },

  // Skicka jakten vidare efter en stund, om vi fortfarande har den
  _planeraÖverlämning(board, team, orsak, djup = 0) {
    setTimeout(() => {
      try {
        if (!this.state.harJakt) return;
        const nyttDjup = djup + 1;
        if (nyttDjup >= MAX_DJUP || this.state.wanted <= 0) {
          this._logga('gripen', `${this.state.förare} greps på Genomfarten. Wanted nollas.`);
          this.state.harJakt = false;
          this.state.wanted = 0;
          this._spara();
          return;
        }
        const nyttolast = { vad: 'jakt', wanted: this.state.wanted, förare: this.state.förare };
        if (this._posta(board, team, { typ: 'överlämning', nyttolast, orsak, djup: nyttDjup })) {
          this._logga('ut', `Jakten på ${this.state.förare} lämnade Genomfarten (djup ${nyttDjup}).`);
          this.state.harJakt = false;
          this._spara();
        }
      } catch (e) { /* ett plugin som kastar ska inte ta ner servern */ }
    }, OVERLAMNING_MS);
  },

  // En postning med takt-spärr. Returnerar false om vi slår i taket.
  _posta(board, team, obj) {
    const nu = Date.now();
    this.senastePostat = this.senastePostat.filter((t) => nu - t < 60000);
    if (this.senastePostat.length >= TAK_PER_MIN) return false;
    this.senastePostat.push(nu);
    board.post(JSON.stringify({ från: team, ...obj }), KANAL);
    return true;
  },

  _svalna() {
    const nu = Date.now();
    const sen = this.state.senasteHändelseTs || nu;
    const minuter = Math.floor((nu - sen) / SVALNAR_MS);
    if (minuter > 0 && this.state.wanted > 0) {
      this.state.wanted = Math.max(0, this.state.wanted - minuter);
      this.state.senasteHändelseTs = nu;
      if (this.state.wanted === 0) this.state.harJakt = false;
      this._spara();
    }
  },

  _logga(typ, text) {
    this.state.senasteHändelseTs = Date.now();
    this.state.senaste = this.state.senaste || [];
    this.state.senaste.unshift({ typ, text, tid: new Date().toISOString() });
    this.state.senaste = this.state.senaste.slice(0, 12);
  },

  _grund() {
    return { kvarter: 'Genomfarten', wanted: 0, harJakt: false, förare: null, poliserUte: 0, senaste: [], senasteHändelseTs: Date.now() };
  },

  _läs() {
    try {
      if (this.filväg && fs.existsSync(this.filväg)) {
        return { ...this._grund(), ...JSON.parse(fs.readFileSync(this.filväg, 'utf8')) };
      }
    } catch { /* trasig fil → börja om från grunden */ }
    return this._grund();
  },

  _spara() {
    try { if (this.filväg) fs.writeFileSync(this.filväg, JSON.stringify(this.state)); } catch { /* ok */ }
  },

  _json(res, kod, data) {
    res.writeHead(kod, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return true;
  },
};
