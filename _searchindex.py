#!/usr/bin/env python3
# Reconstruye el campo `busqueda` de cada verbena con TODO lo buscable:
# nombre, lugar, orquestas (nombre real, sin "orquesta"), comida (churrasco...), servicios,
# + etiquetas semánticas (atraccions, fogos, verbena...) para que la gente escriba lenguaje natural.
# Corre AL FINAL del pipeline (tras _boost-orquestas.py). Sobre-escribe `busqueda`.
import json, re, unicodedata
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def nt(s):
    # normaliza a texto: minúsculas, sin tildes, solo alfanumérico + espacios
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',s)).strip()
PREF=re.compile(r'^(orquesta|grupo|charanga|disco movil|duo|trio|artista)\s+',re.I)
def bandclean(b):  # "Orquesta EL COMBO" -> tambien "el combo" sin prefijo
    return PREF.sub('',b)

ver=json.load(open(f'{BASE}/verbenas.json'))
for v in ver:
    parts=[v.get('nombre'),v.get('nombrePopular'),v.get('parroquia'),v.get('concello'),
           v.get('comarca'),v.get('provincia'),v.get('santo'),v.get('tipo'),v.get('cuando'),
           v.get('historia'),v.get('destacado_txt')]
    # orquestas: nombre completo Y sin el prefijo "orquesta/grupo..."
    for b in (v.get('bandas') or []):
        parts.append(b); parts.append(bandclean(b))
    if v.get('orquestaCabeza'):
        parts.append(v['orquestaCabeza']); parts.append(bandclean(v['orquestaCabeza']))
    for b in (v.get('bandasHistoricas') or []):  # años anteriores: "¿dónde tocó X?"
        parts.append(b); parts.append(bandclean(b))
    # comida (churrasco, pulpo, sardiñada...) y servicios
    parts += (v.get('comida') or [])
    parts += (v.get('servicios') or [])
    # etiquetas semánticas (lenguaje natural) solo si el dato es cierto
    tags=[]
    if v.get('atracciones'): tags+=['atraccions','atracciones','cacharritos','cacharrinos','feira','feria']
    if v.get('fuegos'): tags+=['fogos','fuegos','fuegos artificiales','pirotecnia']
    if v.get('verbena'): tags+=['verbena','orquesta','orquestas','baile','festa','fiesta']
    if v.get('procesion'): tags+=['procesion','misa']
    if v.get('familiar'): tags+=['familiar','nenos','ninos']
    if v.get('comida'): tags+=['comida','comer']
    fr=v.get('franja')
    if fr=='noche': tags+=['noite','noche']
    elif fr=='vermú': tags+=['vermu','aperitivo']
    parts+=tags
    v['busqueda']=' '.join(dict.fromkeys(filter(None,(nt(p) for p in parts))))  # dedup, orden
json.dump(ver,open(f'{BASE}/verbenas.json','w'),ensure_ascii=False,indent=1)

# comprobaciones
def hits(q): return sum(1 for v in ver if nt(q) in v['busqueda'])
print('=== INDICE BUSQUEDA OK ===')
for q in ['combo dominicano','panorama','paris de noia','churrasco','atracciones','pulpo','fuegos','sardiñada','verbena']:
    print(f"  '{q}' -> {hits(q)} verbenas")
