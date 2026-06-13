#!/bin/bash
# Scrapea veranos PASADOS (2023-2025) de orquestasdegalicia.es para histórico por parroquia.
# Mismo método que _scrape-actuaciones.sh pero años anteriores. Salida /tmp/odg_hist/{año}_win_NN.html
set -e
OUT=/tmp/odg_hist; mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
for Y in 2023 2024 2025; do
  wins=$(python3 - "$Y" <<'PY'
import datetime as d, sys
Y=int(sys.argv[1]); s=d.date(Y,6,1); e=d.date(Y,9,30); cur=s
while cur<=e:
    f=cur+d.timedelta(days=9)
    if f>e: f=e
    print(cur.strftime('%d/%m/%Y'), f.strftime('%d/%m/%Y'))
    cur=f+d.timedelta(days=1)
PY
)
  i=0
  echo "$wins" | while read desde hasta; do
    i=$((i+1)); tag=$(printf "%s_win_%02d" "$Y" $i)
    f="$OUT/$tag.html"
    [ -s "$f" ] && { echo "skip $tag"; continue; }
    curl -sL -A "$UA" -X POST "https://www.orquestasdegalicia.es/fiestas" \
      --data-urlencode "fechaDesdeBuscadorFiestas=$desde" \
      --data-urlencode "fechaHastaBuscadorFiestas=$hasta" \
      --data-urlencode "provinciaBuscadorFiestas=" --data-urlencode "formacionBuscadorFiestas=" --data-urlencode "lugarBuscadorFiestas=" \
      -o "$f" 2>/dev/null
    n=$(grep -oE '/fiesta/[0-9]+/[0-9]{2}-[0-9]{2}-[0-9]{4}_' "$f" | wc -l | tr -d ' ')
    echo "$tag : $n"
    sleep 0.5
  done
done
echo "DONE hist: $(ls $OUT | wc -l | tr -d ' ') paginas"
