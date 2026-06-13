export const meta = {
  name: 'concellos-resto',
  description: 'Resto de comarcas pendientes (Ourense: Viana/Verín/Ribeiro + Pontevedra) en LOTES pequeños. args = {offset, limit}.',
  phases: [{ title: 'Comarcas', detail: 'Lote pequeño de comarcas: concellos + festas patronais' }],
}

const CONCELLO_SCHEMA = {
  type: "object", required: ["concellos"],
  properties: {
    concellos: { type: "array", items: {
      type: "object", required: ["nombre", "fiestas"],
      properties: {
        nombre: { type: "string" },
        fiestas: { type: "array", items: {
          type: "object", required: ["nombre", "estado"],
          properties: {
            nombre: { type: "string" }, parroquia: { type: "string" },
            fechaInicio: { type: "string" }, fechaFin: { type: "string" },
            estado: { enum: ["confirmada", "fija", "recurrente", "desconocida"] },
            regla: { type: "string" },
            tipo: { enum: ["concierto", "gastronomica", "tradicional", "romeria", "patronal"] },
            nota: { type: "string" },
          },
        }},
      },
    }},
  },
}

// 13 comarcas pendientes
const ALL = [
  { provincia: "Ourense", comarca: "Viana", concellos: ["A Gudiña","A Mezquita","Viana do Bolo","Vilariño de Conso"] },
  { provincia: "Ourense", comarca: "Verín (Monterrei)", concellos: ["Castrelo do Val","Cualedro","Laza","Monterrei","Oímbra","Riós","Verín","Vilardevós"] },
  { provincia: "Ourense", comarca: "O Ribeiro", concellos: ["Arnoia","Avión","Beade","Carballeda de Avia","Castrelo de Miño","Cenlle","Cortegada","Leiro","Melón","Ribadavia"] },
  { provincia: "Pontevedra", comarca: "Pontevedra", concellos: ["Barro","Campo Lameiro","Cerdedo-Cotobade","Marín","Poio","Ponte Caldelas","Pontevedra","Vilaboa"] },
  { provincia: "Pontevedra", comarca: "O Salnés", concellos: ["Cambados","Catoira","O Grove","A Illa de Arousa","Meaño","Meis","Ribadumia","Sanxenxo","Vilagarcía de Arousa","Vilanova de Arousa"] },
  { provincia: "Pontevedra", comarca: "O Morrazo", concellos: ["Bueu","Cangas","Moaña"] },
  { provincia: "Pontevedra", comarca: "Vigo", concellos: ["Baiona","Fornelos de Montes","Gondomar","Mos","Nigrán","Pazos de Borbén","O Porriño","Redondela","Salceda de Caselas","Soutomaior","Vigo"] },
  { provincia: "Pontevedra", comarca: "O Baixo Miño", concellos: ["A Guarda","Oia","O Rosal","Tomiño","Tui"] },
  { provincia: "Pontevedra", comarca: "Caldas", concellos: ["Caldas de Reis","Cuntis","Moraña","Pontecesures","Portas","Valga"] },
  { provincia: "Pontevedra", comarca: "O Deza", concellos: ["Agolada","Dozón","Lalín","Rodeiro","Silleda","Vila de Cruces"] },
  { provincia: "Pontevedra", comarca: "Tabeirós-Terra de Montes", concellos: ["A Estrada","Forcarei"] },
  { provincia: "Pontevedra", comarca: "O Condado", concellos: ["As Neves","Mondariz","Mondariz-Balneario","Ponteareas","Salvaterra de Miño"] },
  { provincia: "Pontevedra", comarca: "A Paradanta", concellos: ["Arbo","A Cañiza","Covelo","Crecente"] },
]

// Lote: args = {offset, limit} (acepta objeto O string JSON). Por defecto 0..5.
let A = args
if (typeof A === "string") { try { A = JSON.parse(A) } catch { A = {} } }
A = A || {}
const offset = Number.isFinite(Number(A.offset)) ? Number(A.offset) : 0
const limit = Number.isFinite(Number(A.limit)) ? Number(A.limit) : 5
const BATCH = ALL.slice(offset, offset + limit)

const PROMPT = (c) =>
  "## Investigador de festas patronais — Comarca de " + c.comarca + " (provincia de " + c.provincia + ", Galicia)\n\n" +
  "Concellos (verifica y completa si falta alguno): " + c.concellos.join(", ") + ".\n\n" +
  "Para CADA concello, su(s) fiesta(s) principal(es) de VERANO (15 jun–sep 2026): festas patronais + 1-2 parroquias sonadas.\n" +
  "Cada fiesta: nombre; parroquia (si aplica); estado+fecha 2026 → 'fija' (santo fijo: San Roque 16 ago, Santiago 25 jul, Carme 16 jul, San Xoán 24 jun, San Pedro 29 jun, Asunción 15 ago, Remedios 8 sep), 'confirmada' (cartel 2026), 'recurrente' (regla calculable), 'desconocida' (sin fecha fiable → deja fechas '' pero incluye con patrón en 'regla'); regla (texto); tipo (patronal/romeria/gastronomica/concierto/tradicional); nota corta.\n" +
  "La FECHA es lo más crítico: NO inventes; si dudas 'desconocida'+santo. 2026: 16 ago=dom, 25 jul=sáb, 15 ago=sáb, 24 jun=mié, 8 sep=mar.\n" +
  "Cubre TODOS los concellos. WebSearch para patrones inciertos.\n\nSolo salida estructurada."

phase("Comarcas")
const results = await parallel(
  BATCH.map(c => () =>
    agent(PROMPT(c), { label: c.provincia.slice(0,2) + ":" + c.comarca, phase: "Comarcas", schema: CONCELLO_SCHEMA, agentType: "Explore" })
      .then(r => r ? { provincia: c.provincia, comarca: c.comarca, concellos: r.concellos } : null)
  )
)
const ok = results.filter(Boolean)
const flat = []
for (const r of ok) for (const c of r.concellos) flat.push({ ...c, comarca: r.comarca, provincia: r.provincia })
log("Lote " + offset + ".." + (offset+BATCH.length) + " · comarcas OK " + ok.length + "/" + BATCH.length + " · concellos " + flat.length)
return { offset, limit, done: ok.length, ofBatch: BATCH.length, totalComarcas: ALL.length, concellos: flat }
