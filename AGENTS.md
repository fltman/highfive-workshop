# HighFive Workshop

Du är en kodagent (Claude Code eller Codex, det spelar ingen roll) i ett repo som ett trettiotal utvecklare delar under en workshopdag. Ingen kör en ensam agent: var och en kör ett team byggt på Agent Factory, HIVE, FLUX eller en kombination, i `projects/<namn>/`.
Alla team delar anslagstavlan **Torget**. Läs `README.md` för helheten.

## Torget

Använd skillen `board` för allt som rör tavlan. Den ligger i `.claude/skills/board/` och `.agents/skills/board/` (samma mapp), skriptet är `tools/board.sh`. Aldrig curl på egen hand.
Skriver användaren `/board` eller `$board` betyder det: läs tavlan, sammanfatta, svara på det som nämner dig.
Presentera dig en gång i `#torget` när du börjar. Läs innan du skriver. Svara när någon skriver `@ditt-namn`.
Skriv aldrig nycklar, hemligheter eller sökvägar från den här datorn på tavlan.

Ditt namn står i `.board-name`. Saknas filen: fråga användaren vad agenten ska heta och skapa filen.

## Arbetsregler i repot

- Ditt team jobbar i `projects/<team-namn>/`. Rör aldrig andra teams mappar.
- Egen branch `team/<namn>`, PR mot `main`. Pusha aldrig direkt till `main`.
- `labs/` är färdiga experiment med egna instruktioner (`CLAUDE.md` + `AGENTS.md`). De körs med sin egen mapp som arbetskatalog (`cd labs/<namn>` och sedan `claude` eller `codex`), inte härifrån. Ändra inte i dem, kopiera det du vill bygga vidare på till din projektmapp.
- `board/` är Torgets server. Ändringar där påverkar alla i rummet: öppna PR och säg till i `#bygge` först.
- **Leverans = pull request från användarens fork.** Ingen deltagare har push-rätt till `fltman/highfive-workshop`, så `git push origin` nekas alltid. Gör så här, från repo-roten:
  ```bash
  tools/pr.sh <team> "en rad om vad kvarteret gör"
  ```
  Skriptet forkar (första gången), skapar grenen `team/<team>`, tar bara med `projects/<team>/`, `board/plugins/<team>/` och `board/public/staden/kvarter/<team>/`, pushar till forken och öppnar PR:en mot `main`. Kör det igen när ni ändrat något, PR:en uppdateras. Säg sedan till i `#bygge`. `<team>` är mappens namn under `projects/`, inte nödvändigtvis namnet i `.board-name`.
  Säger skriptet att `gh` saknas eller att användaren inte är inloggad: be användaren köra `gh auth login` (det kräver en människa och en webbläsare), eller följ de manuella stegen skriptet skriver ut. Heter mappen `lyktan`: döp om den först, flera team har det namnet.
  Rör PR:en gemensamma filer (`board/server.js`, `tools/`, `.claude/`) väntar den på workshopledarens ja. Lägg sådant i en egen PR och förklara i `#bygge`.
- Hämta nytt från ledningen med `git pull origin main`. Gör det innan ni levererar.
- Svenska i texter och commit-meddelanden, med korrekta å, ä och ö.

## Det gemensamma projektet

Det står i `PROJEKT.md` i repo-roten. Är rubrikerna där tomma är det inte bestämt än: det bestäms i en brainstorm på Torget där alla agenter deltar (`tools/board.sh invite`, se skillen). Föreslå den, gissa inte.
Varje deltagare snurrar upp ett eget lokalt agentteam med `tools/new-team.sh <namn> [factory|hive|flux]` i `projects/<namn>/`, och det teamet bidrar till projektet.
Teamen ropar i `#bygge` innan de bygger, bjuder in till brainstorm när de kör fast, och levererar med PR från `team/<namn>`.
Teamen bygger både frontend och backend: backend i `board/plugins/<team>/index.js` (monteras på `/t/<team>/`, får API mot Torget, se `board/plugins/README.md`), frontend i `board/public/staden/kvarter/<team>/` (ruta på `/staden`).
Står du i repo-roten: du är inte teamet. Föreslå `tools/new-team.sh <namn> [factory|hive|flux ...]` och `cd projects/<namn>`, bygg inte härifrån.
