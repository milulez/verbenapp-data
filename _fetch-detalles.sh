#!/bin/bash
# Baja las páginas de detalle /fiesta/{id} de las actuaciones Galicia, en paralelo.
# Salida: /tmp/odg_det/{id}.html   (idempotente: salta las ya bajadas)
OUT=/tmp/odg_det; mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
python3 -c "import json;[print(a['id']) for a in json.load(open('${VERBEN_DIR:-/Users/milulez/Desktop/VerbenApp}/actuaciones-galicia.json'))]" \
| xargs -P 6 -I {} bash -c '
  f="'"$OUT"'/{}.html"
  [ -s "$f" ] && exit 0
  curl -sL -A "'"$UA"'" "https://www.orquestasdegalicia.es/fiesta/{}/x" -o "$f"
'
echo "bajadas: $(ls "$OUT" | wc -l | tr -d ' ') / $(python3 -c "import json;print(len(json.load(open('${VERBEN_DIR:-/Users/milulez/Desktop/VerbenApp}/actuaciones-galicia.json'))))")"
