// Mergea resultados de _resolve-desconocidas. Solo actualiza fiestas que SIGUEN desconocida,
// match por nombre+parroquia exacto, con fecha válida en ventana jun-sep. Acumula /tmp/desc_resolved.json.
// Uso: node _merge-desconocidas.js <taskid> [--apply]  |  node _merge-desconocidas.js --apply
const fs=require('fs');
const args=process.argv.slice(2);
const APPLY=args.includes('--apply');
const tid=args.find(a=>!a.startsWith('--'));
const DIR="/private/tmp/claude-501/-Users-milulez/8700d5a2-10e9-4330-98cf-9669bc1ae063/tasks/";
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const ACC="/tmp/desc_resolved.json";

let acc=fs.existsSync(ACC)?JSON.parse(fs.readFileSync(ACC,'utf8')):[];
if(tid){
  let o=JSON.parse(fs.readFileSync(DIR+tid+".output","utf8"));let r=o.result;if(typeof r==="string")r=JSON.parse(r);
  for(const b of (r.buckets||[]))for(const x of (b.resolved||[]))acc.push(x);
  const seen=new Set();acc=acc.filter(x=>{const k=(x.nombre||"")+"|"+(x.parroquia||"")+"|"+(x.fecha||"");if(seen.has(k))return false;seen.add(k);return true;});
  fs.writeFileSync(ACC,JSON.stringify(acc));
  console.log("Resueltas acumuladas:",acc.length);
}

const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
const inWin=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d.slice(5,7)>="06"&&d.slice(5,7)<="09";
// index de candidatos con fecha válida
const cands=acc.filter(x=>inWin(x.fecha));
const byKey={};for(const x of cands){const k=norm(x.nombre)+"|"+norm(x.parroquia);byKey[k]=x;}

function objects(t){const arr=[],stack=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')stack.push(i);else if(c==='}'){const x=stack.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
let applied=0,noMatch=0;const used=new Set();const sample=[];
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");const O=objects(t).sort((a,b)=>a[0]-b[0]).filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=O.length-1;k>=0;k--){const [a,b]=O[k];let o=t.slice(a,b);
    if(get(o,'estado')!=="desconocida")continue;
    const key=norm(get(o,'nombre'))+"|"+norm(get(o,'parroquia'));
    const m=byKey[key];if(!m||used.has(key))continue;
    used.add(key);
    const ff=inWin(m.fechaFin)?m.fechaFin:m.fecha;
    const est=["confirmada","fija","recurrente"].includes(m.estado)?m.estado:"confirmada";
    let no=o.replace(/fechaInicio:\s*"[^"]*"/,`fechaInicio: "${m.fecha}"`).replace(/fechaFin:\s*"[^"]*"/,`fechaFin: "${ff}"`).replace(/estado:\s*"desconocida"/,`estado: "${est}"`);
    if(!/fechaInicio:/.test(o))no=no.replace(/nombre:\s*"([^"]*)"/,`nombre: "$1", fechaInicio: "${m.fecha}", fechaFin: "${ff}"`);
    if(sample.length<12)sample.push(`${get(o,'nombre').slice(0,30)} → ${m.fecha} (${est})`);
    if(APPLY)t=t.slice(0,a)+no+t.slice(b);applied++;
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log(`Candidatos con fecha válida: ${cands.length} · aplicados (match exacto desconocida): ${applied}`);
sample.forEach(s=>console.log("  ✓ "+s));
