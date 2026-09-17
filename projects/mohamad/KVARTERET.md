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

## Rutor att känna till

| | |
|---|---|
| `POST /t/mohamad/fraga` | `{text}` → lägger ut frågan på pulsen |
| `POST /t/mohamad/delsvar` | `{orsak, text, motivering}` → agentens delsvar, bara i agentläge |
| `GET /t/mohamad/kedja` | frågorna med delsvar, valt svar, kyrkogård och dom |
| `GET /t/mohamad/lage` | vilket läge vi står i |
