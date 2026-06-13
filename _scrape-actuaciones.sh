#!/bin/bash
# Scrapea TODAS las actuaciones de orquestasdegalicia.es por ventanas de fecha.
# POST /fiestas con fechaDesde/HastaBuscadorFiestas (dd/mm/yyyy) -> HTML server-rendered.
# Salida: /tmp/odg_pages/win_*.html  (parsea con _parse-actuaciones.py)
set -e
OUT=/tmp/odg_pages; mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
# ventanas semanales 13 jun -> 30 sep 2026
wins=$(python3 - <<'PY'
import datetime as d
s=d.date(2026,6,13); e=d.date(2026,9,30); cur=s
while cur<=e:
    f=cur+d.timedelta(days=6)
    if f>e: f=e
    print(cur.strftime('%d/%m/%Y'), f.strftime('%d/%m/%Y'))
    cur=f+d.timedelta(days=1)
PY
)
i=0
echo "$wins" | while read desde hasta; do
  i=$((i+1)); tag=$(printf "%02d" $i)
  curl -sL -A "$UA" -X POST "https://www.orquestasdegalicia.es/fiestas" \
    --data-urlencode "fechaDesdeBuscadorFiestas=$desde" \
    --data-urlencode "fechaHastaBuscadorFiestas=$hasta" \
    --data-urlencode "provinciaBuscadorFiestas=" \
    --data-urlencode "formacionBuscadorFiestas=" \
    --data-urlencode "lugarBuscadorFiestas=" \
    -o "$OUT/win_$tag.html" 2>/dev/null
  n=$(grep -oE '/fiesta/[0-9]+/[0-9]{2}-[0-9]{2}-[0-9]{4}_' "$OUT/win_$tag.html" | wc -l | tr -d ' ')
  echo "win $tag  $desde -> $hasta : $n entries"
  sleep 1
done
echo "DONE. pages in $OUT"
