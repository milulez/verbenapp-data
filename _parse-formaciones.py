#!/usr/bin/env python3
# Parsea /tmp/odg_form/*.html + /tmp/rk.html -> orquestas.json
# (foto portada, año fundación, descripcion, redes, ranking puesto). Requiere _fetch-formaciones.sh + rk.html.
import re,html,glob,json,unicodedata
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
def norm(s):
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','',s)
rk=open('/tmp/rk.html',encoding='utf-8',errors='ignore').read()
seen=[]
for m in re.finditer(r'/formaciones/([a-z]+_[a-z0-9-]+)',rk):
    if m.group(1) not in seen: seen.append(m.group(1))
rankpos={s:i+1 for i,s in enumerate(seen)}
out=[]
for fp in glob.glob('/tmp/odg_form/*.html'):
    slug=fp.split('/')[-1][:-5]; h=open(fp,encoding='utf-8',errors='ignore').read()
    if len(h)<2000: continue
    tipo=slug.split('_')[0]
    t=re.search(r'<title>(.*?)\s*-\s*Orquestas',h); nombre=clean(t.group(1)) if t else slug
    foto=re.search(r'og:image" content="([^"]+)"',h); foto=foto.group(1) if foto else None
    if foto and 'logo' in foto.lower(): foto=None
    fund=re.search(r'Año de fundación\s*</?\w*>?\s*(\d{4})',h) or re.search(r'fundación[^0-9]{0,20}(\d{4})',clean(h))
    desc=re.search(r'og:description" content="([^"]+)"',h); desc=clean(desc.group(1)) if desc else ''
    redes=sorted(set(re.findall(r'https?://(?:www\.)?(?:facebook\.com/[^/\s"\'<>]+|instagram\.com/[^/\s"\'<>]+|twitter\.com/(?!intent|share)[^/\s"\'<>]+|youtube\.com/[^\s"\'<>]+)',h)))
    redes=[r for r in redes if not any(k in r for k in ['sharer','intent','orquestasgz','app.orquestas'])]
    out.append({'slug':slug,'tipo':tipo,'nombre':nombre,
        'nombreNorm':norm(nombre.split(maxsplit=1)[-1] if ' ' in nombre else nombre),
        'foto':foto,'anoFundacion':int(fund.group(1)) if fund else None,
        'descripcion':desc,'redes':redes,'rankingPuesto':rankpos.get(slug)})
out.sort(key=lambda x:(x['rankingPuesto'] or 999,x['nombre']))
json.dump(out,open(f'{BASE}/orquestas.json','w'),ensure_ascii=False,indent=1)
print('orquestas.json:',len(out),'| con foto:',sum(1 for x in out if x['foto']),'| ranked:',sum(1 for x in out if x['rankingPuesto']))
