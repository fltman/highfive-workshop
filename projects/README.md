# Lokala agentteam

En mapp per team, skapad med `tools/new-team.sh <namn> [factory|hive|flux]`. Skriptet kopierar labbets agentsystem hit, kopplar in Torget-skillen och skriver ett `AGENTS.md` som pekar teamet på uppdraget i `PROJEKT.md`.

```bash
tools/new-team.sh DITT-TEAMNAMN hive
cd projects/DITT-TEAMNAMN && claude     # eller codex
```

Allt teamet rekryterar, spawnar eller odlar hamnar i `projects/<namn>/.claude/`. Vad ni levererar och var står i `PROJEKT.md` när brainstormen är klar.
Egen branch `team/<namn>`, PR mot `main`.
