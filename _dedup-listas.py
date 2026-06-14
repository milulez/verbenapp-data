#!/usr/bin/env python3
# Limpia comida[] y bandas[] de verbenas.json: canoniza familias (mexillón x4 -> "Mexillóns"),
# quita nombres de evento ("XXIV Gran Churrascada" -> "Churrasco"), dedup; en bandas colapsa
# "Orquesta Cinema"/"Cinema". Corre antes de _searchindex.
import json, re, unicodedata
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
def nt(s):
    s=unicodedata.normalize('NFKD',str(s or '')).encode('ascii','ignore').decode().lower()
    return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9 ]',' ',s)).strip()
# familias de comida: (substring en texto normalizado) -> etiqueta canónica
FOOD=[('mexill','Mexillóns'),('mejill','Mexillóns'),('churrasc','Churrasco'),('sardin','Sardiñada'),
('sardi','Sardiñada'),('polbo','Pulpo'),('pulp','Pulpo'),('empanada','Empanada'),('callos','Callos'),
('paella','Paella'),('caldeiro','Carne ao caldeiro'),('richada','Carne ao caldeiro'),('cocido','Cocido'),
('queimada','Queimada'),('cervex','Cervexa'),('cerve','Cervexa'),('vino','Viño'),('viño','Viño'),('caldos','Viño'),
('pement','Pementos'),('pimient','Pementos'),('bica','Bica'),('filloa','Filloas'),('ostra','Ostras'),
('chorizo','Chorizo'),('lacon','Lacón'),('picanton','Polo asado'),('polo asado','Polo asado'),('pollo','Polo asado'),
('carneiro','Carneiro ao espeto'),('cochi','Porco/Cochinillo'),('porqui','Porco/Cochinillo'),('porco','Porco/Cochinillo'),
('langost','Langostinos'),('tortilla','Tortilla'),('queixo','Queixo'),('queso','Queixo'),('bocater','Bocadillos'),
('bocadillo','Bocadillos'),('panceta','Panceta'),('pancetada','Panceta'),('androlla','Androlla'),('butelo','Butelo'),
('navalla','Navallas'),('longueir','Longueirón'),('percebe','Percebes'),('marisco','Marisco'),('troita','Troita'),
('cordeiro','Cordeiro'),('costill','Costillar'),('orella','Orella'),('cigala','Cigalada'),('zorza','Zorza'),
('requeixo','Requeixo'),('pan de millo','Pan de millo'),('xixo','Xixó'),('cereixa','Cereixas'),('cherry','Cereixas'),
('tapas','Tapas'),('pinchos','Tapas'),('postre','Postres'),('dulce','Postres'),('repost','Postres'),
('cafe','Café'),('xantar','Comida popular'),('comida popular','Comida popular'),('cena popular','Comida popular'),
('degustaci','Comida popular'),('mexillada','Mexillóns')]
DROP_FOOD=['sesion vermu','vermu','refresco','agua','auga','chupito','bebida','postre, cafe']  # no son plato
def canon_comida(items):
    out=[]
    for it in items or []:
        t=nt(it)
        if not t: continue
        if any(d in t for d in DROP_FOOD) and not any(k in t for k,_ in FOOD): continue
        lab=None
        for kw,canon in FOOD:
            if kw in t: lab=canon; break
        if not lab:
            # ¿parece nombre de evento, no plato? (números romanos, "festa", "gran", edición)
            if re.search(r'\b(festa|gran|edicion|edición|festas|campionato|feira|sesion)\b',t) or re.match(r'^[ivxl]+ ',t): continue
            lab=it.strip().capitalize()
        if lab not in out: out.append(lab)
    return out
PREF=re.compile(r'^(orquestas?|grupo|charanga|d[uú]o|tr[ií]o|disco m[oó]vil|discomovil|disco|banda(\s+de\s+m[uú]sica)?|solista|artista|coral|coro)\s+',re.I)
def canon_bandas(items):
    seen={}; order=[]
    for b in items or []:
        name=PREF.sub('',b).strip()
        if not name: name=b.strip()
        k=nt(name)
        if not k: continue
        if k not in seen:
            seen[k]=name; order.append(k)
        else:
            # preferir versión sin prefijo genérico / más corta
            if len(name)<len(seen[k]): seen[k]=name
    return [seen[k] for k in order]

ver=json.load(open(f'{BASE}/verbenas.json'))
cf=bf=0
for v in ver:
    if v.get('comida'):
        n=canon_comida(v['comida'])
        if n!=v['comida']: cf+=1
        v['comida']=n
    if v.get('bandas'):
        n=canon_bandas(v['bandas'])
        if n!=v['bandas']: bf+=1
        v['bandas']=n
    if v.get('bandasHistoricas'): v['bandasHistoricas']=canon_bandas(v['bandasHistoricas'])
json.dump(ver,open(f'{BASE}/verbenas.json','w'),ensure_ascii=False,indent=1)
print('comida limpiada en',cf,'| bandas limpiadas en',bf)
# muestra ejemplo
ex=[x for x in ver if x.get('concello')=='Oleiros' and 'dexo' in (x.get('busqueda') or '')]
if ex: print('Dexo comida:',ex[0].get('comida')); print('Dexo bandas:',ex[0].get('bandas'))
