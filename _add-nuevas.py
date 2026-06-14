#!/usr/bin/env python3
# Crea verbenas NUEVAS desde research_nuevas.json (fiestas que la investigación web encontró
# y NO casaban con ninguna verbena existente) e inserta en verbenas.json.
# Corre tras _match-research, antes de _searchindex. Idempotente por id.
import json, re, unicodedata
from datetime import date
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def norm(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
def slug(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',s)).strip('-')
MES={1:'ene',2:'feb',3:'mar',4:'abr',5:'may',6:'jun',7:'jul',8:'ago',9:'sep',10:'oct',11:'nov',12:'dic'}
MESL={6:'junio',7:'julio',8:'agosto',9:'septiembre'}
DIAS=['lun','mar','mié','jue','vie','sáb','dom']
def pdate(s):
    try: y,m,d=map(int,str(s).split('-')); return date(y,m,d)
    except: return None
def tipo_de(nombre, gastro):
    n=nombre.lower()
    if re.search(r'rapa|bestas|curro|cabalar', n): return 'rapa'
    if re.search(r'trail|andaina|carreira|legua|btt|ciclista', n): return 'deportivo'
    if re.search(r'rock|fest\b|festival|jazz|harp|music|folk|reggae|metal', n): return 'festival'
    if re.search(r'feira|feria|mercado|mostra', n): return 'feira'
    if gastro or re.search(r'festa d[oa]|degustaci|pulpo|polbo|churrasc|empanada|cocido|marisc|ostra|sard|carne|queixo|viño|vino|cervexa|filloa|androlla|raxo|polo|cabrito|carneiro|lacón|tortilla', n): return 'gastronomica'
    return 'fiesta'

ver=json.load(open(f'{BASE}/verbenas.json'))
nuevas=json.load(open(f'{BASE}/research_nuevas.json'))
# coords por concello-norm
coords={}
for k,c in json.load(open('_cache/concello_coords.json')).items():
    coords[norm(k.split('|')[-1])]={'lat':c['lat'],'lng':c['lng']}
from collections import defaultdict
cacc=defaultdict(list)
for v in ver:
    if v.get('lat') is not None: cacc[norm(v.get('concello'))].append((v['lat'],v['lng']))
for cn,pts in cacc.items():
    coords.setdefault(cn,{'lat':round(sum(p[0] for p in pts)/len(pts),5),'lng':round(sum(p[1] for p in pts)/len(pts),5)})

existing_ids={v['id'] for v in ver}
# clave para no duplicar contra existentes (concello+nombre normalizado aprox)
exist_key={(norm(v.get('concello')),norm(v.get('nombre'))) for v in ver}
exist_key|= {(norm(v.get('concello')),norm(v.get('nombrePopular'))) for v in ver}

def mapserv(serv):
    s=' '.join(serv or []).lower(); out={}
    if 'atraccion' in s or 'hinchable' in s: out['atracciones']=True
    if 'fuego' in s or 'pirotecn' in s: out['fuegos']=True
    if 'aparc' in s: out['aparcamiento']=True
    return out

add=[]; seen=set(); dup=0
for r in nuevas:
    conc=r.get('concello'); nombre=r.get('nombre')
    if not conc or not nombre: continue
    k=(norm(conc),norm(nombre))
    if k in exist_key or k in seen: dup+=1; continue
    seen.add(k)
    f=pdate(r.get('fecha2026')); conf=r.get('fechaConfianza')
    gastro=r.get('gastronomia') or []
    tipo=tipo_de(nombre,gastro)
    c=coords.get(norm(conc),{})
    estado='desconocida'; fi=ff=None; orient=False; cuando='Por confirmar'
    if f and conf=='confirmada-web':
        estado='confirmada'; fi=r['fecha2026']; ff=r.get('fechaFin2026') or fi
        cuando=f"{DIAS[f.weekday()]} {f.day} {MES[f.month]}"
    elif f and conf=='probable':
        estado='estimada'; fi=r['fecha2026']; ff=r.get('fechaFin2026') or fi; orient=True
        cuando=f"≈ {f.day} {MES[f.month]} (orientativa)"
    txt=' '.join(str(r.get(x) or '') for x in ('historiaCorta','historiaLarga','tradicion','programa'))
    cob=2
    if re.search(r'internacional|interese tur|interés tur|interes tur',txt,re.I): cob=4
    elif r.get('historiaLarga') or gastro: cob=3
    sv=mapserv(r.get('servicios'))
    e={
        'id': (lambda s: s if s not in existing_ids else s+'-n')(slug(f"{nombre}-{conc}")),
        'nombre': nombre, 'nombrePopular': nombre, 'origen':'investigacion', 'tipo': tipo,
        'cobertura': cob, 'fechaInicio': fi, 'fechaFin': ff, 'estado': estado,
        'provincia': r.get('provincia'), 'comarca':'', 'concello': conc, 'parroquia': r.get('parroquia') or '',
        'lat': c.get('lat'), 'lng': c.get('lng'), 'precisionGeo':'concello',
        'bandas': [], 'comida': gastro, 'servicios': r.get('servicios') or [],
        'verbena': bool(re.search(r'verbena|orquesta|charanga',txt,re.I)),
        'atracciones': sv.get('atracciones',False), 'fuegos': sv.get('fuegos',False),
        'aparcamiento': sv.get('aparcamiento',False),
        'franja': 'noche', 'interesTuristico': ('internacional' if 'internacional' in txt.lower() else ('galicia' if re.search(r'interes|interés',txt,re.I) else None)),
        'diasDuracion': ((pdate(ff)-f).days+1) if (f and ff and pdate(ff)) else 1,
        'historia': r.get('historiaCorta'), 'historiaLarga': r.get('historiaLarga'),
        'fundacion': r.get('fundacion'), 'tradicion': r.get('tradicion'), 'programa': r.get('programa'),
        'fuentesWeb': r.get('fuentes') or [],
        'descripcion': r.get('historiaCorta'), 'reclamo': r.get('historiaCorta'),
        'nombrePopular': nombre, 'santo': None,
        'mes': MESL.get(f.month) if f else None, 'cuando': cuando,
        'fechaOrientativa': orient, 'fechaConfianza': ('web' if conf=='confirmada-web' else ('media' if conf=='probable' else None)),
        'imagenCat': {'gastronomica':'gastro','rapa':'rapa','festival':'concierto','feira':'feira'}.get(tipo,'verbena'),
        'destacada': cob>=4, 'orden': cob, 'procesion': False, 'familiar': False,
        'busqueda': norm(f"{nombre} {r.get('parroquia')} {conc} {r.get('provincia')} {' '.join(gastro)}"),
        'fuentes':['investigacion-web'],
    }
    existing_ids.add(e['id'])
    add.append(e)

import shutil
shutil.copy(f'{BASE}/verbenas.json', f'{BASE}/_backup_predetalle/verbenas_preadd.json')
out=ver+add
json.dump(out, open(f'{BASE}/verbenas.json','w'), ensure_ascii=False, indent=1)
from collections import Counter
print('=== ADD NUEVAS OK ===')
print('candidatas:',len(nuevas),'| añadidas:',len(add),'| dups saltadas:',dup)
print('total verbenas.json:',len(out))
print('nuevas por tipo:',dict(Counter(e['tipo'] for e in add)))
print('nuevas por estado:',dict(Counter(e['estado'] for e in add)))
print('con fecha:',sum(1 for e in add if e['fechaInicio']))
