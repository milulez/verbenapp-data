#!/usr/bin/env python3
# Limpieza final de verbenas.json:
#  1) arregla concellos-ruido (parroquia mal puesta como concello)
#  2) fusiona duplicados (mismo concello+nombre) quedándose el más rico y uniendo campos
#  3) borra placeholders vacíos (desconocida sin fecha/historia/banda/comida)
import json, re, unicodedata, shutil
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
v=json.load(open(f'{BASE}/verbenas.json'))
n0=len(v)

# 1) concellos-ruido -> concello real
FIX={'Corme':'Ponteceso','Aguiño':'Ribeira','Lérez':'Pontevedra','Sabucedo':'A Estrada','Illa de San Simón':'Redondela'}
nfix=0
for x in v:
    if x.get('concello') in FIX:
        if not x.get('parroquia'): x['parroquia']=x['concello']
        x['concello']=FIX[x['concello']]; nfix+=1

# 2) dedup por (concello,nombre)
from collections import defaultdict
def score(x):
    s=0
    if x.get('estado') in ('confirmada','fija'): s+=4
    if x.get('fechaInicio'): s+=2
    if x.get('historia'): s+=2
    if x.get('historiaLarga'): s+=1
    s+=len(x.get('bandas') or [])+len(x.get('comida') or [])
    if x.get('fuentesWeb'): s+=1
    if x.get('precisionGeo')=='recinto': s+=1
    return s
groups=defaultdict(list)
for x in v: groups[(norm(x.get('concello')),norm(x.get('nombre')))].append(x)
TXT=['historia','historiaLarga','tradicion','programa','fundacion','interesTuristico','reclamo','santo','motivo','regla']
LIST=['bandas','comida','servicios','fuentesWeb','sesiones','bandasHistoricas']
BOOL=['verbena','atracciones','fuegos','procesion','familiar','aparcamiento','destacada']
merged=[]; nmerge=0
for k,grp in groups.items():
    if len(grp)==1: merged.append(grp[0]); continue
    grp.sort(key=score, reverse=True)
    best=grp[0]
    for o in grp[1:]:
        nmerge+=1
        for f in TXT:
            if not best.get(f) and o.get(f): best[f]=o[f]
        for f in LIST:
            u=list(dict.fromkeys((best.get(f) or [])+(o.get(f) or [])))
            if u: best[f]=u
        for f in BOOL:
            if o.get(f): best[f]=True
        if not best.get('fechaInicio') and o.get('fechaInicio'):
            for f in ('fechaInicio','fechaFin','estado','cuando','mes','fechaOrientativa','fechaConfianza'):
                if o.get(f) is not None: best[f]=o[f]
        if (best.get('cobertura') or 0)<(o.get('cobertura') or 0): best['cobertura']=o['cobertura']; best['orden']=o['cobertura']
        if best.get('precisionGeo')!='recinto' and o.get('precisionGeo')=='recinto':
            best['lat'],best['lng'],best['precisionGeo']=o.get('lat'),o.get('lng'),'recinto'
        if not best.get('fotoOrquesta') and o.get('fotoOrquesta'):
            best['fotoOrquesta']=o['fotoOrquesta']; best['orquestaCabeza']=o.get('orquestaCabeza')
    merged.append(best)

# 3) borra placeholders vacíos
def vacia(x):
    return (x.get('estado')=='desconocida' and not x.get('fechaInicio') and not x.get('historia')
            and not x.get('historiaLarga') and not x.get('bandas') and not x.get('comida'))
final=[x for x in merged if not vacia(x)]
ndrop=len(merged)-len(final)

# ids únicos
seen=set()
for x in final:
    i=x['id']
    while i in seen: i=i+'-x'
    x['id']=i; seen.add(i)

shutil.copy(f'{BASE}/verbenas.json', f'{BASE}/_backup_predetalle/verbenas_preclean.json')
json.dump(final, open(f'{BASE}/verbenas.json','w'), ensure_ascii=False, indent=1)
from collections import Counter
print('=== LIMPIEZA OK ===')
print(f'inicio:{n0} | concellos-ruido arreglados:{nfix} | duplicados fusionados:{nmerge} | vacíos borrados:{ndrop}')
print('FINAL:',len(final))
print('ids únicos:',len({x['id'] for x in final})==len(final))
print('estados:',dict(Counter(x.get('estado') for x in final)))
print('con historia:',sum(1 for x in final if x.get('historia')),'| con fecha:',sum(1 for x in final if x.get('fechaInicio')))
