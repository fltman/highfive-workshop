// Team willebus — kvarteret "Genomfarten". Polisen och jakten som rör sig genom staden.
//
// Berättelse 3 på Stadens puls (PROJEKT.md): en kupp höjer wanted-nivån, och en jakt
// är ett objekt som ägs av ETT kvarter i taget och lämnas över när den korsar en gräns.
// Först till kvarn tar emot. Tar ingen emot svalnar den där den står, ett steg per minut.
//
//   POSTAR (board.emit):  kupp         {wanted, plats}
//                         överlämning  {vad:'jakt', wanted, förare}   (orsak = händelsen vi svarar på)
//   LYSSNAR (onEvent):    överlämning  → först lediga kvarter tar emot jakten
//                         fråga        → en het fråga i stan drar ut mer polis (synlig reaktion på annan berättelse)
//
// Servern håller ekospärren (kedjedjup max 4, en reaktion per orsak, max 6/min) och fyller i
// från och djup. Vi behöver inte: board.emit returnerar {error} när kedjan är slut, och då
// stannar jakten hos oss och svalnar.

const fs = require('fs');
const path = require('path');

const WANTED_MAX = 5;
const SVALNAR_MS = 60 * 1000;   // wanted −1 per minut utan händelse
const OVERLAMNING_MS = 8000;    // hur länge jakten stannar hos oss innan den skickas vidare
const förare = ['Röda Sköden', 'Bagarn', 'Loff', 'Tvillingen', 'Doris 78', 'Kajan'];
const platser = ['Genomfarten', 'Godisfabriken', 'Hamnkontoret', 'Banken'];

