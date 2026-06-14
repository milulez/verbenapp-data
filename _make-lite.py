#!/usr/bin/env python3
# Genera verbenas-lite.json (campos de listado/buscador/mapa) desde verbenas.json. Último paso.
import json
import os as _o; BASE=_o.environ.get('VERBEN_DIR') or _o.path.dirname(_o.path.abspath(__file__))
v=json.load(open(f'{BASE}/verbenas.json'))
LITE=['id','nombrePopular','nombre','concello','parroquia','provincia','comarca','cuando','horaInicio','fechaInicio','fechaFin','estado','fechaOrientativa','tipo','cobertura','destacada','temCartel','franja','imagenCat','fotoOrquesta','orquestaCabeza','comida','atracciones','fuegos','verbena','lat','lng','busqueda','reclamo']
lite=[{k:x.get(k) for k in LITE if x.get(k) is not None} for x in v]
json.dump(lite,open(f'{BASE}/verbenas-lite.json','w'),ensure_ascii=False,separators=(',',':'))
print('verbenas-lite.json:',len(lite))
