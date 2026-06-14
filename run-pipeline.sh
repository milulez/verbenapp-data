#!/bin/bash
# Pipeline completo VerbenApp: regenera verbenas.json + orquestas.json desde cero.
# Local:  bash run-pipeline.sh
# CI:     VERBEN_DIR=$PWD bash run-pipeline.sh
set -euo pipefail
export VERBEN_DIR="${VERBEN_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$VERBEN_DIR"
echo "== VERBEN_DIR=$VERBEN_DIR =="

# coords cacheadas -> /tmp (las leen _export.js y _merge-actuaciones.py)
cp -f _cache/concello_coords.json /tmp/concello_coords.json
cp -f _cache/estrella_coords.json /tmp/estrella_coords.json

echo "== 1/8 export base (fuentes .ts) =="
node _export.js
echo "== 2/8 scrape actuaciones (ventanas verano) =="
bash _scrape-actuaciones.sh
echo "== 3/8 parse actuaciones =="
python3 _parse-actuaciones.py
echo "== 4/8 merge actuaciones -> verbenas =="
python3 _merge-actuaciones.py
echo "== 5/8 fetch + parse + enrich detalle (hora/recinto/servicios) =="
bash _fetch-detalles.sh
python3 _parse-detalles.py
python3 _enrich-detalles.py
echo "== 6/8 fetch formaciones + rankings =="
curl -sL -A "Mozilla/5.0" "https://www.orquestasdegalicia.es/rankings" -o /tmp/rk.html
bash _fetch-formaciones.sh
echo "== 7/8 parse formaciones -> orquestas.json =="
python3 _parse-formaciones.py
echo "== 8/10 boost orquestas (foto+tiron+cobertura) =="
python3 _boost-orquestas.py
echo "== 9/10 historico (años anteriores + fecha orientativa para las sin data) =="
# historico.json se construye una vez (_scrape-historico.sh + _build-historico.py) y se commitea
if [ -f historico.json ]; then python3 _apply-historico.py; else echo "  (sin historico.json, salto)"; fi
echo "== 9b/10 historia web (investigación piloto por fiesta, si existe) =="
if [ -f historia.json ]; then python3 _merge-historia.py; else echo "  (sin historia.json, salto)"; fi
echo "== 9c/10 investigación por concello (research/*.json -> match a verbenas) =="
if ls research/*.json >/dev/null 2>&1; then python3 _match-research.py; else echo "  (sin research/, salto)"; fi
echo "== 9d/10 alta de fiestas nuevas descubiertas (research_nuevas.json) =="
if [ -f research_nuevas.json ]; then python3 _add-nuevas.py; else echo "  (sin research_nuevas.json, salto)"; fi
echo "== 10/10 indice de busqueda (orquesta/churrasco/atracciones/lenguaje natural) =="
python3 _searchindex.py

# --- guarda de validación: no commitear basura si el scrape falló ---
python3 - <<'PY'
import json,sys
v=json.load(open('verbenas.json')); o=json.load(open('orquestas.json'))
nconf=sum(1 for x in v if x.get('estado')=='confirmada')
nband=sum(1 for x in v if x.get('bandas'))
print(f'VALIDACION: verbenas={len(v)} confirmadas={nconf} con_banda={nband} orquestas={len(o)}')
assert len(v)>=4000, 'verbenas < 4000 (scrape roto?)'
assert len(o)>=100, 'orquestas < 100 (scrape roto?)'
assert nband>=800, 'pocas bandas (merge roto?)'
assert len({x['id'] for x in v})==len(v), 'ids duplicados'
print('VALIDACION OK')
PY
echo "== PIPELINE OK =="
