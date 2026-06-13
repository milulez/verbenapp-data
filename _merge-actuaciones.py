#!/usr/bin/env python3
# MERGE actuaciones-galicia.json -> verbenas.json
#  A) match concello+fecha: empuja banda real, verbena=True, confirma fecha (±1d)
#  B) crea verbenas NUEVAS de actuaciones sin match (group concello+parroquia+fecha)
# Backup en _backup_premerge/. Re-correr DESPUES de _export.js (post-paso).
import json, re, unicodedata, os, shutil
from datetime import date
from collections import defaultdict

import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
def slug(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',s)).strip('-')
def parse(d):
    try: y,m,dd=str(d).split('-'); return date(int(y),int(m),int(dd))
    except: return None
DIAS=['lun','mar','mié','jue','vie','sáb','dom']; DIASF=['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
MESES={1:'ene',2:'feb',3:'mar',4:'abr',5:'may',6:'jun',7:'jul',8:'ago',9:'sep',10:'oct',11:'nov',12:'dic'}
MESESL={6:'junio',7:'julio',8:'agosto',9:'septiembre'}
PREF=re.compile(r'^(orquesta|grupo|charanga|disco m[oó]vil|d[uú]o|tr[ií]o|artista)\s+',re.I)
CONNECT={'la','las','el','los','lo','o','a','os','as','do','da','de','del','dos','das','e','y','i','con'}
VOC=set('aeiouáéíóúü')
def cleanband(f):
    n=PREF.sub('',f).strip()
    if n.isupper():  # ALLCAPS -> Title; conectores en minúscula, siglas (sin vocal,<=3) intactas
        out=[]
        for w in n.split():
            low=w.lower()
            if low in CONNECT: out.append(low)
            elif len(w)<=3 and not (set(low)&VOC): out.append(w)  # CDC, DJ
            else: out.append(w.capitalize())
        n=' '.join(out)
        n=n[0].upper()+n[1:] if n else n  # primera mayúscula
    return n
COB={'orquesta':3,'grupo':2,'charanga':2,'disco movil':2,'duo':1,'trio':1,'artista':1}
ARTG={'O':'do','A':'da','As':'das','Os':'dos'}
def nombrePop(lugar):
    p=lugar.split(); art=ARTG.get(p[0],None) if p else None
    if art: return f"Festas {art} {' '.join(p[1:])}"
    return f"Festas de {lugar}"

ver=json.load(open(f'{BASE}/verbenas.json'))
act=json.load(open(f'{BASE}/actuaciones-galicia.json'))
coords={}; cname={}
for k,c in json.load(open('/tmp/concello_coords.json')).items():
    cn=norm(k.split('|')[-1]); coords[cn]=c; cname[cn]=k.split('|')[-1]
# fallback: centroide de verbenas existentes por concello-norm
cacc=defaultdict(list)
for v in ver:
    if v.get('lat') is not None: cacc[norm(v.get('concello'))].append((v['lat'],v['lng']))
for cn,pts in cacc.items():
    if cn not in coords:
        coords[cn]={'lat':round(sum(p[0] for p in pts)/len(pts),5),'lng':round(sum(p[1] for p in pts)/len(pts),5)}

# index verbenas por concello-norm
vidx=defaultdict(list)
for i,v in enumerate(ver):
    vidx[norm(v.get('concello'))].append(i)

confirmadas=0; bandas_add=0; matched_act=set(); verbena_set=0
for ai,a in enumerate(act):
    fa=parse(a['fecha']); cn=norm(a['concello'])
    band=cleanband(a['formacion']); is_band=a['tipo'] in ('orquesta','grupo','charanga','disco movil')
    best=None
    for i in vidx.get(cn,[]):
        fv=parse(ver[i].get('fechaInicio'))
        if fv and fa and abs((fv-fa).days)<=3:
            d=abs((fv-fa).days)
            if best is None or d<best[0]: best=(d,i)
    if best:
        matched_act.add(ai); v=ver[best[1]]
        if band and band not in v['bandas']:
            v['bandas'].append(band); bandas_add+=1
        if is_band and not v.get('verbena'): v['verbena']=True; verbena_set+=1
        if best[0]<=1 and v.get('estado') not in ('confirmada','fija'):
            v['estado']='confirmada'; confirmadas+=1
        v.setdefault('fuentes',[])
        if 'orquestasdegalicia' not in v['fuentes']: v['fuentes'].append('orquestasdegalicia')

# B) nuevas: agrupar actuaciones sin match por concello+parroquia+fecha
groups=defaultdict(list)
for ai,a in enumerate(act):
    if ai in matched_act: continue
    lugar=a['parroquia'] or a['concello']
    groups[(a['provincia'],a['concello'],a['parroquia'],a['fecha'])].append(a)

nuevas=[]
for (prov,conc,parr,fecha),items in groups.items():
    f=parse(fecha); lugar=parr or conc
    bandas=[]; tipos=set()
    for it in items:
        b=cleanband(it['formacion']); tipos.add(it['tipo'])
        if b and b not in bandas: bandas.append(b)
    cob=max((COB.get(t,1) for t in tipos), default=1)
    c=coords.get(norm(conc),{})
    wd=f.weekday() if f else None
    cuando=f"{DIAS[wd]} {f.day} {MESES[f.month]}" if f else "Por confirmar"
    npop=nombrePop(lugar)
    busqueda=norm(f"{npop} {lugar} {conc} {prov} {' '.join(bandas)}")
    is_verbena=bool(tipos & {'orquesta','grupo','charanga','disco movil'})
    nuevas.append({
        'id': slug(f"{lugar}-{conc}-{fecha}"),
        'nombre': f"Festas de {lugar}", 'origen':'actuaciones', 'tipo':'verbena',
        'cobertura': cob, 'fechaInicio': fecha, 'fechaFin': fecha, 'estado':'confirmada',
        'provincia': prov, 'comarca':'', 'concello': conc, 'parroquia': parr,
        'lat': c.get('lat'), 'lng': c.get('lng'), 'precisionGeo':'concello',
        'bandas': bandas, 'comida':[], 'verbena': is_verbena, 'atracciones': False, 'fuegos': False,
        'franja':'noche' if is_verbena else None, 'interesTuristico': None, 'diasDuracion': 1,
        'descripcion': f"Verbena con {bandas[0]}." if bandas else "Verbena.",
        'motivo': None, 'regla': None, 'busqueda': busqueda,
        'nombrePopular': npop, 'santo': None,
        'mes': MESESL.get(f.month) if f else None,
        'diaSemana': DIASF[wd] if wd is not None else None,
        'finde': wd in (4,5,6) if wd is not None else False,
        'cuando': cuando, 'imagenCat':'verbena', 'destacada': False,
        'orden': cob, 'reclamo': f"Verbena con {bandas[0]}." if bandas else None,
        'procesion': False, 'familiar': False, 'fuentes':['orquestasdegalicia'],
    })

# LIMPIEZA nuevas: drop ruido (PRIVADA/TVG/Reserva/Pendiente), fuzzy-map concello->coords, drop sin coords
NOISE=re.compile(r'privad|reserv|pendiente|confirm|pdte|^tvg$|^tuxe$|sala |evento|restaurant|polideportiv|casa de la cultura|multiusos|^zona |salon|salón|hotel',re.I)
cnorms=list(coords.keys())
def fuzzy(cn):
    if cn in coords: return cname.get(cn,None),coords[cn]
    cands=[k for k in cnorms if k.startswith(cn) or cn.startswith(k)]
    if not cands and len(cn)>=5: cands=[k for k in cnorms if cn in k or k in cn]
    if cands:
        cands.sort(key=len); return cname.get(cands[0]),coords[cands[0]]
    return None,None
dropped_noise=fixed=dropped_nocoord=0
clean=[]
for n in nuevas:
    if NOISE.search(n['concello']) or len(norm(n['concello']))<3: dropped_noise+=1; continue
    if n.get('lat') is None:
        canon,c=fuzzy(norm(n['concello']))
        if c: n['lat'],n['lng']=c['lat'],c['lng']; n['concello']=canon or n['concello']; fixed+=1
        else: dropped_nocoord+=1; continue
    clean.append(n)
nuevas=clean
print(f'limpieza nuevas: drop_ruido={dropped_noise} fuzzy_coords={fixed} drop_sin_coords={dropped_nocoord}')

# dedup nuevas vs ids existentes
existing_ids={v['id'] for v in ver}
seen=set(); nuevas2=[]
for n in nuevas:
    nid=n['id']; k=nid
    while k in existing_ids or k in seen: k=k+'-x'
    n['id']=k; seen.add(k); nuevas2.append(n)

# backup + write
bk=f'{BASE}/_backup_premerge'; shutil.rmtree(bk,ignore_errors=True); os.makedirs(bk)
shutil.copy(f'{BASE}/verbenas.json', f'{bk}/verbenas.json')
out=ver+nuevas2
json.dump(out, open(f'{BASE}/verbenas.json','w'), ensure_ascii=False, indent=1)

from collections import Counter
print('=== MERGE OK ===')
print('actuaciones matched->enriquecidas:', len(matched_act))
print('  fechas confirmadas (±1d):', confirmadas, '| bandas reales añadidas:', bandas_add, '| verbena=true seteado:', verbena_set)
print('verbenas NUEVAS creadas:', len(nuevas2))
print('TOTAL verbenas.json:', len(out), '(antes 4363)')
conf=sum(1 for v in out if v.get('estado')=='confirmada')
conband=sum(1 for v in out if v.get('bandas'))
print('confirmadas totales:', conf, '| con >=1 banda:', conband)
print('nuevas por provincia:', dict(Counter(n['provincia'] for n in nuevas2)))
