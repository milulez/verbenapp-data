// Matchea bolos de orquestas (de _scrape-orquestas) contra fiestas existentes.
// Añade orquesta a bandas[], confirma/añade fecha. Acumula en /tmp/gigs.json entre lotes.
// Uso: node _merge-orquestas.js <taskid>           (acumula gigs + DRY-RUN match)
//      node _merge-orquestas.js <taskid> --apply    (escribe)
//      node _merge-orquestas.js --apply             (re-merge acumulado sin nuevo task)
const fs=require('fs');
const args=process.argv.slice(2);
const APPLY=args.includes('--apply');
const tid=args.find(a=>!a.startsWith('--'));
const DIR="/private/tmp/claude-501/-Users-milulez/8700d5a2-10e9-4330-98cf-9669bc1ae063/tasks/";
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const GIGS="/tmp/gigs.json";

// 1) acumular gigs nuevos
let gigs=fs.existsSync(GIGS)?JSON.parse(fs.readFileSync(GIGS,'utf8')):[];
if(tid){
  let o=JSON.parse(fs.readFileSync(DIR+tid+".output","utf8"));
  let r=o.result; if(typeof r==="string")r=JSON.parse(r);
  const orqs=r.orquestas||[];
  let added=0;
  for(const oq of orqs){for(const g of (oq.gigs||[])){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(g.fecha))continue;
    gigs.push({orquesta:oq.orquesta,lugar:g.lugar||"",concello:g.concello||"",provincia:g.provincia||"",fecha:g.fecha,nota:g.nota||""});
    added++;
  }}
  // dedup
  const seen=new Set(); gigs=gigs.filter(g=>{const k=g.orquesta+"|"+g.lugar+"|"+g.fecha;if(seen.has(k))return false;seen.add(k);return true;});
  fs.writeFileSync(GIGS,JSON.stringify(gigs));
  console.log("Gigs nuevos:",added,"· acumulados totales:",gigs.length);
}

// 2) cargar fiestas con contexto de concello
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
function objects(t){const arr=[],stack=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')stack.push(i);else if(c==='}'){const x=stack.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const provFile={"a coruna":"concellos-coruna.ts","coruna":"concellos-coruna.ts","lugo":"concellos-lugo.ts","ourense":"concellos-ourense.ts","pontevedra":"concellos-pontevedra.ts"};

const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
const docs={}; // file -> {text, leaves:[{a,b,concello,parroquia,nombre,fi,o}]}
for(const f of files){
  const t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).sort((x,y)=>x[0]-y[0]);
  const concelloRanges=objs.filter(([a,b])=>/fiestas:/.test(t.slice(a,b)));
  const leaves=[];
  for(const [a,b] of objs){const o=t.slice(a,b);if(!isLeaf(o))continue;
    // concello = bloque más pequeño que contiene este leaf
    let best=null;for(const [ca,cb] of concelloRanges){if(ca<=a&&cb>=b){if(!best||(cb-ca)<(best[1]-best[0]))best=[ca,cb];}}
    let concello="";if(best){const cm=t.slice(best[0],best[0]+200).match(/nombre:\s*"([^"]*)"/);concello=cm?cm[1]:"";}
    leaves.push({a,b,concello,parroquia:get(o,'parroquia'),nombre:get(o,'nombre'),fi:get(o,'fechaInicio'),estado:get(o,'estado'),o});
  }
  docs[f]={text:t,leaves};
}

// 3) matchear
const dDiff=(d1,d2)=>Math.abs((new Date(d1)-new Date(d2))/864e5);
let matched=0,setFecha=0,addBanda=0,confirmEstado=0,unmatched=[];
const sampleM=[],sampleU=[];

