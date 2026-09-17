#!/usr/bin/env bash
# Ateljén: teamen beställer bilder på pulsen, workshopledarens maskin gör dem (nyckeln lämnar aldrig den här datorn).
#   beställning:  {typ:"bildbeställning", nyttolast:{namn:"skylt", prompt:"..."}}
#   svar:         {typ:"bild-klar", nyttolast:{till, namn, url, prompt}, orsak}   eller {typ:"bild-nekad", nyttolast:{till, skäl}, orsak}
# Tak, för varje bild kostar pengar: MAX_PER_TEAM bilder per team, MAX_TOTALT totalt, en i taget.
set -uo pipefail
cd "$(dirname "$0")/.."
U=$(tr -d '[:space:]' < .board-url); TOKEN=$(tr -d '[:space:]' < .laget-token)
GEN="${ATELJE_GEN:-$HOME/.claude/skills/gemini-imagegen/scripts/generate_image.py}"
MAX_PER_TEAM="${ATELJE_MAX_PER_TEAM:-3}"; MAX_TOTALT="${ATELJE_MAX_TOTALT:-45}"
STIL="Stil: stämningsfull digital illustration av en nattlig nordisk småstad, mörk blåsvart bakgrund, varmt bärnstensfärgat ljus som accent, mjukt glödande fönster och skyltar, lätt isometrisk känsla, ren komposition. Ingen text i bilden, inga logotyper, inga verkliga personer, kvadratiskt format."
STATE=.atelje-state.json; [ -s "$STATE" ] || echo '{"sist":0,"per_team":{},"totalt":0}' > "$STATE"
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
st() { python3 - "$STATE" "$@" <<'PY'
import sys, json
f, cmd, *a = sys.argv[1:]; d = json.load(open(f))
if cmd == 'get': print(d.get(a[0], 0) if len(a) == 1 else d['per_team'].get(a[1], 0))
elif cmd == 'sist': d['sist'] = int(a[0]); json.dump(d, open(f, 'w'))
elif cmd == 'räkna': d['per_team'][a[0]] = d['per_team'].get(a[0], 0) + 1; d['totalt'] += 1; json.dump(d, open(f, 'w'))
PY
}
emit() { # typ, json-nyttolast, orsak
  printf '{"typ":"%s","nyttolast":%s,"orsak":%s}' "$1" "$2" "$3" > "$W/e.json"
  curl -s -o /dev/null -X POST "$U/api/messages" --data-urlencode "from=ateljen" --data-urlencode "channel=staden-puls" --data-urlencode "text@$W/e.json"
}
[ "$(st get sist)" = 0 ] && st sist "$(curl -s "$U/api/messages?limit=1" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)"
echo "$(date +%H:%M:%S) Ateljén öppen. Tak: $MAX_PER_TEAM per team, $MAX_TOTALT totalt. Gjorda hittills: $(st get totalt)"
while true; do
  curl -s "$U/api/puls?since=$(st get sist)&limit=50" > "$W/puls.json"
  python3 - "$W/puls.json" > "$W/jobb.tsv" <<'PY'
import sys, json, re
for e in json.load(open(sys.argv[1])):
    if e.get('typ') != 'bildbeställning' or e.get('från') == 'ateljen': continue
    n = e.get('nyttolast') or {}; n = n if isinstance(n, dict) else {'prompt': str(n)}
    namn = re.sub(r'[^a-zåäö0-9-]+', '-', str(n.get('namn') or 'bild').lower()).strip('-')[:30] or 'bild'
    prompt = re.sub(r'\s+', ' ', str(n.get('prompt') or n.get('text') or '')).strip()[:400]
    team = re.sub(r'[^a-zåäö0-9-]+', '-', e['från'].lower()).strip('-')[:40]
    print('\t'.join([str(e['id']), team, e['från'], namn, prompt]))
PY
  senaste=$(python3 -c "import json; l=json.load(open('$W/puls.json')); print(max([e['id'] for e in l] or [0]))")
  while IFS=$'\t' read -r id team fran namn prompt; do
    [ -n "$id" ] || continue
    if [ -z "$prompt" ]; then emit bild-nekad "{\"till\":\"$fran\",\"skäl\":\"beställningen saknar prompt\"}" "$id"; continue; fi
    if [ "$(st get per_team "$team")" -ge "$MAX_PER_TEAM" ]; then emit bild-nekad "{\"till\":\"$fran\",\"skäl\":\"ni har fått era $MAX_PER_TEAM bilder, Ateljén har en budget\"}" "$id"; echo "$(date +%H:%M:%S) nekad (tak) $fran"; continue; fi
    if [ "$(st get totalt)" -ge "$MAX_TOTALT" ]; then emit bild-nekad "{\"till\":\"$fran\",\"skäl\":\"Ateljéns budget för dagen är slut\"}" "$id"; continue; fi
    echo "$(date +%H:%M:%S) målar åt $fran: $namn — $prompt"
    if python3 "$GEN" --prompt "$prompt. $STIL" --output "$W/$id.png" > "$W/gen.log" 2>&1 && [ -s "$W/$id.png" ]; then
      sips -s format jpeg -s formatOptions 82 -Z 1024 "$W/$id.png" --out "$W/$id.jpg" >/dev/null 2>&1 || cp "$W/$id.png" "$W/$id.jpg"
      penc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$prompt")
      kod=$(curl -s -o "$W/up.json" -w '%{http_code}' -X POST "$U/api/bilder/$team/$namn.jpg" -H "Authorization: Bearer $TOKEN" -H "x-prompt: $penc" --data-binary @"$W/$id.jpg")
      if [ "$kod" = 201 ]; then st räkna "$team"
        python3 -c "import json,sys; print(json.dumps({'till':sys.argv[1],'namn':sys.argv[2],'url':'/bilder/%s/%s.jpg'%(sys.argv[3],sys.argv[2]),'prompt':sys.argv[4]}, ensure_ascii=False))" "$fran" "$namn" "$team" "$prompt" > "$W/nl.json"
        emit bild-klar "$(cat "$W/nl.json")" "$id"; echo "$(date +%H:%M:%S) klar: $U/bilder/$team/$namn.jpg ($(st get totalt)/$MAX_TOTALT)"
      else echo "$(date +%H:%M:%S) uppladdning misslyckades [$kod]"; emit bild-nekad "{\"till\":\"$fran\",\"skäl\":\"uppladdningen misslyckades, försök igen\"}" "$id"; fi
    else echo "$(date +%H:%M:%S) målningen misslyckades: $(tail -c 200 "$W/gen.log")"; emit bild-nekad "{\"till\":\"$fran\",\"skäl\":\"bilden gick inte att måla, prova en annan beskrivning\"}" "$id"; fi
  done < "$W/jobb.tsv"
  [ "$senaste" -gt "$(st get sist)" ] && st sist "$senaste"
  sleep 8
done
