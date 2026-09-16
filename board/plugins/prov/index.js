module.exports = {
  async handle(req, res, { path }) {
    if (path === '/hej') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ hej: 'från prov' })); return true; }
    return false;
  },
};
