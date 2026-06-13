export const meta = {
  name: 'scrape-orquestas',
  description: 'Saca la gira 2026 de cada orquesta gallega (lugar+fecha por bolo = una verbena confirmada). args = lista de nombres de orquesta.',
  phases: [{ title: 'Giras', detail: 'Un agente por orquesta: todos sus bolos verano 2026 con lugar y fecha' }],
}

let A = args
if (typeof A === "string") { try { A = JSON.parse(A) } catch { A = [] } }
A = Array.isArray(A) ? A : []

const SCHEMA = {
  type: "object", required: ["orquesta", "gigs"],
  properties: {
    orquesta: { type: "string" },
    fuente: { type: "string" },
    gigs: { type: "array", items: {
      type: "object", required: ["lugar", "fecha"],
      properties: {
        lugar: { type: "string" },        // pueblo/parroquia donde toca
        concello: { type: "string" },     // ayuntamiento si se sabe
        provincia: { type: "string" },    // A Coruña/Lugo/Ourense/Pontevedra
        fecha: { type: "string" },        // YYYY-MM-DD (vacío si no hay día exacto)
        nota: { type: "string" },         // nombre de la fiesta si aparece
      },
    }},
  },
}

const PROMPT = (orq) =>
  "## Gira 2026 de la orquesta gallega \"" + orq + "\"\n\n" +
  "Encuentra el calendario de actuaciones (gira / bolos / agenda / conciertos) de 2026 de la orquesta \"" + orq + "\" y extrae TODOS los bolos en GALICIA entre el 15 de junio y el 30 de septiembre de 2026.\n\n" +
  "## Fuentes (WebSearch)\n" +
  "- Web oficial de la orquesta (busca '" + orq + " gira 2026' / 'agenda' / 'bolos')\n" +
  "- orquestasdegalicia.es (ficha de la orquesta con su calendario)\n" +
  "- Facebook/Instagram oficial donde publican la gira\n" +
  "- galiciaenfestas, festas.gal\n\n" +
  "## Para cada actuación\n" +
  "- lugar: pueblo o parroquia donde toca (lo más fino posible)\n" +
  "- concello: ayuntamiento (si se deduce)\n" +
  "- provincia: A Coruña / Lugo / Ourense / Pontevedra\n" +
  "- fecha: YYYY-MM-DD. SOLO si la fuente da el día exacto 2026. Si solo hay mes o nada, deja '' (NO inventes el día).\n" +
  "- nota: nombre de la fiesta si aparece (ej. 'Festas do Carme')\n\n" +
  "La FECHA es crítica: no inventar. Mejor pocos bolos con fecha exacta que muchos inventados.\n" +
  "Devuelve 'orquesta' EXACTO: \"" + orq + "\". Solo salida estructurada."

phase("Giras")
const out = await parallel(A.map(orq => () =>
  agent(PROMPT(orq), { label: orq, phase: "Giras", schema: SCHEMA, agentType: "Explore" })
    .then(r => r ? { orquesta: orq, fuente: r.fuente || "", gigs: r.gigs || [] } : null)
))
const ok = out.filter(Boolean)
const totalG = ok.reduce((n, o) => n + (o.gigs?.length || 0), 0)
const conFecha = ok.reduce((n, o) => n + (o.gigs?.filter(g => /^\d{4}-\d{2}-\d{2}$/.test(g.fecha)).length || 0), 0)
log("Orquestas OK " + ok.length + "/" + A.length + " · bolos " + totalG + " (" + conFecha + " con fecha exacta)")
return { orquestas: ok, totalGigs: totalG, conFecha }
