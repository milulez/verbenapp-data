// Añade id (slug único) + busqueda (texto normalizado) a cada fiesta parroquial. Idempotente. DRY-RUN; --apply.
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const arr=(o,k)=>{const m=o.match(new RegExp(k+':\\s*\\[([^\\]]*)\\]'));return m&&m[1].trim()?m[1].split(",").map(s=>s.trim().replace(/^"|"$/g,"")):[];};
const slugify=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ñ/g,"n").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60).replace(/-+$/,"");
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();

const seen=new Set();
let added=0,total=0;const ej=[];
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const all=objects(t).sort((a,b)=>a[0]-b[0]);
  const crs=all.filter(([a,b])=>/fiestas:/.test(t.slice(a,b)));
  const leaves=all.filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=leaves.length-1;k>=0;k--){const [a,b]=leaves[k];let o=t.slice(a,b);total++;
    if(/\bid:/.test(o))continue;
    // concello+comarca contenedor
    let best=null;for(const [ca,cb] of crs){if(ca<=a&&cb>=b){if(!best||(cb-ca)<(best[1]-best[0]))best=[ca,cb]}}
    let cn="",co="";if(best){const head=t.slice(best[0],best[0]+260);cn=(head.match(/nombre:\s*"([^"]*)"/)||[])[1]||"";co=(head.match(/comarca:\s*"([^"]*)"/)||[])[1]||"";}
    const nombre=get(o,'nombre'),parr=get(o,'parroquia');
    // slug = nombre + lugar
    let base=slugify(nombre+"-"+(parr||cn));if(!base)base="festa";
    let id=base,n=2;while(seen.has(id)){id=base+"-"+n;n++;}seen.add(id);
    // busqueda
    const busca=norm([nombre,parr,cn,co,get(o,'tipo'),...arr(o,'comida'),...arr(o,'bandas')].join(" "));
    // insertar id al principio + busqueda al final
    let no=o.replace(/^\{\s*/,`{ id: "${id}", `);
    no=no.replace(/\s*,?\s*\}$/,"")+`, busqueda: "${busca.replace(/"/g,'')}" }`;
    if(APPLY)t=t.slice(0,a)+no+t.slice(b);
    added++;if(ej.length<8)ej.push(`${id}`);
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log("Total leaves:",total,"· ids añadidos:",added,"· ids únicos:",seen.size);
console.log("\nEjemplos de slug:");ej.forEach(x=>console.log("  ",x));
