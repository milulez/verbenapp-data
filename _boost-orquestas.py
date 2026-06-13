#!/usr/bin/env python3
# Linka bandas de verbenas.json con orquestas.json -> foto real, tiron(ranking), boost cobertura.
# Corre AL FINAL del pipeline. Backup en _backup_predetalle/verbenas_preboost.json.
import json,unicodedata,re,shutil
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
orq=json.load(open(f'{BASE}/orquestas.json'))
byname={}
for o in orq:
    byname.setdefault(o['nombreNorm'],o); byname.setdefault(norm(o['nombre']),o)
ver=json.load(open(f'{BASE}/verbenas.json'))
foto_set=tiron_set=cob_up=0
for v in ver:
    best=None
    for b in (v.get('bandas') or []):
        o=byname.get(norm(b))
        if not o: continue
        if best is None or (o['rankingPuesto'] or 999)<(best['rankingPuesto'] or 999): best=o
        if not v.get('fotoOrquesta') and o.get('foto'):
            v['fotoOrquesta']=o['foto']; v['orquestaCabeza']=o['nombre']; foto_set+=1
    if best:
        if best.get('foto'): v['fotoOrquesta']=best['foto']; v['orquestaCabeza']=best['nombre']
        rp=best['rankingPuesto']
        if rp:
            v['tiron']=rp; tiron_set+=1
            nivel=5 if rp<=5 else 4 if rp<=15 else 3
            if (v.get('cobertura') or 0)<nivel and v.get('origen')!='estrella':
                v['cobertura']=nivel; v['orden']=nivel; v['destacada']=nivel>=4; cob_up+=1
shutil.copy(f'{BASE}/verbenas.json',f'{BASE}/_backup_predetalle/verbenas_preboost.json')
json.dump(ver,open(f'{BASE}/verbenas.json','w'),ensure_ascii=False,indent=1)
print('foto real:',sum(1 for v in ver if v.get('fotoOrquesta')),'| tiron:',tiron_set,'| cobertura subida:',cob_up)