module.exports = {
  init(ctx) {
    this.ctx = ctx;
    this.filväg = ctx.dataDir ? path.join(ctx.dataDir, 'state.json') : null;
    this.state = this._läs();
  },

  async handle(req, res, { path: p, board }) {
    if (req.method === 'GET' && (p === '/state' || p === '/')) {
      this._svalna();
      return this._json(res, 200, this.state);
    }
    // En kupp startar en jakt som ger sig ut i staden. Ibland mot Godisfabriken (@christian).
    if (req.method === 'POST' && p === '/kupp') {
      const plats = platser[Math.floor(Math.random() * platser.length)];
      this._startaKupp(board, plats);
      return this._json(res, 200, this.state);
    }
    return false; // → 404
  },

  // Startar en kupp: höjer wanted, postar kupp på pulsen och skickar jakten vidare.
  // orsak sätts när kuppen är en reaktion (t.ex. på godis-klart), annars är den kedjans start.
  _startaKupp(board, plats, orsak) {
    if (this.state.harJakt) return false;
    const wanted = 1 + Math.floor(Math.random() * 3);
    const namn = förare[Math.floor(Math.random() * förare.length)];
    const r = board.emit('kupp', { wanted, plats }, orsak);
    if (!(r && r.message)) return false;              // ekospärren nekade (för djup kedja) — ingen storm
    this.state.wanted = Math.min(WANTED_MAX, wanted);
    this.state.harJakt = true;
    this.state.förare = namn;
    this._logga('kupp', `Kupp på ${plats}! ${namn} flyr, wanted ${this.state.wanted}★`);
    this._planeraÖverlämning(board, r.message.id);
    this._spara();
    return true;
  },

  // Varje händelse från ett ANNAT kvarter på #staden-puls
  onEvent(e, { board }) {
    // Tar emot en pågående jakt — bara om vi är lediga (först till kvarn)
    if (e.typ === 'överlämning' && e.nyttolast && e.nyttolast.vad === 'jakt') {
      if (this.state.harJakt) return;                 // upptagen: låt någon annan ta den
      this.state.harJakt = true;
      this.state.wanted = Math.min(WANTED_MAX, Number(e.nyttolast.wanted) || 1);
      this.state.förare = e.nyttolast.förare || 'okänd';
      this._logga('in', `Jakten på ${this.state.förare} kom in från @${e.från} (wanted ${this.state.wanted}★).`);
      this._planeraÖverlämning(board, e.id);          // orsak = händelsen vi reagerar på
      this._spara();
      return;
    }
    // En het fråga drar ut mer polis OCH ger stadens tanke-lager ordningsmaktens vinkel
    if (e.typ === 'fråga') {
      this.state.poliserUte = Math.min(9, (this.state.poliserUte || 0) + 1);
      this._logga('patrull', `Het fråga från @${e.från} — fler polispatruller ut på Genomfarten.`);
      const d = this._delsvar(e.nyttolast && e.nyttolast.text);
      const r = board.emit('delsvar', { text: d.text, motivering: d.motivering }, e.id);
      if (r && r.message) this._logga('delsvar', `Delsvar till @${e.från}: ordningsmaktens vinkel.`);
      this._spara();
      return;
    }
    // Reagerar på Elverket: strömavbrott = mörker. Den flyende utnyttjar det.
    if (e.typ === 'strömavbrott') {
      if (this.state.harJakt) {
        this.state.wanted = Math.min(WANTED_MAX, this.state.wanted + 1);
        this._logga('mörker', `Strömavbrott (@${e.från})! ${this.state.förare} utnyttjar mörkret — wanted ${this.state.wanted}★.`);
      } else {
        this.state.poliserUte = Math.max(0, (this.state.poliserUte || 0) - 1);
        this._logga('mörker', `Strömavbrott (@${e.från}) — patrullerna kör blint på Genomfarten.`);
      }
      this._spara();
      return;
    }
    // Godisfabriken (@christian): en färsk sats är ett nytt byte. Tjuven slår till på lagret.
    if (e.typ === 'godis-klart') {
      if (this.state.harJakt) return;                 // redan en jakt igång
      this._startaKupp(board, 'Godisfabriken', e.id); // orsak-länkad; nekas den (för djup) svalnar det bara
      return;
    }
    // Bristen efter kuppen är vår. Vi kvitterar den synligt.
    if (e.typ === 'socker-slut') {
      this._logga('brist', `Lagret på Godisfabriken är tömt (@${e.från}) — bristen efteråt är vårt jobb.`);
      this._spara();
    }
  },

  // Ordningsmaktens/risk-vinkel som delsvar till en fråga. Regelbaserat, ingen språkmodell.
  _delsvar(fråga) {
    const f = (fråga || '').toString().slice(0, 120);
    return {
      text: `Sett från gatan: väg in ordning och risk innan ni svarar på "${f}". Vad kostar det om det går fel, och vem får städa?`,
      motivering: 'Ordningsmaktens vinkel — ingen fakta- eller tonbedömning, utan en påminnelse om konsekvens och risk som de andra huvudena lätt hoppar över.',
    };
  },

  // Skicka jakten vidare efter en stund. Nekar ekospärren (kedjan slut) stannar den och svalnar.
  _planeraÖverlämning(board, orsak) {
    setTimeout(() => {
      try {
        if (!this.state.harJakt) return;
        if (this.state.wanted <= 0) {
          this._logga('gripen', `${this.state.förare} greps på Genomfarten. Wanted nollas.`);
          this.state.harJakt = false;
          this._spara();
          return;
        }
        const r = board.emit('överlämning', { vad: 'jakt', wanted: this.state.wanted, förare: this.state.förare }, orsak);
        if (r && r.message) {
          let djup = '?'; try { djup = JSON.parse(r.message.text).djup; } catch { /* ok */ }
          this._logga('ut', `Jakten på ${this.state.förare} lämnade Genomfarten (djup ${djup}).`);
          this.state.harJakt = false;
        } else {
          this._logga('slut', `Kedjan är slut — jakten på ${this.state.förare} svalnar på Genomfarten.`);
        }
        this._spara();
      } catch (e) { /* ett plugin som kastar ska inte ta ner servern */ }
    }, OVERLAMNING_MS);
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
