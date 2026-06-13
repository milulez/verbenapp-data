#!/usr/bin/env python3
# Parsea /tmp/odg_det/{id}.html -> actuaciones-detalle.json (id, lat, lng, terreno, horario, servicios[])
import re, json, glob, html
def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
out={}
for fp in glob.glob('/tmp/odg_det/*.html'):
    fid=fp.split('/')[-1][:-5]
    h=open(fp,encoding='utf-8',errors='ignore').read()
    if len(h)<2000: continue
    # coords: primer par lat(4x.xxxx) lng(-x.xxxx) en el bloque del mapa
    mlat=re.search(r'\b(4[0-9]\.\d{4,})\b',h); mlng=re.search(r'(-[0-9]\.\d{4,})\b',h)
    # terreno
    ter=re.search(r'Tipo de terreno\s*</span>\s*<span[^>]*>\s*([^<]+?)\s*</span>',h)
    if not ter: ter=re.search(r'Tipo de terreno[^A-Za-zÁ-ú]{0,20}([A-Za-zÁ-ú]+)',clean(h))
    terv=clean(ter.group(1)) if ter else ''
    if terv.lower().startswith('no disp'): terv=''
    # horario
    hor=re.search(r'Horario\s*</span>\s*<span[^>]*>\s*([^<]+?)\s*</span>',h)
    if not hor: hor=re.search(r'Horario[^A-Za-zÁ-ú]{0,10}(Noche|Tarde|D[ií]a|Verm[uú]|Ma[ñn]ana|Madrugada)',clean(h))
    horv=clean(hor.group(1)) if hor else ''
    # servicios: <span class="lead">Hay: ...</span>
    hay=re.search(r'Hay:\s*([^<]+)</span>',h)
    serv=[s.strip() for s in re.split(r'[,/]',hay.group(1))] if hay else []
    serv=[s for s in serv if s]
    out[fid]={'id':fid,
        'lat':float(mlat.group(1)) if mlat else None,
        'lng':float(mlng.group(1)) if mlng else None,
        'terreno':terv,'horario':horv,'servicios':serv}
json.dump(out, open(f'{BASE}/actuaciones-detalle.json','w'), ensure_ascii=False, indent=1)
from collections import Counter
vals=list(out.values())
print('detalles parseados:',len(vals))
print('con coords:',sum(1 for x in vals if x['lat']))
print('con horario:',sum(1 for x in vals if x['horario']),'->',dict(Counter(x['horario'] for x in vals if x['horario'])))
print('con terreno:',sum(1 for x in vals if x['terreno']),'->',dict(Counter(x['terreno'] for x in vals if x['terreno']).most_common(8)))
print('con servicios:',sum(1 for x in vals if x['servicios']))
allserv=Counter(s for x in vals for s in x['servicios'])
print('servicios top:',dict(allserv.most_common(15)))
