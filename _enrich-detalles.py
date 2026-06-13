#!/usr/bin/env python3
# Enriquece verbenas.json con datos de detalle: coords exactas recinto, franja, terreno, servicios.
# Corre DESPUES de _parse-detalles.py. Backup en _backup_predetalle/.
import json, re, unicodedata, os, shutil
from collections import defaultdict
from datetime import date
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
def parse(d):
    try: y,m,dd=str(d).split('-'); return date(int(y),int(m),int(dd))
    except: return None
def sesiones(hor):
    h=(hor or '').lower(); s=[]
    if 'verm' in h: s.append('vermú')
    if 'tarde' in h: s.append('tarde')
    if 'noche' in h or 'madrug' in h: s.append('noche')
    if 'dia' in h or 'día' in h or 'mañ' in h: s.append('día')
    return s
def franja(hor):
    s=sesiones(hor)
    if 'noche' in s: return 'noche'
    if 'tarde' in s: return 'tarde'
    if 'vermú' in s: return 'vermú'
    if 'día' in s: return 'día'
    return None
def horaInicio(hor):
    # prioriza hora de la sesión de NOCHE (la verbena fuerte), luego tarde, luego vermú
    for ses in ['Noche','Tarde','Verm']:
        m=re.search(ses+r'[^(]*\((\d{1,2}):(\d{2})\)',hor or '')
        if m:
            hh=int(m.group(1));
            if hh<6: hh+=24  # 00:30 madrugada -> 24:30 para ordenar
            return f"{m.group(1).zfill(2)}:{m.group(2)}"
    return None

act={a['id']:a for a in json.load(open(f'{BASE}/actuaciones-galicia.json'))}
det=json.load(open(f'{BASE}/actuaciones-detalle.json'))

# agrega por recinto (concello,parroquia,fecha) y fallback (concello,fecha)
venue=defaultdict(lambda:{'lat':None,'lng':None,'franjas':[],'serv':set(),'terreno':''})
byCF=defaultdict(lambda:{'franjas':[],'serv':set()})
for fid,d in det.items():
    a=act.get(fid);
    if not a: continue
    kv=(norm(a['concello']),norm(a['parroquia']),a['fecha'])
    v=venue[kv]
    if d['lat'] and not v['lat']: v['lat'],v['lng']=d['lat'],d['lng']
    if d['horario']: v['franjas'].append(d['horario'])
    if d['terreno'] and not v['terreno']: v['terreno']=d['terreno']
    v['serv'].update(d['servicios'])
    cf=byCF[(norm(a['concello']),a['fecha'])]
    if d['horario']: cf['franjas'].append(d['horario'])
    cf['serv'].update(d['servicios'])

def mapserv(serv, v):
    s=' '.join(serv).lower()
    if 'atraccion' in s: v['atracciones']=True
    if any(k in s for k in ['fuego','pirotecn']): v['fuegos']=True
    if 'aparc' in s: v['aparcamiento']=True
    com=[]
    for k,lbl in [('bocater','Bocatería'),('bar','Bar'),('pulper','Pulpería'),('furanch','Furancho'),('degust','Degustación'),('comida','Comida'),('food','Food truck')]:
        if k in s: com.append(lbl)
    if com:
        cur=v.get('comida') or []
        for c in com:
            if c not in cur: cur.append(c)
        v['comida']=cur
    if serv: v['servicios']=sorted(set((v.get('servicios') or [])+serv))

def bestHorario(hs):
    # raw horario mas informativo: el que tenga hora de noche, si no el mas largo
    cands=[h for h in hs if h and 'disp' not in h.lower()]
    if not cands: return ''
    conhora=[h for h in cands if re.search(r'\(\d',h)]
    pool=conhora or cands
    return max(pool,key=len)

ver=json.load(open(f'{BASE}/verbenas.json'))
exact=0; franjaset=0; servset=0; coordup=0; horaset=0
for v in ver:
    kv=(norm(v.get('concello')),norm(v.get('parroquia')),v.get('fechaInicio'))
    rec=venue.get(kv) if v.get('parroquia') else None
    if rec and (rec['lat'] or rec['franjas'] or rec['serv']):
        # match EXACTO de recinto (parroquia+concello+fecha) — sirve a nuevas Y existentes
        if rec['lat'] and v.get('precisionGeo')!='recinto':
            v['lat'],v['lng'],v['precisionGeo']=rec['lat'],rec['lng'],'recinto'; coordup+=1
        bh=bestHorario(rec['franjas'])
        if bh:
            ses=sesiones(bh); fr=franja(bh); hi=horaInicio(bh)
            if fr: v['franja']=fr; franjaset+=1
            if ses: v['sesiones']=ses
            if hi: v['horaInicio']=hi; horaset+=1
            v['horarioTexto']=re.sub(r'\s*\([^)]*\)','',bh) if not re.search(r'\(\d',bh) else bh
        if rec['terreno']: v['terreno']=rec['terreno']
        if rec['serv']: mapserv(sorted(rec['serv']),v); servset+=1
        exact+=1
    else:
        # sin recinto exacto: enriquecer por concello+fecha (franja/servicios, sin tocar coords)
        cf=byCF.get((norm(v.get('concello')),v.get('fechaInicio')))
        if cf and (cf['franjas'] or cf['serv']):
            if cf['franjas'] and not v.get('franja'):
                fr=franja(bestHorario(cf['franjas']));
                if fr: v['franja']=fr; franjaset+=1
            if cf['serv']: mapserv(sorted(cf['serv']),v); servset+=1

bk=f'{BASE}/_backup_predetalle'; shutil.rmtree(bk,ignore_errors=True); os.makedirs(bk)
shutil.copy(f'{BASE}/verbenas.json',f'{bk}/verbenas.json')
json.dump(ver,open(f'{BASE}/verbenas.json','w'),ensure_ascii=False,indent=1)
print('=== ENRICH DETALLE OK ===')
print('coords EXACTAS de recinto aplicadas:',coordup)
print('HORA de inicio seteada:',horaset)
print('franja seteada:',franjaset,'| servicios aplicados a:',servset)
print('total con atracciones:',sum(1 for v in ver if v.get('atracciones')))
print('total con aparcamiento:',sum(1 for v in ver if v.get('aparcamiento')))
print('total con comida:',sum(1 for v in ver if v.get('comida')))
print('total con servicios[]:',sum(1 for v in ver if v.get('servicios')))
print('precisionGeo recinto:',sum(1 for v in ver if v.get('precisionGeo')=='recinto'))
