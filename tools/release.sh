#!/usr/bin/env bash
# Release-verktyg för workshopledaren: granska, merga och deploya PR:ar. Kräver gh (inloggad) och ssh till servern.
#
#   tools/release.sh list                 öppna PR:ar med teamnamn, filer och om de håller sig inom sin mapp
#   tools/release.sh check <nr>           regelkoll av en PR: tillåtna sökvägar, hemligheter, tester om servern rörs. Exit 0 = ok
#   tools/release.sh diff <nr>            visa diffen
#   tools/release.sh merge <nr>           squash-merga (kör check först)
#   tools/release.sh deploy               git pull på main + deploy/deploy.sh + hälsokoll
#   tools/release.sh announce <text>      posta i #bygge som release-agenten
#
# Regler (samma som i README): en PR får bara röra projects/<team>/**, board/plugins/<team>/** (backend)
# och board/public/staden/kvarter/<team>.html eller board/public/staden/kvarter/<team>/** (frontend).
# Allt annat (board/server.js, tools/, .claude/, README …) kräver att en människa säger ja: check svarar exit 2 = "kräver ledarens ok".
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${REPO:-fltman/highfive-workshop}"
cmd="${1:-list}"; shift || true

files_of() { gh pr view "$1" -R "$REPO" --json files -q '.files[].path'; }
team_of()  { gh pr view "$1" -R "$REPO" --json headRefName -q '.headRefName' | sed -E 's|^team/||; s|[^a-zåäö0-9-].*||'; }

case "$cmd" in
  list)
    gh pr list -R "$REPO" --json number,title,headRefName,author,files,createdAt \
      --template '{{range .}}#{{.number}}  {{.title}}  [{{.headRefName}}] {{.author.login}}  {{len .files}} filer{{"\n"}}{{end}}'
    ;;
  diff) gh pr diff "$1" -R "$REPO";;
  check)
    nr="${1:?pr-nummer}"; team=$(team_of "$nr"); bad=0; needs_ok=0
    echo "PR #$nr  team: ${team:-?}"
    while IFS= read -r f; do
      case "$f" in
        projects/"$team"/*|board/plugins/"$team"/*|board/public/staden/kvarter/"$team".html|board/public/staden/kvarter/"$team"/*) echo "  ok       $f";;
        projects/*|board/plugins/*|board/public/staden/kvarter/*) echo "  ANNAT TEAMS FIL  $f"; bad=1;;
        *) echo "  gemensam $f"; needs_ok=1;;
      esac
    done < <(files_of "$nr")
    # hemligheter i diffen
    if gh pr diff "$nr" -R "$REPO" | grep -E '^\+' | grep -qE 'sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[bp]-|-----BEGIN [A-Z ]*PRIVATE KEY|OPENROUTER_API_KEY=|ANTHROPIC_API_KEY='; then
      echo "  HEMLIGHET i diffen"; bad=1
    fi
    # servern rörd → tester
    if files_of "$nr" | grep -q '^board/'; then
      echo "  board/ rörs → kör tester mot PR-grenen (plugins laddas av servern)"
      gh pr checkout "$nr" -R "$REPO" >/dev/null 2>&1 || true
      # Hård tidsgräns och utdata till fil: en testserver som överlever ett fallerat test håller annars röret öppet för evigt.
      ut=$(mktemp); (cd board && perl -e 'alarm 90; exec @ARGV' node test.mjs > "$ut" 2>&1); rc=$?
      pkill -f "board/server.js" 2>/dev/null || true
      tail -1 "$ut"; [ $rc -eq 0 ] || { echo "  TESTERNA FALLERADE eller hängde (exit $rc):"; grep -E "✗|Error|error" "$ut" | head -5; bad=1; }
      git checkout -q main
    fi
    [ $bad -eq 1 ] && { echo "RESULTAT: stopp"; exit 1; }
    [ $needs_ok -eq 1 ] && { echo "RESULTAT: kräver ledarens ok (gemensamma filer)"; exit 2; }
    echo "RESULTAT: ok"
    ;;
  merge)
    nr="${1:?pr-nummer}"
    tools/release.sh check "$nr" || { rc=$?; [ $rc -eq 2 ] && [ "${FORCE:-}" = 1 ] || exit $rc; }
    gh pr merge "$nr" -R "$REPO" --squash --delete-branch
    echo "mergad: #$nr"
    ;;
  deploy)
    git checkout -q main && git pull -q --ff-only origin main
    deploy/deploy.sh 2>&1 | tail -2
    curl -sS --max-time 10 "$(tr -d '[:space:]' < .board-url)/api/health"; echo
    ;;
  announce)
    BOARD_NAME=release-agenten tools/board.sh post bygge "$*"
    ;;
  *) sed -n '2,14p' "$0"; exit 2;;
esac
