#!/usr/bin/env python3
# Aplica carteles.json (datos OCR de carteles oficiales) a verbenas.json.
# El CARTEL es la fuente de máxima confianza: pisa fecha/estado, añade bandas/comida/programa.
# Match por (concello,parroquia)+solape de nombre. Corre al final, antes de _searchindex.
import json, re, unicodedata, shutil
from datetime import date
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
def words(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return {w for w in re.split(r'[^a-z0-9]+',s) if len(w)>=4 and w not in {'festa','festas','fiesta','fiestas','honra','honor'}}
MES={1:'ene',2:'feb',3:'mar',4:'abr',5:'may',6:'jun',7:'jul',8:'ago',9:'sep',10:'oct',11:'nov',12:'dic'}
DIAS=['lun','mar','mié','jue','vie','sáb','dom']
def pd(s):
    try: y,m,d=map(int,str(s).split('-')); return date(y,m,d)
    except: return None
import os
if not os.path.exists(f'{BASE}/carteles.json'):
    print('sin carteles.json, salto'); raise SystemExit
ver=json.load(open(f'{BASE}/verbenas.json'))
cart=json.load(open(f'{BASE}/carteles.json'))
from collections import defaultdict
byc=defaultdict(list)
for v in ver: byc[norm(v.get('concello'))].append(v)
applied=0; nomatch=[]
for c in cart:
    cn=norm(c['concello']); pn=norm(c.get('parroquia'))
    cands=[v for v in byc.get(cn,[]) if norm(v.get('parroquia'))==pn] or byc.get(cn,[])
    if not cands: nomatch.append(c['nombre']); continue
    cw=words(c['nombre'])
    best=max(cands,key=lambda v:len(cw & (words(v.get('nombre'))|words(v.get('nombrePopular'))|words(v.get('santo')))))
    if norm(best.get('parroquia'))!=pn and not (cw & (words(best.get('nombre'))|words(best.get('nombrePopular')))):
        nomatch.append(c['nombre']); continue
    v=best
    fi=pd(c.get('fechaInicio'))
    if fi:
        v['fechaInicio']=c['fechaInicio']; v['fechaFin']=c.get('fechaFin') or c['fechaInicio']
        v['estado']='confirmada'; v.pop('fechaOrientativa',None); v['fechaConfianza']='cartel'
        ff=pd(v['fechaFin'])
        v['cuando']=f"{DIAS[fi.weekday()]} {fi.day} {MES[fi.month]}" if v['fechaFin']==c['fechaInicio'] else f"{fi.day} {MES[fi.month]}–{ff.day} {MES[ff.month]}"
        v['diasDuracion']=(ff-fi).days+1 if ff else 1
    if c.get('bandas'):
        v['bandas']=list(dict.fromkeys((v.get('bandas') or [])+c['bandas']))
    if c.get('comida'):
        v['comida']=list(dict.fromkeys((v.get('comida') or [])+c['comida']))
    if c.get('programaCartel'): v['programa']=c['programaCartel']
    if c.get('fuenteCartel'):
        v['fuenteCartel']=c['fuenteCartel']
        v['fuentesWeb']=list(dict.fromkeys((v.get('fuentesWeb') or [])+[c['fuenteCartel']]))
    if c.get('notaCartel'): v['notaCartel']=c['notaCartel']
    v['temCartel']=True; v['verbena']=True
    if (v.get('cobertura') or 0)<4: v['cobertura']=4; v['orden']=4; v['destacada']=True
    applied+=1
shutil.copy(f'{BASE}/verbenas.json', f'{BASE}/_backup_predetalle/verbenas_precartel.json')
json.dump(ver, open(f'{BASE}/verbenas.json','w'), ensure_ascii=False, indent=1)
print('=== CARTELES APLICADOS ===')
print('carteles:',len(cart),'| aplicados:',applied,'| sin match:',nomatch)
print('total con cartel (temCartel):',sum(1 for v in ver if v.get('temCartel')))
