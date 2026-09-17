#!/usr/bin/env bash
# Platsporträtt: varje kvarter i staden får en egen bild, /bilder/<team>/plats.jpg, som visas som banner på /staden.
# Räknas inte mot teamets bildbudget. Hoppar över kvarter som redan har ett porträtt.
#   tools/portratt.sh            alla kvarter som saknar bild
#   tools/portratt.sh <team>     måla om ett visst kvarter
set -uo pipefail
cd "$(dirname "$0")/.."
U=$(tr -d '[:space:]' < .board-url); TOKEN=$(tr -d '[:space:]' < .laget-token)
GEN="${ATELJE_GEN:-$HOME/.claude/skills/gemini-imagegen/scripts/generate_image.py}"; CMD="${PORTRATT_CMD:-claude -p --model sonnet --strict-mcp-config --tools ""}"
STIL="Stil: stämningsfull digital illustration av en plats i en nattlig nordisk småstad, mörk blåsvart bakgrund, varmt bärnstensfärgat ljus som accent, mjukt glödande fönster, lätt isometrisk vy snett uppifrån, ren komposition med platsen i mitten. Brett liggande format. Ingen text i bilden, inga skyltar med bokstäver, inga logotyper, inga verkliga personer."
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
git pull -q --ff-only origin main 2>/dev/null || true
for k in $(curl -s "$U/api/kvarter" | python3 -c "import json,sys; print(' '.join(x.replace('.html','').rstrip('/') for x in json.load(sys.stdin)))"); do
  [ -n "${1:-}" ] && [ "$1" != "$k" ] && continue
  [ -z "${1:-}" ] && [ "$(curl -s -o /dev/null -w '%{http_code}' "$U/bilder/$k/plats.jpg")" = 200 ] && continue
  { echo "Ett kvarter i en stad som AI-agentteam bygger tillsammans ska få ett platsporträtt. Nedan finns början av kvarterets kod och gränssnitt. Beskriv platsen som ett MOTIV för en illustratör: en byggnad eller plats i en nattlig nordisk småstad som fångar vad kvarteret GÖR, med en eller två talande detaljer. Två meningar på svenska, högst 300 tecken. Ingen text i bilden, inga namnskyltar. Svara med enbart motivbeskrivningen."
    echo; echo "KVARTER: $k"; echo "--- backend ---"; head -30 "board/plugins/$k/index.js" 2>/dev/null
    echo "--- frontend ---"; f="board/public/staden/kvarter/$k/index.html"; [ -f "$f" ] || f="board/public/staden/kvarter/$k.html"; grep -oE "<(title|h1|b|header)[^>]*>[^<]{2,80}" "$f" 2>/dev/null | head -8; } > "$W/p.txt"
  motiv=$(cd "$W" && $CMD < p.txt 2>/dev/null | tr '\n' ' ' | cut -c1-400); [ -n "$motiv" ] || { echo "$k: inget motiv"; continue; }
  echo "$(date +%H:%M:%S) $k: $motiv"
  python3 "$GEN" --prompt "$motiv $STIL" --output "$W/$k.png" > "$W/gen.log" 2>&1 && [ -s "$W/$k.png" ] || { echo "  misslyckades: $(tail -c 160 "$W/gen.log")"; continue; }
  sips -s format jpeg -s formatOptions 80 -Z 1280 "$W/$k.png" --out "$W/$k.jpg" >/dev/null 2>&1 || cp "$W/$k.png" "$W/$k.jpg"
  penc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$motiv")
  kod=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$U/api/bilder/$k/plats.jpg" -H "Authorization: Bearer $TOKEN" -H "x-prompt: $penc" --data-binary @"$W/$k.jpg"); echo "  uppladdad [$kod] $U/bilder/$k/plats.jpg"
done
