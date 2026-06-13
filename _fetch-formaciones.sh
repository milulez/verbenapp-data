#!/bin/bash
# Baja páginas de formación /formaciones/{tipo_slug} en paralelo. Salida /tmp/odg_form/{tipo_slug}.html
OUT=/tmp/odg_form; mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
python3 -c "import json;[print(s) for s in json.load(open('/tmp/form_slugs.json'))]" \
| xargs -P 6 -I {} bash -c '
  f="'"$OUT"'/{}.html"
  [ -s "$f" ] && exit 0
  curl -sL -A "'"$UA"'" "https://www.orquestasdegalicia.es/formaciones/{}" -o "$f"
'
echo "bajadas: $(ls "$OUT" | wc -l | tr -d ' ') / $(python3 -c "import json;print(len(json.load(open('/tmp/form_slugs.json'))))")"
