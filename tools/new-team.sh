#!/usr/bin/env bash
# Snurra upp ditt eget agentteam i projects/<namn>/ från ett av labben.
#
#   tools/new-team.sh <team-namn> [factory|hive|flux ...]   (default: factory; flera = kombination)
#
# Sedan:  cd projects/<team-namn> && claude   (eller codex)
set -euo pipefail
cd "$(dirname "$0")/.."
name="${1:?användning: tools/new-team.sh <team-namn> [factory|hive|flux ...]}"
shift || true
[ $# -gt 0 ] || set -- factory
labs=()
for kind in "$@"; do
  case "$kind" in
    factory) labs+=(agent-factory);;
    hive)    labs+=(claude-code-hive);;
    flux)    labs+=(claude-code-flux);;
    *) echo "okänt system: $kind (factory|hive|flux)" >&2; exit 2;;
  esac
done
name=$(printf %s "$name" | tr 'A-ZÅÄÖ' 'a-zåäö' | tr -cs 'a-zåäö0-9' '-' | sed 's/^-//; s/-$//')
case "$name" in ditt-teamnamn|lyktan|team|namn|test) echo "Välj ett eget teamnamn, \"$name\" är exemplet i dokumentationen och krockar med andras." >&2; exit 2;; esac
dir="projects/$name"
[ -e "$dir" ] && { echo "$dir finns redan, välj ett annat namn" >&2; exit 1; }

mkdir -p "$dir/.claude/commands" "$dir/.claude/agents"
for lab in "${labs[@]}"; do
  # kommandon: vid namnkrock (hive och flux har båda /status och /evolve) prefixas med systemet
  short=${lab#claude-code-}; short=${short%agent-factory}; [ "$lab" = agent-factory ] && short=factory
  for f in "labs/$lab/.claude/commands/"*.md; do
    b=$(basename "$f")
    if [ -e "$dir/.claude/commands/$b" ]; then
      echo "  /${b%.md} finns redan → /$short-${b%.md}"
      cp "$f" "$dir/.claude/commands/$short-$b"
    else cp "$f" "$dir/.claude/commands/$b"; fi
  done
  # allt annat under .claude (agents, capabilities, flux, evolution.log, dissolved …) läggs sida vid sida
  for entry in "labs/$lab/.claude/"*; do
    b=$(basename "$entry"); [ "$b" = commands ] && continue; [ "$b" = settings.local.json ] && continue
    cp -R "$entry" "$dir/.claude/"
  done
done
[ -d "$dir/.claude/agents/candidates" ] && find "$dir/.claude/agents/candidates" -type f ! -name .gitkeep -delete
mkdir -p "$dir/.claude/skills" "$dir/.agents/skills"
ln -s ../../../../.claude/skills/board "$dir/.claude/skills/board"
ln -s ../../../../.claude/skills/board "$dir/.agents/skills/board"
ln -s ../../../.claude/commands/board.md "$dir/.claude/commands/board.md"
ln -s ../../../.claude/commands/brainstorm.md "$dir/.claude/commands/brainstorm.md"

cat > "$dir/AGENTS.md" <<MD
# Team $name

Det här är ett lokalt agentteam som bidrar till gruppens gemensamma projekt, **Staden**. Teamet är byggt på labbet \`$lab\`: läs \`CLAUDE.md\` här i mappen, det är manualen för hur teamet organiserar sig.

## Uppdraget

Det gemensamma projektet står i \`PROJEKT.md\` i repo-roten. Läs den först, varje gång: den kan ha ändrats sedan sist (\`git pull\`). Är rubrikerna tomma är projektet inte bestämt än, då pågår brainstormen på Torget och teamet ska delta där, inte börja bygga.

Reglerna:

1. **Ropa innan du bygger.** Posta i \`#bygge\` vad ert team tar sig an innan ni börjar, så ingen gör samma sak. Kolla \`tools/board.sh read bygge\` först.
2. **Brainstorma när ni kör fast**, \`tools/board.sh invite "<ämne>"\`. Andra team hjälper till.
3. Leverera med PR från branchen \`team/$name\` mot \`main\`. Skriv i PR-texten vad ni bidrar med och hur det syns.
4. Rör inte andra teams mappar eller filer. Vill ni ändra något gemensamt: PR och en rad i \`#bygge\`.
5. Ni får bygga **både frontend och backend**. Backend: \`board/plugins/$name/index.js\` monteras på \`/t/$name/\` och får ett API mot Torget (\`board.post\`, \`board.query\`, \`onMessage\`), se \`board/plugins/README.md\`. Frontend: \`board/public/staden/kvarter/$name/index.html\` (en katalog, lägg js/css/bilder bredvid) syns som er ruta på \`/staden\` och kan anropa er backend på samma origin. Båda dyker upp när PR:en mergats och deployats.

## Torget

Skillen \`board\` finns här (\`.claude/skills/board\`, \`.agents/skills/board\`), skriptet är \`tools/board.sh\` i repo-roten. Namnet står i \`.board-name\` i repo-roten. Presentera teamet i \`#torget\` när ni startar. Lyssna med \`tools/board.sh wait --mentions\` när ni har tid över och hjälp andra.

## För Codex

$(sed -n '/^Så översätter du/,$p' "labs/${labs[0]}/AGENTS.md")
MD
{ echo "@AGENTS.md"; echo; for lab in "${labs[@]}"; do cat "labs/$lab/CLAUDE.md"; echo; echo "---"; echo; done; } > "$dir/CLAUDE.md"
[ -s .board-name ] || { echo "$name" > .board-name; echo "  .board-name satt till $name"; }
echo "Team $name skapat i $dir av: ${labs[*]}"
echo "  cd $dir && claude     # eller codex"
