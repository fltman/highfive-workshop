#!/usr/bin/env bash
# Ödet: spelledaragenten. Läser vilka kvarter som lever och vad de lyssnar på, och kastar in EN stadshändelse i taget
# på #staden-puls, vald så att något riktigt kvarter har skäl att reagera. Körs av workshopledaren i bakgrunden.
#   tools/odet.sh          loopar (var ODET_INTERVALL:e sekund, default 150)
#   tools/odet.sh en       en händelse, sedan klart
set -uo pipefail
cd "$(dirname "$0")/.."
U=$(tr -d '[:space:]' < .board-url)
CMD="${ODET_CMD:-claude -p --model sonnet --strict-mcp-config --tools ""}"; INTERVALL="${ODET_INTERVALL:-150}"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT

omgang() {
  git pull -q --ff-only origin main 2>/dev/null || true
  curl -s "$U/api/puls?limit=30" > "$W/puls.json"; curl -s "$U/api/poang" > "$W/poang.json"
  : > "$W/kvarter.txt"
  for f in board/plugins/*/index.js; do t=$(basename "$(dirname "$f")"); [ "$t" = torget ] && continue
    { echo "=== kvarter: $t ==="; grep -nE "^//|typ ?===|typ ?!==|emit\(|includes\(e\.typ|case '" "$f" | head -40; echo; } >> "$W/kvarter.txt"; done
  {
    cat <<'PROMPT'
Du är Ödet, spelledaren i en stad som ett trettiotal AI-agentteam bygger tillsammans under en workshop. Staden är en händelsebuss: kvarter (plugins) lyssnar på händelser med en viss "typ" och reagerar med egna händelser. Din uppgift är att kasta in EN händelse som gör att staden rör på sig: något riktigt kvarter ska ha skäl att reagera, helst flera, helst en kedja genom olika team.

Svara med ENBART ett JSON-objekt, ingen annan text:
{"typ": "...", "nyttolast": {...}, "varför": "en mening om vilka kvarter du tror reagerar"}

Regler:
- "typ" MÅSTE vara en typ som minst ett levande kvarter faktiskt lyssnar på enligt koden nedan (leta efter e.typ === '...'). Hitta inte på typer ingen hör.
- Variera. Titta på de senaste händelserna och välj inte samma typ som du själv (från "ödet") postade senast, om det finns alternativ.
- Är typen "fråga": nyttolast {"text": "...", "varv": 1}. Ställ en riktig, konkret fråga som staden kan ha delade meningar om, gärna om staden själv, dess kvarter, agenter, samarbete, eller något som hänt på pulsen. Högst 200 tecken. Ingen ja/nej-fråga.
- Är typen något annat: läs i kvarterets kod vilka fält i nyttolasten det förväntar sig och fyll i dem trovärdigt, med ett uns humor. Staden är svensk. Korrekta å, ä och ö.
- Inga emojier. Ingen metatext. Bara händelsen.

LEVANDE KVARTER OCH VAD DERAS KOD LYSSNAR PÅ OCH POSTAR:
PROMPT
    cat "$W/kvarter.txt"; printf '\n\nSENASTE HÄNDELSERNA PÅ PULSEN (äldst först):\n'; cat "$W/puls.json"; printf '\n\nPOÄNGSTÄLLNING:\n'; cat "$W/poang.json"
  } > "$W/prompt.txt"
  (cd "$W" && $CMD < prompt.txt > svar.txt 2> fel.txt) || { echo "$(date +%H:%M:%S) Ödet teg: $(head -c 160 "$W/fel.txt")"; return 1; }
  python3 - "$W/svar.txt" > "$W/ut.json" <<'PY' || { echo "$(date +%H:%M:%S) kunde inte tolka Ödets svar"; return 1; }
import sys, json, re
t = open(sys.argv[1], encoding='utf-8').read(); d = json.loads(re.search(r'\{.*\}', t, re.S).group(0))
print(json.dumps({"typ": d["typ"], "nyttolast": d.get("nyttolast")}, ensure_ascii=False)); sys.stderr.write(d.get("varför", "") + "\n")
PY
  kod=$(curl -s -o "$W/post.txt" -w '%{http_code}' -X POST "$U/api/messages" -H 'Accept: text/plain' --data-urlencode "from=ödet" --data-urlencode "channel=staden-puls" --data-urlencode "text@$W/ut.json")
  echo "$(date +%H:%M:%S) [$kod] $(head -c 260 "$W/post.txt")"
}
if [ "${1:-}" = en ]; then omgang; exit $?; fi
while true; do omgang; sleep "$INTERVALL"; done
