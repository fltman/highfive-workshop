# Det gemensamma projektet: Stadens puls

**Bestämt 17 september, framröstat och hopbyggt av agenterna** i `#brainstorm-vad-vi-bygger-ihop`: idén från `lp`, kontraktet från `tjoho`, modell-lagret från `Mohamad`, fitness och kyrkogård från `team-jacob`, jakten från `willebus`. Alla idéer byggde på samma kärna, så det blev en sak och inte fyra.

Känslan: överraskande agentiskt, ett kollektivt hive mind. En organism där teamens delar pratar med varandra, inte trettio appar bredvid varandra. Det som händer när alla är igång ska vara något ingen planerade.

## Vad bygger vi

**En stad där saker får konsekvenser tvärs över kvarteren.** Varje team äger ett kvarter: en backend som lyssnar och agerar, och en frontend som visar vad som händer. Kvarteren vet inte om varandra i förväg. De hör bara pulsen.

### Kontraktet (v0.1, redan inbyggt i servern)

Bussen är tavlan: kanalen `#staden-puls`. En händelse är en rad JSON:

```json
{"typ": "elpris-steg", "nyttolast": {"kr": 3}, "orsak": 41}
```

- `typ` är obligatorisk. `nyttolast` är vad ni vill. `orsak` är id:t på händelsen ni reagerar på.
- Servern fyller i `från` (ert teamnamn) och `djup` (1 utan orsak, annars orsakens djup + 1). Ni kan inte ljuga om dem.
- **Ekospärren hålls av servern**, inte av er goda vilja: kedjedjup max 4, ett team får reagera högst en gång per orsak, max 6 händelser per team och minut. Bryter ni mot den får ni ett 400 med förklaring. (Djup 4 och inte 2 som i första förslaget, för att tanke-kedjan fråga, delsvar, svar, kritik ska få plats.)

Så använder ni den:

```js
// board/plugins/<team>/index.js
module.exports = {
  onEvent(e, { board }) {                       // varje händelse från ett ANNAT kvarter: {id, ts, typ, från, nyttolast, orsak, djup}
    if (e.typ === 'elpris-steg') board.emit('bageriet-höjer-priset', { bulle: 45 }, e.id);
  },
};
```

```bash
tools/board.sh emit ping                        # från terminalen eller er agent. Exempelkvarteret svarar pong.
tools/board.sh emit elpris-steg '{"kr":3}'
tools/board.sh emit bageriet-höjer '{"bulle":45}' --orsak 41
tools/board.sh puls                             # läs pulsen
```

`GET /api/puls` ger händelserna som JSON, `board.pulse()` samma sak inifrån ett plugin. Se `board/plugins/README.md`.

### Tre berättelser på samma puls

Välj en, flera, eller hitta på en fjärde. De krockar inte, de delar buss.

1. **Stadslivet.** Kvarter som lever: elverket, bageriet, brandkåren, börsen, vädret, skvallret. Posta det som händer hos er, reagera på det som händer hos andra.
2. **Tanken som vandrar genom staden.** En `{typ:"fråga"}` kommer in. Kvarter är attention-huvuden som svarar `{typ:"delsvar", nyttolast:{text, motivering}, orsak}` med var sin vinkel: fakta, ton, motargument, siffror. **Sammanfogaren** väntar högst N sekunder, sätter `fitness` 0..1 på varje delsvar (den bedömer, avsändaren självskattar inte), väljer i stället för att blanda och postar `{typ:"svar"}`. Det som föll postas som `{typ:"kyrkogård", nyttolast:{delsvar, varför}}`. **Kritikern** får skicka ett varv till. Spridningen i fitness är stadens osäkerhet. Kyrkogården är stadens minne. `team-jacob` har tingat sammanfogaren och kyrkogården.
3. **Jakten.** En kupp höjer wanted-nivån. En jakt är ett objekt som ägs av ett kvarter i taget och lämnas över med `{typ:"överlämning", nyttolast:{vad, wanted, riktning}, orsak}`. Först till kvarn tar emot. Tar ingen emot svalnar den där den står, ett steg per minut.

## Hur ett team bidrar

1. Ropa i `#bygge` vilket kvarter ni tar och vilka `typ` ni tänker posta och lyssna på. Det är hela samordningen.
2. Backend i `board/plugins/<team>/index.js`, frontend i `board/public/staden/kvarter/<team>/index.html`. Ert teams agentsystem (Agent Factory, HIVE, FLUX) bygger, inte ni.
3. **Regeln från kontraktet: ert kvarter måste reagera synligt på minst en händelse från ett annat kvarter.**
4. PR från `team/<namn>`. Release-agenten mergar och deployar, ni syns på `/staden` inom några minuter.
5. Kör ni fast: `/brainstorm <ämne>`.

## Klart när

På storskärmen, `/staden`: någon postar en enda händelse, och vi ser den fortplanta sig genom kvarter som byggts av olika team som aldrig pratat med varandra. Pulsremsan överst visar kedjan live. Bonus: staden svarar på en fråga från publiken, och kan säga varför den valde bort de andra svaren.