for(const g of gigs){
  const f=provFile[norm(g.provincia)];
  if(!f||!docs[f]){unmatched.push(g);continue;}
  const gc=norm(g.concello),gl=norm(g.lugar);
  let cands=docs[f].leaves.filter(L=>{
    const cc=norm(L.concello);
    return gc && (cc===gc||cc.includes(gc)||gc.includes(cc));
  });
  if(!cands.length){unmatched.push(g);if(sampleU.length<12)sampleU.push(`${g.orquesta} → ${g.lugar}/${g.concello} (${g.provincia}) ${g.fecha} [concello no encontrado]`);continue;}
  // score: ps=place (parroquia/lugar específico, NO nombre-de-concello), ds=date proximity
  const emptyDate=L=>!/^\d{4}-\d{2}-\d{2}$/.test(L.fi);
  const placeScore=L=>{const pl=norm(L.parroquia),nm=norm(L.nombre);
    if(!gl)return 0;
    if(gl.length>=4&&pl.length>=4&&(pl.includes(gl)||gl.includes(pl)))return 3;
    if(gl.length>=5&&nm.includes(gl))return 2;
    return 0;};
  const dateScore=L=>{if(emptyDate(L))return 0;const dd=dDiff(L.fi,g.fecha);return dd===0?3:dd<=3?2:0;};
  let best=null,bestS=-1,bestDs=-1;
  for(const L of cands){const ps=placeScore(L),ds=dateScore(L),tot=ps+ds;
    if(tot>bestS||(tot===bestS&&ds>bestDs)){bestS=tot;bestDs=ds;best=L;}
  }
  // aceptar SOLO si: ancla de fecha (±3) O (fecha vacía + parroquia específica)
  const accept = best && ( dateScore(best)>=2 || (emptyDate(best)&&placeScore(best)>=3) );
  if(!accept){unmatched.push(g);if(sampleU.length<12)sampleU.push(`${g.orquesta} → ${g.lugar}/${g.concello} ${g.fecha} [sin ancla fecha/parroquia, ${cands.length} cands]`);continue;}
  matched++;
  // aplicar a best.o
  let no=best.o, changed=false;
  // bandas: añadir orquesta si no está
  const bm=no.match(/bandas:\s*\[([^\]]*)\]/);
  const orqEsc=g.orquesta.replace(/"/g,'\\"');
  if(bm){const cur=bm[1];if(!cur.toLowerCase().includes(g.orquesta.toLowerCase())){const nb=cur.trim()?`bandas: [${cur.trim().replace(/,\s*$/,"")}, "${orqEsc}"]`:`bandas: ["${orqEsc}"]`;no=no.replace(/bandas:\s*\[[^\]]*\]/,nb);changed=true;addBanda++;}}
  // fecha: si vacía -> set; si presente y dentro de ±3 -> confirmar estado
  if(!/^\d{4}-\d{2}-\d{2}$/.test(best.fi)){
    if(no.match(/fechaInicio:\s*"[^"]*"/)) no=no.replace(/fechaInicio:\s*"[^"]*"/,`fechaInicio: "${g.fecha}"`);
    else no=no.replace(/nombre:\s*"([^"]*)"/,`nombre: "$1", fechaInicio: "${g.fecha}", fechaFin: "${g.fecha}"`);
    if(no.match(/fechaFin:\s*""/)) no=no.replace(/fechaFin:\s*""/,`fechaFin: "${g.fecha}"`);
    no=no.replace(/estado:\s*"[^"]*"/,'estado: "confirmada"');changed=true;setFecha++;
  } else {
    if(get(best.o,'estado')!=="confirmada"){no=no.replace(/estado:\s*"[^"]*"/,'estado: "confirmada"');changed=true;confirmEstado++;}
  }
  if(sampleM.length<12)sampleM.push(`${g.orquesta} → ${best.nombre.slice(0,28)} (${best.concello}) ${best.fi||g.fecha}`);
  if(changed){docs[f].text=docs[f].text.slice(0,best.a)+no+docs[f].text.slice(best.b);
    // recalcular offsets de leaves posteriores en el mismo doc
    const delta=no.length-(best.b-best.a);
    for(const L of docs[f].leaves){if(L.a>best.a){L.a+=delta;L.b+=delta;}}
    best.b+=delta; best.o=no; best.fi=get(no,'fechaInicio'); best.estado=get(no,'estado');
  }
}

if(APPLY){for(const f of files)fs.writeFileSync(HOME+f,docs[f].text);}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log(`Bolos: ${gigs.length} · matched: ${matched} · sin match: ${unmatched.length}`);
console.log(`  fechas confirmadas/añadidas: ${setFecha} · estados→confirmada: ${confirmEstado} · bandas añadidas: ${addBanda}`);
console.log("\nMatches (muestra):");sampleM.forEach(s=>console.log("  ✓ "+s));
console.log("\nSin match (muestra):");sampleU.forEach(s=>console.log("  ✗ "+s));
