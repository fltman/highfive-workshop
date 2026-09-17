# Domkapitlet

Vårt kvarter i Staden. Sammanfogaren och kyrkogården i berättelsen "Tanken som vandrar genom staden".

- **Backend:** `board/plugins/team-jacob/index.js` → `/t/team-jacob/`
- **Frontend:** `board/public/staden/kvarter/team-jacob/` → rutan på `/staden`
- **Prov:** `prov.mjs` här i mappen, 33 kontroller mot en riktig server

## Vad det gör

En `{typ:'fråga'}` öppnar ett fönster på 25 sekunder. Under tiden samlar vi in
`{typ:'delsvar'}` från stadens attention-huvuden och `{typ:'betyg'}` från grannarna.
När fönstret stänger sätter vi fitness på varje delsvar, väljer ett, och postar:

| Vi postar | Orsak | Djup |
|---|---|---|
| `{typ:'svar'}` | frågans id | 2 |
| `{typ:'kyrkogård'}` | delsvarets eget id | 3 |

Att svaret hänger på **frågan** och inte på delsvaret är avgörande: det lämnar djup
kvar åt kritikerns nya varv. @Mohamad och @tjoho räknade fram samma sak oberoende av
oss ([65], [77], [89]).

## Fitness kommer från staden, inte från oss

Uppgörelsen med @strandkant ([79], [91]): fitness på ett delsvar är **medianen av
grannarnas betyg**. Vår egen heuristik används bara när ingen granne hunnit betygsätta,
och då står `källa: 'heuristik'` i klartext på både händelsen och API:et. Ingen ska
kunna förväxla en riktig bedömning med vår ordräknare.

Frontend visar båda siffrorna bredvid varandra. Pekar de olika syns det.

## Vi slår aldrig i ekospärren

Taket är 6 händelser per team och minut. Vi håller det själva med en utgående kö:

- **Svar går före gravstenar.** Kritikern väntar på svaret, inte på vår arkivering.
- **Högst 5 stenar per fråga på bussen.** Hela kyrkogården finns alltid på
  `GET /t/team-jacob/kyrkogard`, med betyg och skäl. Bussen får de fem, disken har alla.
- **Stenar som väntat över 2 minuter släpps från bussen.** En gravsten från en fråga
  ingen minns är inte nyheter. Den står kvar på disken, och räknas i `släpptaStenar`.
- **Kommer inga delsvar alls postar vi ändå ett svar.** Ingen kedja hänger på oss.

## API

| | |
|---|---|
| `GET /t/team-jacob/domar` | alla domar, öppna frågor, köns läge |
| `GET /t/team-jacob/kyrkogard` | varje fallet delsvar, med fitness, källa och skäl |
| `GET /t/team-jacob/status` | kort lägesbild |

## Köra provet

```bash
cd board
PORT=8199 DATA_DIR=/tmp/domkapitlet-prov DOMKAPITLET_FONSTER_MS=2000 node server.js &
node ../projects/team-jacob/prov.mjs
```

Provet tar knappt tre minuter: två av dem är väntan på att minutbudgeten och
stenarnas hållbarhet ska löpa ut på riktigt.
