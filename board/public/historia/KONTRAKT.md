# Historiksidan: kontrakt för sektionerna

Sidan `/historia` är en gåva till deltagarna i HighFive-workshopen 17 september 2026: en historik över hur staden växte fram.
`index.html`, `stil.css` och `karna.js` är stommen och får INTE ändras av en sektion. Varje sektion är EN fil, `sektion-<namn>.js`.

## Så registrerar sig en sektion

```js
Historia.sektioner.<namn> = {
  titel: 'Rubrik i serif',            // visas som <h2>
  meny: 'Kort ord',                    // valfritt, för toppmenyn
  ingang: 'En eller två meningar under rubriken.',
  rendera(el, data, api, kronika) { /* fyll el. Får vara async. */ },
};
```

`api` (se karna.js): `kl(ts)` → "HH:MM" svensk tid · `esc(s)` · `tal(n)` → "4 159" · `kvarter(team)` · `namn(team)` → kvartersnamn ·
`färg(team)` → stabil färg per team · `hoppa(ts)` → spola filmen dit och skrolla upp · `påTid(fn)` → lyssna på filmens klocka ·
`tick(ts)` → (bara replay) berätta var filmen är · `el(tagg, attr, barn)` → DOM-hjälpare (attr.text sätter textContent).

## Regler

1. **Ingen byggkedja, inga beroenden.** Vanlig JavaScript i en IIFE, inga import, inga bibliotek, inget CDN. Canvas eller SVG för grafik.
2. **All text ur data är opålitlig.** Inläggstext, PR-titlar, namn, citat: använd `textContent` / `api.el(..., {text})` eller `api.esc()`. Aldrig rå `innerHTML` med data.
3. **Färger bara via CSS-variablerna i stil.css** (`--bg --panel --panel2 --line --fg --dim --svag --accent --me --lila --röd`) plus `api.färg(team)` för team. Text får aldrig bära identitet med enbart färg: skriv alltid ut team- eller kvartersnamnet.
4. **Egna CSS-regler** läggs i ett `<style>` som sektionen själv lägger till, med ALLA selektorer prefixade `.h-<namn>` så sektioner inte krockar.
5. **Mobil och storskärm.** Ska fungera från 360 px till 2560 px. Inget horisontellt sidskroll. `prefers-reduced-motion` ska respekteras (ingen autostart av animation då).
6. **Svenska** med korrekta å, ä, ö. Inga emojier. Saklig, varm ton. Hitta inte på något: varje siffra och påstående ska komma ur `data` (eller `kronika`).
7. **Kvarter kontra team:** `team` är det tekniska namnet (`willebus`), `namn` är vad teamet döpte kvarteret till (`Genomfarten`). Visa båda första gången. `ledning: true` betyder att workshopledningen byggde kvarteret, inte ett deltagarteam: håll isär dem.
8. Tider: `ts` är millisekunder sedan 1970. `data.puls` använder SEKUNDER sedan `data.meta.start` för att spara plats.
9. Kontrollera med `node --check board/public/historia/sektion-<namn>.js`. Du kan INTE se sidan renderad, så skriv defensivt: tomma listor, `null`-fält (`live`, `porträtt`, `mörker`, `citat`, `invånare` kan vara null), långa texter.

## data.json

- `meta`: {datum: str, start: int, slut: int, genererad: int, tidszon: str}
- `tal`: {inlägg: int, pulshändelser: int, i_kedja: int, djup4: int, händelsetyper: int, avsändare: int, kanaler: int, pr: int, team_med_pr: int, forkar: int, rader_kod: int, kvarter: int, tidningsnummer: int, radiosändningar: int, hälsningar: int, observationer: int, bilder: int, repliker_på_gatan: int, timmar: float}
- `minuter`: [{t: int, torget: int, bygge: int, hjalp: int, brainstorm: int, puls: int, gatan: int, ovrigt: int}, … ×439]
- `kvarter`: [{team: str, namn: str, ledning: bool, live: int, pr: [, … ×0], av: [, … ×0], rader: int, händelser: int, fått: int, gett: int, typer: [[str, … ×2], … ×1], invånare: {namn: str, roll: str}, citat: {ts: int, text: str}, porträtt: str, mörker: NoneType}, … ×18]
- `typer`: [str, … ×74]
- `avsändare`: [str, … ×21]
- `puls`: [[int, … ×5], … ×3693]
- `nätverk`: [{från: str, till: str, antal: int}, … ×74]
- `milstolpar`: [{ts: int, sort: str, rubrik: str, text: str}, … ×30]
- `verktyg`: [{ts: int, ämne: str}, … ×32]
- `rubriker`: [{ts: int, nummer: int, rubrik: str, ingress: str, bild: str}, … ×21]
- `rekord`: {djupaste_kedja: {djup: int, team: int, kedja: [{typ: str, från: str, id: int}, … ×4], ts: int}, livligaste_minut: {t: int, antal: int}, vanligaste_typer: [[str, … ×2], … ×12], flitigaste: [[str, … ×2], … ×8], mest_reagerad_på: [[str, … ×2], … ×8]}

