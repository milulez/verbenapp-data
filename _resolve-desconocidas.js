export const meta = {
  name: 'resolve-desconocidas',
  description: 'Caza la fecha 2026 de fiestas con estado desconocida. args = lista de buckets {label, items:[{concello,provincia,parroquia,nombre,regla}]}.',
  phases: [{ title: 'Fechas', detail: 'Un agente por bucket: busca cartel 2026 de cada fiesta sin fecha' }],
}
let A = args
if (typeof A === "string") { try { A = JSON.parse(A) } catch { A = [] } }
A = Array.isArray(A) ? A : []

const SCHEMA = {
  type: "object", required: ["resolved"],
  properties: {
    resolved: { type: "array", items: {
      type: "object", required: ["concello", "nombre", "fecha", "estado"],
      properties: {
        concello: { type: "string" },
        parroquia: { type: "string" },
        nombre: { type: "string" },
        fecha: { type: "string" },     // YYYY-MM-DD o "" si no se encuentra
        fechaFin: { type: "string" },
        estado: { enum: ["confirmada", "fija", "recurrente", "desconocida"] },
        fuente: { type: "string" },
      },
    }},
  },
}

const PROMPT = (bk) =>
  "## Cazar fecha 2026 de fiestas SIN fecha (Galicia, verano)\n\n" +
  "Para CADA fiesta de la lista, encuentra su fecha EXACTA de 2026 (15 jun–30 sep). Son fiestas reales cuyo día aún no tenemos.\n\n" +
  "## Lista (" + bk.items.length + " fiestas)\n" +
  bk.items.map((f, i) => `${i + 1}. [${f.concello}] "${f.nombre}"${f.parroquia ? " · parroquia: " + f.parroquia : ""}${f.regla ? " · pista: " + f.regla : ""}`).join("\n") + "\n\n" +
  "## Fuentes (WebSearch)\n" +
  "- orquestasdegalicia.es (bolo de orquesta = fecha exacta de la verbena)\n" +
  "- paxinasgalegas.es/fiestas, programa de festas del concello, web oficial\n" +
  "- Facebook de la comisión de festas / parroquia\n\n" +
  "## Reglas de salida (la FECHA es lo crítico, NO inventar)\n" +
  "- Si encuentras día exacto 2026 con fuente → fecha YYYY-MM-DD + estado 'confirmada'.\n" +
  "- Si es santo de día fijo (Carme 16 jul, San Roque 16 ago, San Pedro 29 jun, Santiago 25 jul, Asunción 15 ago, San Lourenzo 10 ago, Santa Mariña 18 jul, San Bartolomeu 24 ago, San Xoán 24 jun, Remedios 8 sep, etc.) y la fiesta se celebra ese día → fecha + estado 'fija'.\n" +
  "- Si solo hay regla calculable (ej. 'primer sábado de agosto') → calcula la fecha 2026 + estado 'recurrente'. (2026: ago sáb=1,8,15,22,29; jul sáb=4,11,18,25; dom jul=5,12,19,26)\n" +
  "- Si NO encuentras nada fiable → fecha '' + estado 'desconocida'. NO inventes.\n" +
  "- Devuelve 'concello' y 'nombre' EXACTOS de la lista (para poder casar).\n\n" +
  "Solo salida estructurada."

phase("Fechas")
const out = await parallel(A.map(bk => () =>
  agent(PROMPT(bk), { label: bk.label.slice(0, 30), phase: "Fechas", schema: SCHEMA, agentType: "Explore" })
    .then(r => r ? { label: bk.label, resolved: r.resolved || [] } : null)
))
const ok = out.filter(Boolean)
const all = ok.flatMap(b => b.resolved)
const conFecha = all.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.fecha)).length
log("Buckets OK " + ok.length + "/" + A.length + " · resueltas con fecha " + conFecha + "/" + all.length)
return { buckets: ok, totalResueltas: conFecha, total: all.length }
