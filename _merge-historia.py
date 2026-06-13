#!/usr/bin/env python3
# Fusiona historia.json (investigación web por fiesta) en verbenas.json.
# - historia/fundacion/destacado/fuentesWeb a su verbena por id
# - fecha 'confirmada-web' -> fechaInicio + estado='confirmada' (quita orientativa)
# - fecha 'probable' -> solo si la verbena no tiene fecha fiable (desconocida/estimada/sin fecha): estimada
# Corre tras _apply-historico, antes de _searchindex. Idempotente.
import json, shutil
from datetime import date
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
MES={1:'ene',2:'feb',3:'mar',4:'abr',5:'may',6:'jun',7:'jul',8:'ago',9:'sep',10:'oct',11:'nov',12:'dic'}
DIAS=['lun','mar','mié','jue','vie','sáb','dom']
def pdate(s):
    try: y,m,d=map(int,s.split('-')); return date(y,m,d)
    except: return None
def label(d): return f"{DIAS[d.weekday()]} {d.day} {MES[d.month]}"

ver={v['id']:v for v in json.load(open(f'{BASE}/verbenas.json'))}
hist=json.load(open(f'{BASE}/historia.json'))
nh=fconf=fprob=0
for vid,r in hist.items():
    v=ver.get(vid)
    if not v: continue
    if r.get('historia'): v['historia']=r['historia']; nh+=1
    if r.get('fundacion'): v['fundacion']=r['fundacion']
    if r.get('destacado'):
        v['destacado_txt']=r['destacado']
        if not v.get('reclamo'): v['reclamo']=r['destacado']
    if r.get('fuentes'): v['fuentesWeb']=r['fuentes']
    f=r.get('fecha2026'); conf=r.get('fechaConfianza')
    d0=pdate(f) if f else None
    if d0 and conf=='confirmada-web':
        v['fechaInicio']=f; v['fechaFin']=r.get('fechaFin2026') or f
        v['estado']='confirmada'; v.pop('fechaOrientativa',None); v['fechaConfianza']='web'
        df=pdate(v['fechaFin'])
        v['cuando']=label(d0) if v['fechaFin']==f else f"{d0.day} {MES[d0.month]}–{df.day} {MES[df.month]}"
        fconf+=1
    elif d0 and conf=='probable' and (v.get('estado') in ('desconocida','estimada') or not v.get('fechaInicio')):
        v['fechaInicio']=f; v['fechaFin']=f; v['estado']='estimada'; v['fechaOrientativa']=True
        v['fechaConfianza']='media'; v['cuando']=f"≈ {d0.day} {MES[d0.month]} (orientativa)"
        fprob+=1

out=list(ver.values())
shutil.copy(f'{BASE}/verbenas.json',f'{BASE}/_backup_predetalle/verbenas_prehistoria.json')
json.dump(out, open(f'{BASE}/verbenas.json','w'), ensure_ascii=False, indent=1)
print('=== MERGE HISTORIA WEB OK ===')
print('historias añadidas:',nh,'| fechas confirmadas-web:',fconf,'| fechas probables aplicadas:',fprob)
print('total verbenas con historia:',sum(1 for v in out if v.get('historia')))
