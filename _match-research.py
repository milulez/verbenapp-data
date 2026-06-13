#!/usr/bin/env python3
# Engancha research/*.json (investigación web por concello) a verbenas.json.
# Match por (concello,parroquia) + desempate por solape de palabras nombre/santo.
# Vuelca: historia, historiaLarga, fundacion, comida(+gastronomia), servicios, programa, tradicion,
# fuentesWeb, y fecha (confirmada-web->confirmada; probable->estimada si no hay fecha fiable).
# Las que no casan con ninguna verbena se guardan en research_nuevas.json (candidatas a añadir).
import json, re, unicodedata, glob, shutil
from datetime import date
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
def words(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return {w for w in re.split(r'[^a-z0-9]+',s) if len(w)>=4 and w not in {'festa','festas','fiesta','fiestas','patronais','honor'}}
MES={1:'ene',2:'feb',3:'mar',4:'abr',5:'may',6:'jun',7:'jul',8:'ago',9:'sep',10:'oct',11:'nov',12:'dic'}
DIAS=['lun','mar','mié','jue','vie','sáb','dom']
def pdate(s):
    try: y,m,d=map(int,str(s).split('-')); return date(y,m,d)
    except: return None
def mapserv(serv, v):
    s=' '.join(serv).lower()
    if 'atraccion' in s or 'hinchable' in s: v['atracciones']=True
    if 'fuego' in s or 'pirotecn' in s: v['fuegos']=True
    if 'aparc' in s: v['aparcamiento']=True
    if serv: v['servicios']=sorted(set((v.get('servicios') or [])+serv))

ver=json.load(open(f'{BASE}/verbenas.json'))
# index por concello-norm
from collections import defaultdict
byc=defaultdict(list)
for v in ver: byc[norm(v.get('concello'))].append(v)

research=[]
for fp in glob.glob(f'{BASE}/research/*.json'):
    research+=json.load(open(fp))

matched=nuevas=fconf=fprob=hist=0
nuevas_list=[]
for r in research:
    cn=norm(r['concello']); pn=norm(r.get('parroquia'))
    cands=[v for v in byc.get(cn,[]) if norm(v.get('parroquia'))==pn] or byc.get(cn,[])
    if not cands:
        nuevas+=1; nuevas_list.append(r); continue
    rw=words(r['nombre'])
    best=max(cands, key=lambda v: len(rw & (words(v.get('nombre'))|words(v.get('nombrePopular'))|words(v.get('santo')))))
    score=len(rw & (words(best.get('nombre'))|words(best.get('nombrePopular'))|words(best.get('santo'))))
    # si ni parroquia exacta ni solape, lo tratamos como nueva
    if norm(best.get('parroquia'))!=pn and score==0:
        nuevas+=1; nuevas_list.append(r); continue
    v=best; matched+=1
    if r.get('historiaCorta'): v['historia']=r['historiaCorta']; hist+=1
    if r.get('historiaLarga'): v['historiaLarga']=r['historiaLarga']
    if r.get('fundacion'): v['fundacion']=r['fundacion']
    if r.get('tradicion'): v['tradicion']=r['tradicion']
    if r.get('programa'): v['programa']=r['programa']
    if r.get('fuentes'): v['fuentesWeb']=r['fuentes']
    if r.get('gastronomia'):
        cur=v.get('comida') or []
        for g in r['gastronomia']:
            if g not in cur: cur.append(g)
        v['comida']=cur
    if r.get('servicios'): mapserv(r['servicios'],v)
    f=r.get('fecha2026'); conf=r.get('fechaConfianza'); d0=pdate(f)
    if d0 and conf=='confirmada-web':
        v['fechaInicio']=f; v['fechaFin']=r.get('fechaFin2026') or f
        v['estado']='confirmada'; v.pop('fechaOrientativa',None); v['fechaConfianza']='web'
        df=pdate(v['fechaFin'])
        v['cuando']=f"{DIAS[d0.weekday()]} {d0.day} {MES[d0.month]}" if v['fechaFin']==f else f"{d0.day} {MES[d0.month]}–{df.day} {MES[df.month]}"
        fconf+=1
    elif d0 and conf=='probable' and (v.get('estado') in ('desconocida','estimada') or not v.get('fechaInicio')):
        v['fechaInicio']=f; v['fechaFin']=r.get('fechaFin2026') or f; v['estado']='estimada'
        v['fechaOrientativa']=True; v['fechaConfianza']='media'; v['cuando']=f"≈ {d0.day} {MES[d0.month]} (orientativa)"
        fprob+=1

shutil.copy(f'{BASE}/verbenas.json',f'{BASE}/_backup_predetalle/verbenas_prematch.json')
json.dump(ver,open(f'{BASE}/verbenas.json','w'),ensure_ascii=False,indent=1)
json.dump(nuevas_list,open(f'{BASE}/research_nuevas.json','w'),ensure_ascii=False,indent=1)
print('=== MATCH RESEARCH OK ===')
print(f'investigadas: {len(research)} | matched: {matched} | historias: {hist}')
print(f'fechas: confirmada-web={fconf}, probable->estimada={fprob}')
print(f'sin match (candidatas nuevas, en research_nuevas.json): {nuevas}')
