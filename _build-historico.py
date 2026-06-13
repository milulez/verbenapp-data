#!/usr/bin/env python3
# Parsea /tmp/odg_hist/*.html (veranos 2023-2025, Galicia) -> historico.json
# clave "concelloNorm|parroquiaNorm" -> {anios:{año:[fechas]}, bandas:[(nombre,veces)], n}
import re, json, glob, html, unicodedata
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def clean(s): return html.unescape(re.sub(r'\s+',' ',s)).strip()
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
GAL={'a coruña','a coruna','lugo','ourense','pontevedra'}
PREF=re.compile(r'^(orquesta|grupo|charanga|disco m[oó]vil|d[uú]o|tr[ií]o|artista)\s+',re.I)
CONNECT={'la','las','el','los','lo','o','a','os','as','do','da','de','del','dos','das','e','y','i','con'}
VOC=set('aeiouáéíóúü')
def cleanband(f):
    n=PREF.sub('',f).strip()
    if n.isupper():
        out=[]
        for w in n.split():
            low=w.lower()
            if low in CONNECT: out.append(low)
            elif len(w)<=3 and not (set(low)&VOC): out.append(w)
            else: out.append(w.capitalize())
        n=' '.join(out); n=n[0].upper()+n[1:] if n else n
    return n
ENTRY=re.compile(r'/fiesta/(\d+)/(\d{2})-(\d{2})-(\d{4})_([a-z-]+)_[^"]*"[^>]*>(.*?)</a>', re.S)
SPANS=re.compile(r'<span[^>]*>(.*?)</span>', re.S)

from collections import defaultdict, Counter
hist=defaultdict(lambda:{'fechas':defaultdict(set),'bandas':Counter()})
seen=set()
for fp in glob.glob('/tmp/odg_hist/*.html'):
    h=open(fp,encoding='utf-8',errors='ignore').read()
    for m in ENTRY.finditer(h):
        fid,dd,mm,yyyy,tipo,body=m.groups()
        if fid in seen: continue
        seen.add(fid)
        spans=[clean(re.sub(r'<[^>]+>','',s)) for s in SPANS.findall(body)]; spans=[s for s in spans if s]
        form=lugar=''
        for s in spans:
            if re.search(r'\([^)]+\)\s*$',s) and not lugar: lugar=s
            elif not form: form=s
        ml=re.match(r'(.*)\(([^)]+)\)\s*$',lugar)
        if not ml: continue
        prov=clean(ml.group(2))
        if prov.lower() not in GAL: continue
        parts=[p.strip() for p in ml.group(1).strip().rstrip(',').split(',') if p.strip()]
        if not parts: continue
        conc=parts[-1]; parr=parts[0] if len(parts)>=2 else ''
        key=f"{norm(conc)}|{norm(parr)}"
        hist[key]['fechas'][yyyy].add(f"{yyyy}-{mm}-{dd}")
        if form: hist[key]['bandas'][cleanband(form)]+=1

out={}
for k,d in hist.items():
    out[k]={'anios':{y:sorted(v) for y,v in d['fechas'].items()},
            'bandas':[b for b,_ in d['bandas'].most_common(6)],
            'n':sum(len(v) for v in d['fechas'].values())}
json.dump(out, open(f'{BASE}/historico.json','w'), ensure_ascii=False, indent=1)
print('historico.json: parroquias con histórico =',len(out))
print('actuaciones históricas únicas:',len(seen))
PY=0
