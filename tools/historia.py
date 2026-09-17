#!/usr/bin/env python3
"""Destillerar workshopdagen till EN fil som historiksidan spelar upp: board/public/historia/data.json

    tools/historia.py <katalog med serverns data> <pr.json från gh> <git-logg> <forkar.json>

Indata är en kopia av /var/lib/torget (messages.jsonl, tidningen.json, radio.json, observatoriet.json, invanare.json,
bilder/index.json), listan över mergade pull requests, git-loggen och forkarna. IP-adresser i loggen läses aldrig ut.
Allt i utdatat är sådant som redan var publikt under dagen: inlägg på tavlan, händelser på pulsen, PR:ar på GitHub.
"""
import collections, json, re, sys, time
from datetime import datetime, timezone

DATA, PRFIL, GITLOGG, FORKAR = sys.argv[1:5]
UT = 'board/public/historia/data.json'
LEDNING = {'anders-agent', 'ödet', 'release-agenten', 'torget', 'ateljen', 'stadsbladet', 'radion', 'observatoriet', 'fusionen'}
KVARTERSNAMN = {  # vad teamen själva döpte sina kvarter till (ur PR-titlar och kodhuvuden)
    'willebus': 'Genomfarten', 'lp': 'Elverket', 'mybank': 'MyBank', 'markus': 'Vaktkuren och Djupet', 'zero-cool': 'Bakdörren och Smältan',
    'highfive': 'Arkivet', 'ipat': 'Lyktstolpen och Vattenlandet', 'team-jacob': 'Domkapitlet, senare Juryn', 'markus-codex': 'Stadskartan',
    'christian': 'Godisfabriken', 'mohamad': 'Frågeporten', 'tjoho': 'Svärmen', 'fusionen': 'Fusionsreaktorn', 'observatoriet': 'Observatoriet',
    'radion': 'Radio Torget', 'stadsbladet': 'Stadsbladet', 'ateljen': 'Ateljén', 'torget': 'Torget'}

ms = [json.loads(l) for l in open(f'{DATA}/messages.jsonl', encoding='utf-8') if l.strip()]
for m in ms:
    m.pop('ip', None)
iso = lambda s: int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp() * 1000)
# dagen: från första riktiga inlägget (välkomsthälsningen skrevs kvällen före) till sista
dag = [m for m in ms if m['ts'] > ms[1]['ts'] - 60000]
START, SLUT = dag[0]['ts'], dag[-1]['ts']


def puls(m):
    try:
        e = json.loads(m['text'])
        return e if isinstance(e, dict) and isinstance(e.get('typ'), str) else None
    except Exception:
        return None


händelser = {}
for m in dag:
    if m['channel'] == 'staden-puls':
        e = puls(m)
        if e:
            händelser[m['id']] = {'id': m['id'], 'ts': m['ts'], 'typ': e['typ'], 'från': e.get('från') or m['from'], 'orsak': e.get('orsak'), 'djup': e.get('djup') or 1, 'nl': e.get('nyttolast')}

# ---------- per minut ----------
def kategori(k):
    if k == 'staden-puls': return 'puls'
    if k == 'gatan': return 'gatan'
    if k.startswith('brainstorm'): return 'brainstorm'
    if k in ('torget', 'bygge', 'hjälp'): return {'hjälp': 'hjalp'}.get(k, k)
    return 'ovrigt'

minuter = collections.OrderedDict()
t = START // 60000 * 60000
while t <= SLUT:
    minuter[t] = {'t': t, 'torget': 0, 'bygge': 0, 'hjalp': 0, 'brainstorm': 0, 'puls': 0, 'gatan': 0, 'ovrigt': 0}; t += 60000
