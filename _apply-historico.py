#!/usr/bin/env python3
# Aplica historico.json a verbenas.json:
#  - a TODAS: campo `historico` (años anteriores: fechas + orquestas) + `historicoTexto`
#  - a las SIN fecha (desconocida / sin fechaInicio, no 'fuera'): deriva `fechaInicio` orientativa
#    (santo fijo->misma fecha; finde móvil->mismo finde 2026), estado='estimada', fechaOrientativa=True
# Corre tras _searchindex... no: corre ANTES de _searchindex (para que la fecha estimada entre en busqueda).
import json, re, unicodedata, shutil
from datetime import date
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
MES={6:'jun',7:'jul',8:'ago',9:'sep',1:'ene',2:'feb',3:'mar',4:'abr',5:'may',10:'oct',11:'nov',12:'dic'}
def pdate(s):
    try: y,m,d=map(int,s.split('-')); return date(y,m,d)
    except: return None
def nth_weekday(year,month,weekday,n):
    ds=[]
    for d in range(1,32):
        try: ds.append(date(year,month,d))
        except: break
    same=[d for d in ds if d.weekday()==weekday]
    if not same: return None
    return same[min(n-1,len(same)-1)]

ver=json.load(open(f'{BASE}/verbenas.json'))
hist=json.load(open(f'{BASE}/historico.json'))

attached=estim_fija=estim_finde=sin_hist=0
for v in ver:
    key=f"{norm(v.get('concello'))}|{norm(v.get('parroquia'))}"
    h=hist.get(key)
    needs = (not v.get('fechaInicio') or v.get('estado')=='desconocida') and v.get('estado')!='fuera'
    if h:
        # adjuntar histórico a TODAS
        anios=h['anios']
        v['historico']={'anios':anios,'bandas':h['bandas']}
        # texto display: "2025: 2 ago · 2024: 5 ago"
        chunks=[]
        for y in sorted(anios,reverse=True):
            d0=pdate(sorted(anios[y])[0])
            if d0: chunks.append(f"{y}: {d0.day} {MES[d0.month]}")
        v['historicoTexto']=" · ".join(chunks[:3])
        if h['bandas']: v['bandasHistoricas']=h['bandas']
        attached+=1
        # derivar fecha orientativa si falta
        if needs:
            yd={}
            for y,ds in anios.items():
                d0=pdate(sorted(ds)[0])
                if d0: yd[int(y)]=d0
            if yd:
                mds={(d.month,d.day) for d in yd.values()}
                if len(mds)==1:
                    m,d=next(iter(mds)); est=date(2026,m,d); v['fechaConfianza']='alta'; estim_fija+=1
                else:
                    ref=yd[max(yd)]  # año más reciente
                    widx=(ref.day-1)//7+1
                    est=nth_weekday(2026,ref.month,ref.weekday(),widx) or date(2026,ref.month,min(ref.day,28))
                    v['fechaConfianza']='media'; estim_finde+=1
                v['fechaInicio']=est.isoformat(); v['fechaFin']=est.isoformat()
                v['estado']='estimada'; v['fechaOrientativa']=True
                v['cuando']=f"≈ {est.day} {MES[est.month]} (orientativa)"
                v['mes']={6:'junio',7:'julio',8:'agosto',9:'septiembre'}.get(est.month,v.get('mes'))
    elif needs:
        sin_hist+=1

shutil.copy(f'{BASE}/verbenas.json',f'{BASE}/_backup_predetalle/verbenas_prehist.json')
json.dump(ver,open(f'{BASE}/verbenas.json','w'),ensure_ascii=False,indent=1)
print('=== HISTORICO APLICADO ===')
print('verbenas con apartado "años anteriores":',attached)
print('fechas orientativas derivadas:',estim_fija+estim_finde,f'(fijas={estim_fija}, finde={estim_finde})')
print('siguen sin fecha (sin histórico tampoco):',sin_hist)
from collections import Counter
print('estados ahora:',dict(Counter(v.get('estado') for v in ver)))
print('sin fechaInicio ahora:',sum(1 for v in ver if not v.get('fechaInicio')))
