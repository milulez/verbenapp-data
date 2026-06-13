// Fix: San Xoán de junio → 23 jun 1 día. Rangos rotos (>10d) → 1 día. DRY-RUN; --apply.
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts","fiestas.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>(/parroquia:|fechaInicio:/.test(o))&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1&&/fechaInicio:/.test(o);
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const iso=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const span=(a,b)=>iso(a)&&iso(b)?Math.round((new Date(b)-new Date(a))/864e5):null;
// San Xoán "puro" (no combinado con otro santo)
const esSanXoanPuro=n=>/san xo[aá]n|san juan/i.test(n) && !/san pedro|san anton|santisimo|sant[ií]simo|sacramento|carm[ee]n|carme|santa |san roque|san lourenzo|san lorenzo|e san |y san /i.test(n);

let sx=0,cap=0;const ej=[];
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=objs.length-1;k>=0;k--){const [a,b]=objs[k];let o=t.slice(a,b),no=o,hit=null;
    const nombre=get(o,'nombre'),fi=get(o,'fechaInicio'),ff=get(o,'fechaFin');
    if(!iso(fi))continue;
    // A) San Xoán puro en JUNIO -> 23 jun 1 día
    if(esSanXoanPuro(nombre)&&fi.slice(5,7)==="06"){
      if(fi!=="2026-06-23"||ff!=="2026-06-23"){
        no=no.replace(/fechaInicio:\s*"[^"]*"/,'fechaInicio: "2026-06-23"');
        if(/fechaFin:/.test(no))no=no.replace(/fechaFin:\s*"[^"]*"/,'fechaFin: "2026-06-23"');
        hit="SX";sx++;
      }
    } else {
      // B) rango roto >10 días -> 1 día
      const s=span(fi,ff);
      if(s!=null&&s>10){no=no.replace(/fechaFin:\s*"[^"]*"/,`fechaFin: "${fi}"`);hit="CAP";cap++;}
    }
    if(hit){if(ej.length<14)ej.push(`[${hit}] ${nombre.slice(0,34)} ${fi}${ff&&ff!==fi?"→"+ff:""} ⇒ ${hit==="SX"?"23 jun":fi}`);if(APPLY)t=t.slice(0,a)+no+t.slice(b);}
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log("San Xoán → 23 jun 1 día:",sx,"· rangos rotos capados a 1 día:",cap);
console.log("\nEjemplos:");ej.forEach(x=>console.log("  ",x));