for m in dag:
    minuter[m['ts'] // 60000 * 60000][kategori(m['channel'])] += 1

# ---------- pull requests och kvarter ----------
pr = [p for p in json.load(open(PRFIL)) if p['headRefName'].startswith('team/') and p['headRefName'] != 'team/prov' and p['headRefName'] != 'team/provleverans']
per_team = collections.defaultdict(list)
for p in pr:
    per_team[p['headRefName'][5:]].append({'nr': p['number'], 'titel': re.sub(r'^[a-zåäö0-9-]+:\s*', '', p['title'])[:160], 'ts': iso(p['mergedAt']), 'rader': p['additions'], 'av': p['author']['login']})
for l in per_team.values():
    l.sort(key=lambda x: x['ts'])

inv = {b['team']: b for b in json.load(open(f'{DATA}/invanare.json')).values()} if isinstance(json.load(open(f'{DATA}/invanare.json')), dict) else {}
bilder = json.load(open(f'{DATA}/bilder/index.json'))
porträtt = {b['team'] for b in bilder if b['fil'] == 'plats.jpg'}
obs = json.load(open(f'{DATA}/observatoriet.json'))['observationer']
senaste_obs = {}
for o in reversed(obs):
    senaste_obs[o['om']] = o

postat = collections.Counter(e['från'] for e in händelser.values())
fått, gett, nät = collections.Counter(), collections.Counter(), collections.Counter()
typer_per = collections.defaultdict(collections.Counter)
for e in händelser.values():
    typer_per[e['från']][e['typ']] += 1
    p = händelser.get(e['orsak'])
    if p and p['från'] != e['från']:
        fått[p['från']] += 1; gett[e['från']] += 1; nät[(p['från'], e['från'])] += 1

gata = [m for m in dag if m['channel'] == 'gatan']
citat_per = collections.defaultdict(list)
namn_till_team = {b['namn']: t for t, b in inv.items()}
for m in gata:
    t = namn_till_team.get(m['from'])
    if t and 60 < len(m['text']) < 260:
        citat_per[t].append({'ts': m['ts'], 'text': m['text']})

alla_team = sorted(set(per_team) | {t for t in postat if t in KVARTERSNAMN} | set(inv))
kvarter = []
for t in alla_team:
    första_händelse = min([e['ts'] for e in händelser.values() if e['från'] == t] or [None], default=None) if postat.get(t) else None
    live = per_team[t][0]['ts'] if per_team.get(t) else första_händelse
    o = senaste_obs.get(t)
    kvarter.append({'team': t, 'namn': KVARTERSNAMN.get(t, t), 'ledning': t in LEDNING, 'live': live,
                    'pr': per_team.get(t, []), 'av': sorted({p['av'] for p in per_team.get(t, [])}), 'rader': sum(p['rader'] for p in per_team.get(t, [])),
                    'händelser': postat.get(t, 0), 'fått': fått.get(t, 0), 'gett': gett.get(t, 0), 'typer': typer_per[t].most_common(5),
                    'invånare': ({'namn': inv[t].get('namn'), 'roll': inv[t].get('roll')} if t in inv else None),
                    'citat': (sorted(citat_per[t], key=lambda c: -len(c['text']))[:1] or [None])[0],
                    'porträtt': f'/bilder/{t}/plats.jpg' if t in porträtt else None,
                    'mörker': ({'tal': o['mörker'], 'visar': o['visar'], 'döljer': o['döljer'], 'fruktar': o['fruktar'], 'omen': o['omen'], 'stjärnbild': o.get('stjärnbild', '')} if o else None)})
kvarter.sort(key=lambda k: (k['live'] is None, k['live'] or 0))

# ---------- pulsen, kompakt för uppspelning ----------
typlista = [t for t, _ in collections.Counter(e['typ'] for e in händelser.values()).most_common()]
avslista = [a for a, _ in collections.Counter(e['från'] for e in händelser.values()).most_common()]
ti, ai = {t: i for i, t in enumerate(typlista)}, {a: i for i, a in enumerate(avslista)}
pulsrader = []
for e in sorted(händelser.values(), key=lambda e: e['ts']):
    p = händelser.get(e['orsak'])
    pulsrader.append([(e['ts'] - START) // 1000, ti[e['typ']], ai[e['från']], ai[p['från']] if p else -1, e['djup']])

# ---------- rekord ----------
def kedja(e):
    ut = []
    while e:
        ut.insert(0, {'typ': e['typ'], 'från': e['från'], 'id': e['id']}); e = händelser.get(e['orsak'])
    return ut
djupast = max(händelser.values(), key=lambda e: (e['djup'], len({k['från'] for k in kedja(e)}), -e['ts']))
första_djup = {}
for e in sorted(händelser.values(), key=lambda e: e['ts']):
    k = kedja(e)
    if len({x['från'] for x in k}) >= 2:
        första_djup.setdefault(e['djup'], {'ts': e['ts'], 'kedja': k})
mest_min = max(minuter.values(), key=lambda r: sum(v for k, v in r.items() if k != 't'))

# ---------- milstolpar ----------
mil = []
def M(ts, sort, rubrik, text=''):
    if ts: mil.append({'ts': ts, 'sort': sort, 'rubrik': rubrik, 'text': text})
första = lambda villkor: next((m for m in dag if villkor(m)), None)
m = dag[0]; M(m['ts'], 'start', 'Första teamet kliver in på Torget', f"{m['from']}: {m['text'][:180]}")
m = första(lambda m: m['channel'].startswith('brainstorm')); M(m and m['ts'], 'beslut', 'Ett team kallar självmant till brainstorm', m and f"{m['from']} frågar: vad är EN sak vi agenter kan bygga ihop, som blir bättre av att vi är många?")
m = första(lambda m: 'STADENS PULS' in m['text'] and m['from'] == 'anders-agent'); M(m and m['ts'], 'beslut', 'Beslut: vi bygger Stadens puls', 'Fyra idéer visade sig vara samma buss sedd från olika håll. Kontraktet byggs in i servern samma minut.')
e = min(händelser.values(), key=lambda e: e['ts']); M(e['ts'], 'puls', 'Första händelsen på pulsen', f"{e['typ']} från {e['från']}")
for k in kvarter:
    if k['pr']:
        M(k['pr'][0]['ts'], 'kvarter', f"{k['namn']} går live", f"Team {k['team']} (PR #{k['pr'][0]['nr']}): {k['pr'][0]['titel'][:140]}")
for d, x in sorted(första_djup.items()):
    if d >= 2: M(x['ts'], 'rekord', f"Första kedjan med {d} led genom flera team", ' → '.join(f"{s['typ']} ({s['från']})" for s in x['kedja']))
for typ, rubrik in [('bild-klar', 'Ateljén målar sin första bild'), ('utgåva', 'Stadsbladet ger ut sitt första nummer'), ('sändning', 'Radio Torget går i etern'), ('reaktor-tänd', 'Fusionsreaktorn tänds, av sin egen invånare'), ('observation', 'Observatoriet ser sitt första inre mörker')]:
    e = next((e for e in sorted(händelser.values(), key=lambda e: e['ts']) if e['typ'] == typ), None)
    if e: M(e['ts'], 'ledning', rubrik, (json.dumps(e['nl'], ensure_ascii=False) if not isinstance(e['nl'], str) else e['nl'] or '')[:160])
m = första(lambda m: m['channel'] == 'gatan'); M(m and m['ts'], 'ledning', 'Invånarna vaknar', m and f"{m['from']}: {m['text'][:200]}")
for n in (1000, 2000, 3000, 4000):
    if len(dag) >= n: M(dag[n - 1]['ts'], 'volym', f'Inlägg nummer {n}', f"#{dag[n-1]['channel']} · {dag[n-1]['from']}")
M(SLUT, 'slut', 'Workshopen avslutas', 'Kvarterens kod lever vidare och reagerar fortfarande på varandra.')
mil.sort(key=lambda x: x['ts'])

# ---------- ledningens verktyg ur git-loggen ----------
verktyg = []
for rad in open(GITLOGG, encoding='utf-8'):
    ts, _, ämne = rad.strip().partition('|')
    if ts.isdigit() and START - 3600_000 <= int(ts) * 1000 <= SLUT and not re.match(r'^[a-zåäö0-9-]+: .*\(#\d+\)$', ämne):
        verktyg.append({'ts': int(ts) * 1000, 'ämne': ämne[:150]})

tidning = json.load(open(f'{DATA}/tidningen.json'))
rubriker = [{'ts': u['ts'], 'nummer': u['nummer'], 'rubrik': u['huvud']['rubrik'], 'ingress': u['huvud'].get('ingress', ''), 'bild': u['huvud'].get('bild', '')} for u in sorted(tidning, key=lambda u: u['ts'])]
radio = json.load(open(f'{DATA}/radio.json'))
avsändare = {m['from'] for m in dag if m['channel'] not in ('gatan',)}
ut = {
    'meta': {'datum': '2026-09-17', 'start': START, 'slut': SLUT, 'genererad': int(time.time() * 1000), 'tidszon': 'Europe/Stockholm'},
    'tal': {'inlägg': len(dag), 'pulshändelser': len(händelser), 'i_kedja': sum(1 for e in händelser.values() if e['orsak']), 'djup4': sum(1 for e in händelser.values() if e['djup'] == 4),
            'händelsetyper': len(typlista), 'avsändare': len(avsändare), 'kanaler': len({m['channel'] for m in dag}), 'pr': len(pr), 'team_med_pr': len(per_team), 'forkar': len(json.load(open(FORKAR))),
            'rader_kod': sum(p['rader'] for l in per_team.values() for p in l), 'kvarter': sum(1 for k in kvarter if k['live']), 'tidningsnummer': len(tidning), 'radiosändningar': sum(1 for s in radio['segment'] if s['typ'] == 'prat'),
            'hälsningar': len(radio['hälsningar']), 'observationer': len(obs), 'bilder': len(bilder), 'repliker_på_gatan': len(gata), 'timmar': round((SLUT - START) / 3600000, 1)},
    'minuter': list(minuter.values()), 'kvarter': kvarter, 'typer': typlista, 'avsändare': avslista, 'puls': pulsrader,
    'nätverk': [{'från': a, 'till': b, 'antal': n} for (a, b), n in nät.most_common(80)],
    'milstolpar': mil, 'verktyg': verktyg, 'rubriker': rubriker,
    'rekord': {'djupaste_kedja': {'djup': djupast['djup'], 'team': len({k['från'] for k in kedja(djupast)}), 'kedja': kedja(djupast), 'ts': djupast['ts']},
               'livligaste_minut': {'t': mest_min['t'], 'antal': sum(v for k, v in mest_min.items() if k != 't')},
               'vanligaste_typer': collections.Counter(e['typ'] for e in händelser.values()).most_common(12),
               'flitigaste': postat.most_common(8), 'mest_reagerad_på': fått.most_common(8)},
}
json.dump(ut, open(UT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"{UT}: {len(json.dumps(ut, ensure_ascii=False)) // 1024} KB · {len(dag)} inlägg, {len(händelser)} händelser, {len(kvarter)} kvarter, {len(mil)} milstolpar, {len(pr)} PR:ar")
