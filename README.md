# VerbenApp · datos

Directorio de verbenas de Galicia (verano 2026). Este repo regenera **`verbenas.json`** (~4.850 fiestas, calendario real con orquesta + hora + recinto + servicios) y **`orquestas.json`** (246 bandas con foto/ranking/redes), scrapeando orquestasdegalicia.es.

## Auto-refresco (GitHub Actions)
`.github/workflows/refresh.yml` corre el pipeline **cada lunes** (y a mano con *Run workflow*), regenera los JSON y los commitea. La app los lee por CDN, así que se actualizan solos sin redeploy.

## La app lee el JSON por jsDelivr (CDN global, CORS abierto)
```
https://cdn.jsdelivr.net/gh/USUARIO/REPO@main/verbenas.json
https://cdn.jsdelivr.net/gh/USUARIO/REPO@main/orquestas.json
```
En Lovable, en lugar de incrustar el JSON, hacer fetch:
```js
const verbenas = await fetch(
  'https://cdn.jsdelivr.net/gh/USUARIO/REPO@main/verbenas.json'
).then(r => r.json());
```
> jsDelivr cachea ~12 h. Para forzar la versión más fresca tras un refresco: usar `@latest` o purgar en `purge.jsdelivr.net`.

## Puesta en marcha (una vez)
```bash
# 1. crear repo PÚBLICO en GitHub (web o gh) y subir esto
git init && git add -A && git commit -m "init"
gh repo create verbenapp-data --public --source=. --push   # o crear en web y git push

# 2. en GitHub → Settings → Actions → General → Workflow permissions = Read and write
# 3. Actions → "Refrescar verbenas" → Run workflow (primer disparo manual)
```

## Correr el pipeline a mano (local)
```bash
bash run-pipeline.sh        # regenera verbenas.json + orquestas.json
```

## Orden interno del pipeline
`_export.js` → `_scrape-actuaciones.sh` → `_parse-actuaciones.py` → `_merge-actuaciones.py`
→ `_fetch-detalles.sh` → `_parse-detalles.py` → `_enrich-detalles.py`
→ `_fetch-formaciones.sh` + rankings → `_parse-formaciones.py` → `_boost-orquestas.py`

Fuentes base: `concellos-*.ts` + `fiestas.ts` (parroquias + fiestas estrella). Coords cacheadas en `_cache/`.