Förklaringar:
- `minuter`: en rad per minut, antal inlägg per kategori (`puls` = händelser på Stadens puls, `gatan` = invånarnas repliker).
- `puls`: en rad per händelse: `[sekunder_sedan_start, index i data.typer, index i data.avsändare (den som postade), index i data.avsändare för den som ORSAKADE händelsen eller -1, kedjedjup 1–4]`. En rad med orsak ≥ 0 betyder: avsändaren reagerade på orsakarens händelse.
- `nätverk`: `från` orsakade, `till` reagerade, `antal` gånger.
- `kvarter[].fått` = gånger andra reagerat på kvarteret (det som gav poäng under dagen), `gett` = gånger det reagerat på andra.
- `kvarter[].typer`: de fem vanligaste händelsetyperna, `[typ, antal]`.
- `milstolpar[].sort`: start | beslut | puls | kvarter | rekord | ledning | volym | slut.
- `verktyg`: ledningens commits under dagen (det workshopledarens agent byggde medan teamen byggde staden).
- `rubriker`: Stadsbladets huvudrubriker, en per nummer. `bild` är en URL eller tom.
- `rekord.vanligaste_typer`, `flitigaste`, `mest_reagerad_på`: listor av `[namn, antal]`.

Ett kvarter som exempel:

```json
{
 "team": "willebus",
 "namn": "Genomfarten",
 "ledning": false,
 "live": 1789632875000,
 "pr": [
  {
   "nr": 5,
   "titel": "Genomfarten – polisen och jakten på #staden-puls",
   "ts": 1789632875000,
   "rader": 253,
   "av": "gamebacon"
  },
  {
   "nr": 8,
   "titel": "Genomfarten blir attention-huvud (delsvar med ordningsmaktens vinkel) och reagerar på Elverkets strömavbrott",
   "ts": 1789633705000,
   "rader": 1295,
   "av": "gamebacon"
  },
  {
   "nr": 11,
   "titel": "Genomfarten kopplar in Godisfabriken (@christian): kupp mot lagret ger jakten ett motiv, godis-klart utlöser ny kupp, socker-slut kvitteras",
   "ts": 1789633976000,
   "rader": 34,
   "av": "gamebacon"
  },
  {
   "nr": 14,
   "titel": "Genomfarten reagerar på hela pulsen: vilket kvarters kupp som helst blir en jakt vi tar upp, och stadens svar/godkänt lugnar patrullerna",
   "ts": 1789635444000,
   "rader": 174,
   "av": "gamebacon"
  },
  {
   "nr": 24,
   "titel": "Kasinot (spelbar enarmad bandit med jackpot + razzia), vadslå på jakten, vägval-röstning, storlarm vid wanted 5, nattliv från Klub Lyktan, och effekter (siren, ",
   "ts": 1789636839000,
   "rader": 405,
   "av": "gamebacon"
  },
  {
   "nr": 33,
   "titel": "Casinot får blackjack — ett delat bord (Nytt/Hit/Stanna) som rummet spelar tillsammans, med riktiga kort och givare som drar till 17",
   "ts": 1789637386000,
   "rader": 97,
   "av": "gamebacon"
  },
  {
   "nr": 37,
   "titel": "Snyggare UI: hero med mottot The house always wins, tydliga förklaringar, flikar för de tre spelen, animerad kortgivning och roulettehjul, samt en leaderboard p",
   "ts": 1789638386000,
   "rader": 266,
   "av": "gamebacon"
  },
  {
   "nr": 47,
   "titel": "Video poker (Jacks or Better) med håll/dra, fix av flik-krasch, auto-alias så ingen behöver
```

## kronika.json (skrivs av krönikören, läses av sektion-kronika.js)

```json
{"rubrik": "...", "ingress": "...", "kapitel": [{"tid": "09:38–09:51", "rubrik": "...", "stycken": ["...", "..."], "citat": {"text": "...", "vem": "..."} eller null, "hoppa_ts": 1789630000000 eller null}]}
```
