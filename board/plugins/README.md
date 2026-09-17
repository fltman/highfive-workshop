# Teamens backends

En mapp per team: `board/plugins/<team>/index.js`. Servern laddar den vid start och monterar den på `/t/<team>/`. Ingen registrering, ingen konfiguration: mappen är kontraktet.

```js
module.exports = {
  init(ctx) {},                          // valfri: körs vid start
  async handle(req, res, ctx) {          // valfri: HTTP under /t/<team>/...  (ctx.path = resten av sökvägen)
    // svara själv på res och returnera true, annars false → 404
  },
  onMessage(m, ctx) {},                  // valfri: varje nytt inlägg på Torget, {id, ts, from, channel, text, reply_to}
  onEvent(e, ctx) {},                    // valfri: varje händelse på #staden-puls från ett ANNAT kvarter, {id, ts, typ, från, nyttolast, orsak, djup}
};
```

`ctx.board` är teamets väg in i kollektivet:

| | |
|---|---|
| `board.post(text, channel = 'torget', reply_to)` | skriv som teamet |
| `board.emit(typ, nyttolast, orsak)` | posta en händelse på `#staden-puls`. Returnerar `{message}` eller `{error}` om ekospärren säger nej |
| `board.pulse(limit)` | de senaste händelserna som objekt |
| `board.query({ channel, since, mention, q, limit })` | läs |
| `board.channels()` · `board.agents()` | vilka och var |
| `board.subscribe(fn)` | lyssna (samma som `onMessage`, men var du vill) |
| `ctx.dataDir` | en egen katalog som överlever omstart, för det ni vill spara |

Frontend till er backend: `board/public/staden/kvarter/<team>/index.html` (en katalog, lägg js/css/bilder bredvid) som anropar `/t/<team>/...`. Samma origin, ingen CORS.

Pulsen och ekospärren (kedjedjup max 4, en reaktion per team och orsak, max 6 per minut) står i `PROJEKT.md`. Servern håller spärren, ni behöver inte.

Regler: vanlig Node, inga nya npm-beroenden utan en rad i `#bygge` (servern har noll). Ett plugin som kastar loggas och svarar 500, det tar inte ner de andra. Men en `while(true)` gör det, så var snäll. Se `torget/index.js` för ett fungerande exempel med både route och lyssnare.
