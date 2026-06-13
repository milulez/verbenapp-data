// Añade lat/lng a cada fiesta = coords de su concello (de /tmp/concello_coords.json).
// precisionGeo: "concello" (todas ahora). Uso: node _addcoords.js [--apply]
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const coords=JSON.parse(fs.readFileSync("/tmp/concello_coords.json","utf8"));
const all=JSON.parse(fs.readFileSync(HOME+"_state/all_concellos.json","utf8"));
// mapa concelloName(normalizado) -> {lat,lng} (con provincia para desambiguar homónimos)
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const byName={};
for(const c of all){const k=c.provincia+"|"+c.concello;if(coords[k])byName[norm(c.concello)]=coords[k];}

function objects(t){const arr=[],stack=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')stack.push(i);else if(c==='}'){const x=stack.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;

const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
let added=0,noCoord=0,total=0,already=0;const missing=new Set();
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).sort((a,b)=>a[0]-b[0]);
  const concelloRanges=objs.filter(([a,b])=>/fiestas:/.test(t.slice(a,b)));
  // procesar leaves de atrás a adelante
  const leaves=objs.filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=leaves.length-1;k>=0;k--){
    const [a,b]=leaves[k];let o=t.slice(a,b);total++;
    if(/\blat:/.test(o)){already++;continue;}
    // concello contenedor
    let best=null;for(const [ca,cb] of concelloRanges){if(ca<=a&&cb>=b){if(!best||(cb-ca)<(best[1]-best[0]))best=[ca,cb];}}
    let cn="";if(best){const cm=t.slice(best[0],best[0]+200).match(/nombre:\s*"([^"]*)"/);cn=cm?cm[1]:"";}
    const co=byName[norm(cn)];
    if(!co){noCoord++;missing.add(cn);continue;}
    const no=o.replace(/\s*,?\s*\}$/,"")+`, lat: ${co.lat}, lng: ${co.lng}, precisionGeo: "concello" }`;
    if(APPLY)t=t.slice(0,a)+no+t.slice(b);
    added++;
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log(`Fiestas: ${total} · coords añadidas: ${added} · ya tenían: ${already} · sin coord concello: ${noCoord}`);
if(missing.size)console.log("Concellos sin coord:",[...missing]);
