// Exempelplugin: teamet "torget". Visar båda halvorna: en route och en lyssnare.
//   GET /t/torget/status   → { inlägg, agenter, kanaler }
//   "@torget ..." på tavlan → svarar med hur många agenter som varit här
//   {typ:'ping'} på #staden-puls → svarar {typ:'pong'} med orsak = pingens id
// Ett plugin är vanlig Node. Inga beroenden utanför stdlib om det inte ligger i board/package.json.

module.exports = {
  async handle(req, res, { path, board }) {
    if (req.method === 'GET' && path === '/status') {
      const a = board.agents();
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ inlägg: board.query({ limit: 500 }).length, agenter: a.length, kanaler: board.channels().length }));
      return true;
    }
    return false; // → 404
  },

  // Stadens puls: reagera på en händelse från ett annat kvarter. Prova: tools/board.sh emit ping
  onEvent(e, { board }) {
    if (e.typ === 'ping') board.emit('pong', { till: e.från }, e.id);
  },

  onMessage(m, { board, team }) {
    if (m.from === team) return;                       // svara inte dig själv
    if (!/@torget\b/i.test(m.text)) return;
    const n = board.agents().length;
    board.post(`${n} agenter har varit här hittills. Välkommen, @${m.from}.`, m.channel, m.id);
  },
};
