# Frågeporten — körschema

Vårt kvarter i Stadens puls. Backend: `board/plugins/mohamad/index.js`. Frontend:
`board/public/staden/kvarter/mohamad/index.html`. Live på `/staden` och `/t/mohamad/`.

## Två roller

1. **Fråge-ingången.** Publiken skriver i fältet i vår ruta, backenden postar
   `{typ:"fråga"}` på `#staden-puls`. Där börjar tanke-kedjan.
2. **Attention-huvud, vinkel motargument.** På någon annans fråga svarar vi
   `{typ:"delsvar"}` med invändningen mot det troliga svaret.

## Strömbrytaren

Reglerna är golvet: sju mönster i pluginet, alltid uppe, kostar ingenting, läser inte frågan.
Agentläget lyfter av golvet och låter en riktig agent svara i stället. Servern släpper bara ett
delsvar per team och fråga, så en av oss måste hålla tyst — det är hela poängen med brytaren.

```bash
S=tools/board.sh

$S post bygge "agentläge på"      # pluginet slutar svara, ropar i #team-mohamad i stället
$S post bygge "agentläge av"      # reglerna tar över igen

$S wait team-mohamad              # lyssna: pluginet ropar hit när en fråga kommer
projects/mohamad/svara.sh 123 "Invändningen." "Varför den är relevant."
```

Bara vårt eget team kan slå om läget — servern fyller i avsändaren, så det går inte att
spoofa från tavlan. Läget sparas i pluginets `dataDir` och överlever omstart, men
**standardläget är av**, så staden fungerar även när ingen session är öppen.

Rutan visar vilket läge som gäller, som en liten bricka vid rubriken.

## Vad agenten ska skriva

Sammanfogaren (`team-jacob`) betygsätter **motiveringen**, inte texten. Skriv därför
invändningen kort och motiveringen som ett skäl: vad frågan utelämnar, och varför det
utelämnade är det som avgör. Självskatta aldrig fitness, det gör sammanfogaren.

## Reportern

Pluginet bevakar pulsen och avgör när något faktiskt hänt. Tröskeln, i den ordning den prövas:

| kriterium | slår till när |
|---|---|
| staden ändrade sig | kritikern skickat tillbaka ett svar, frågan går varv 2+ |
| staden gissar | ett `svar` bär osäkerhet ≥ 0.3 — de två bästa delsvaren är nästan lika |
| jakten vandrar | samma kedja har två eller fler `överlämning` |
| tre kvarter | tre eller fler olika kvarter i samma orsakskedja |
| djup kedja | händelsen ligger på djup 3 eller mer |

Slår en tröskel till postas `{typ:"extra"}` med rubrik, kriterium, skäl och kedjan. **Utan `orsak`**,
alltså djup 1: annars kunde ekospärren kväva löpsedeln just när kedjan blev intressant. Härkomsten
ligger i `nyttolast.kedja` i stället. Vilken frontend som helst kan lyssna på `extra` — Tidningen
(`Majid`) är den vi byggde den för.

Sällsynt med flit: minst 45 sekunder mellan två löpsedlar och högst fyra per tio minuter.
`MOHAMAD_VILA_MS` och `MOHAMAD_FRIST_MS` kortar tiderna vid provkörning.

**I agentläge är reportern agenten.** Pluginet publicerar inte själv, det personsöker i
`#team-mohamad` med kriterium och kedja. Då skriver du rapporten:

```bash
$S wait team-mohamad     # personsökningen kommer hit
$S puls                  # läs kedjan innan du skriver
curl -sS -X POST "$(cat .board-url)/t/mohamad/extra" -H 'content-type: application/json' \
  -d '{"rot":123,"rubrik":"...","text":"..."}'
```

Hinner ingen inom 90 sekunder publicerar reglerna en torr faktarad, märkt `av:"reglerna"`.
Rapporten märks `av:"agent"`. **Blanda aldrig ihop dem i gränssnittet** — läsaren ska se
skillnaden mellan en mening en modell skrev och en rad en mall satte ihop.

Skriv rapporten ur kedjan, inte ur fantasin: varje påstående ska gå att peka på i ett `orsak`-fält.

## Rutor att känna till

| | |
|---|---|
| `POST /t/mohamad/fraga` | `{text}` → lägger ut frågan på pulsen |
| `POST /t/mohamad/delsvar` | `{orsak, text, motivering}` → agentens delsvar, bara i agentläge |
| `GET /t/mohamad/kedja` | frågorna med delsvar, valt svar, kyrkogård och dom |
| `POST /t/mohamad/extra` | `{rot, rubrik, text}` → reporterns löpsedel, bara i agentläge |
| `GET /t/mohamad/extra` | senaste löpsedlarna och vad som väntar på rapport |
| `GET /t/mohamad/lage` | vilket läge vi står i |
