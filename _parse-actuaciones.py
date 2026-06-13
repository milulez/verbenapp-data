#!/usr/bin/env python3
# Parsea /tmp/odg_pages/win_*.html -> /Users/milulez/Desktop/VerbenApp/actuaciones.json
# Cada actuacion: id, fecha(ISO), tipo, formacion, parroquia, concello, provincia, lugarTexto, url
import re, json, glob, html, unicodedata
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))

MES={'ene':'01','feb':'02','mar':'03','abr':'04','may':'05','jun':'06','jul':'07','ago':'08','sep':'09','oct':'10','nov':'11','dic':'12'}
PROVS={'a coruña','a coruna','lugo','ourense','pontevedra'}

def clean(s): return html.unescape(re.sub(r'\s+',' ',s)).strip()

# bloque de cada actuacion: ancla <a ... href="//.../fiesta/ID/DATE_tipo_..._lugar" ...> ... spans
ENTRY=re.compile(r'/fiesta/(\d+)/(\d{2})-(\d{2})-(\d{4})_([a-z-]+)_[^"]*"[^>]*>(.*?)</a>', re.S)
SPANS=re.compile(r'<span[^>]*>(.*?)</span>', re.S)

records={}
for fp in sorted(glob.glob('/tmp/odg_pages/win_*.html')):
    h=open(fp,encoding='utf-8',errors='ignore').read()
    for m in ENTRY.finditer(h):
        fid,dd,mm,yyyy,tipo,body=m.groups()
        fecha=f"{yyyy}-{mm}-{dd}"
        spans=[clean(re.sub(r'<[^>]+>','',s)) for s in SPANS.findall(body)]
        spans=[s for s in spans if s]
        formacion=lugar=''
        # primer span no vacio = formacion, span con "(Provincia)" = lugar
        for s in spans:
            if re.search(r'\([^)]+\)\s*$', s) and not lugar:
                lugar=s
            elif not formacion:
                formacion=s
        parroquia=concello=provincia=''
        mlug=re.match(r'(.*)\(([^)]+)\)\s*$', lugar)
        if mlug:
            left=mlug.group(1).strip().rstrip(',').strip()
            provincia=clean(mlug.group(2))
            parts=[p.strip() for p in left.split(',') if p.strip()]
            if len(parts)>=2: parroquia,concello=parts[0],parts[-1]
            elif len(parts)==1: concello=parts[0]
        rec={'id':fid,'fecha':fecha,'tipo':tipo.replace('-',' '),
             'formacion':formacion,'parroquia':parroquia,'concello':concello,
             'provincia':provincia,'lugarTexto':lugar,
             'url':f"https://www.orquestasdegalicia.es/fiesta/{fid}/"}
        records[fid]=rec  # dedup por id

recs=sorted(records.values(), key=lambda r:(r['fecha'],r['concello']))
json.dump(recs, open(f'{BASE}/actuaciones.json','w'), ensure_ascii=False, indent=1)
# subset Galicia (4 provincias) que consume el pipeline
GAL={'a coruña','a coruna','lugo','ourense','pontevedra'}
gal=[a for a in recs if (a['provincia'] or '').lower() in GAL]
json.dump(gal, open(f'{BASE}/actuaciones-galicia.json','w'), ensure_ascii=False, indent=1)
# slugs de formacion distintos (para _fetch-formaciones.sh)
slugs=set()
for fp in glob.glob('/tmp/odg_pages/win_*.html'):
    h=open(fp,encoding='utf-8',errors='ignore').read()
    for m in re.finditer(r'/fiesta/\d+/\d{2}-\d{2}-\d{4}_([a-z-]+)_([^_"]+)_',h):
        slugs.add(f"{m.group(1)}_{m.group(2)}")
json.dump(sorted(slugs), open('/tmp/form_slugs.json','w'))
print('actuaciones-galicia.json:',len(gal),'| form_slugs:',len(slugs))

from collections import Counter
print('TOTAL actuaciones unicas:', len(recs))
print('rango fechas:', recs[0]['fecha'],'->',recs[-1]['fecha'])
print('por tipo:', dict(Counter(r['tipo'] for r in recs)))
print('por provincia:', dict(Counter(r['provincia'] for r in recs)))
print('con concello:', sum(1 for r in recs if r['concello']), '/ con parroquia:', sum(1 for r in recs if r['parroquia']))
print('formaciones distintas:', len(set(r['formacion'].lower() for r in recs if r['formacion'])))
print('--- 6 samples ---')
for r in recs[:6]: print(r['fecha'],'|',r['tipo'],'|',r['formacion'],'|',r['parroquia'],'/',r['concello'],'(',r['provincia'],')')
