export const meta = {
  name: 'deepen-parroquias',
  description: 'Saca TODAS las parroquias con verbena de verano de cada concello (capa parroquial exhaustiva). args = lote de concellos.',
  phases: [{ title: 'Parroquias', detail: 'Un agente por concello: todas sus parroquias con fiesta de verano' }],
}

let A = args
if (typeof A === "string") { try { A = JSON.parse(A) } catch { A = [] } }
A = Array.isArray(A) ? A : []

const SCHEMA = {
  type: "object", required: ["concello", "fiestas"],
  properties: {
    concello: { type: "string" },
    fiestas: { type: "array", items: {
      type: "object", required: ["nombre", "estado"],
      properties: {
        nombre: { type: "string" },
        parroquia: { type: "string" },
        fechaInicio: { type: "string" }, fechaFin: { type: "string" },
        estado: { enum: ["confirmada", "fija", "recurrente", "desconocida"] },
        regla: { type: "string" },
        tipo: { enum: ["concierto", "gastronomica", "tradicional", "romeria", "patronal"] },
        nota: { type: "string" },
      },
    }},
  },
}

const PROMPT = (c) =>
  "## Capa parroquial EXHAUSTIVA — concello de " + c.concello + " (" + c.provincia + ", Galicia)\n\n" +
  "Lista TODAS las parroquias y lugares del concello de " + c.concello + " que celebran fiesta patronal o verbena en VERANO (15 junio–30 septiembre 2026). Sé EXHAUSTIVO: el valor está en no dejarte ninguna. Un concello gallego suele tener entre 5 y 25 fiestas parroquiales en verano.\n\n" +
  "## Fuentes a usar (WebSearch)\n" +
  "- paxinasgalegas.es/fiestas/<concello> (lista fiestas por parroquia)\n" +
  "- orquestasdegalicia.es/fiestas/<provincia>/<concello> (cada bolo de orquesta = una verbena con fecha)\n" +
  "- galiciafiestas.es, web oficial del concello, programas de festas\n\n" +
  "## Para cada fiesta\n" +
  "- nombre (ej. 'Festas do Carme', 'San Roque de X')\n" +
  "- parroquia o lugar (IMPRESCINDIBLE en esta capa)\n" +
  "- estado+fecha 2026: 'fija' (santo fijo: Carme 16 jul, San Roque 16 ago, San Pedro 29 jun, Santiago 25 jul, Asunción 15 ago, San Lourenzo 10 ago, Santa Mariña 18 jul, San Bartolomeu 24 ago, San Xoán 24 jun, Remedios 8 sep), 'confirmada' (cartel/orquesta 2026 con fecha), 'recurrente' (regla calculable), 'desconocida' (sin fecha fiable → deja fechas '' pero incluye con patrón en 'regla').\n" +
  "- regla (texto), tipo, nota corta (orquesta habitual, comida, qué tiene).\n\n" +
  "La FECHA es lo más crítico: NO inventes. Si dudas, 'desconocida' + santo. 2026: 16 ago=dom, 25 jul=sáb, 15 ago=sáb, 24 jun=mié, 8 sep=mar.\n" +
  "Devuelve 'concello' EXACTO: \"" + c.concello + "\".\n\nSolo salida estructurada."

phase("Parroquias")
const out = await parallel(A.map(c => () =>
  agent(PROMPT(c), { label: c.concello, phase: "Parroquias", schema: SCHEMA, agentType: "Explore" })
    .then(r => r ? { provincia: c.provincia, concello: c.concello, fiestas: r.fiestas } : null)
))
const ok = out.filter(Boolean)
const totalF = ok.reduce((n, c) => n + (c.fiestas?.length || 0), 0)
log("Concellos OK " + ok.length + "/" + A.length + " · fiestas parroquiales " + totalF)
return { concellos: ok, totalFiestas: totalF }
