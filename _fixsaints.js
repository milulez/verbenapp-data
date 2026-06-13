// Fija a 1 día las fiestas de santo fijo (salvo grandes multi-día). DRY-RUN; --apply.
// Regla: si NO es excepción → si el nombre casa un santo del mapa y la fecha está ±10d de su día → snap a ese día (1 día);
//        si no, colapsa el rango (fechaFin=fechaInicio). Excepciones mantienen su rango.
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts","fiestas.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>(/parroquia:|fechaInicio:/.test(o))&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1&&/fechaInicio:/.test(o);
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const getN=(o,k)=>{const m=o.match(new RegExp(k+':\\s*(-?\\d+)'));return m?+m[1]:null;};
const iso=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
const diff=(a,b)=>Math.abs((new Date(a)-new Date(b))/864e5);

// santo → MM-DD (día litúrgico fijo). Orden = prioridad (primero gana).
const SAINTS=[
 [/ap[oó]stolo?|santiago/i,"07-25"],[/carm(e|en)/i,"07-16"],[/san roque/i,"08-16"],
 [/san pedro|san pablo|san paulo/i,"06-29"],[/santa mari[ñn]a|santa marina/i,"07-18"],
 [/asunci[oó]n|nosa se[ñn]ora.*agosto/i,"08-15"],[/san lourenzo|san lorenzo/i,"08-10"],
 [/bartolom/i,"08-24"],[/san xo[aá]n|san juan/i,"06-23"],[/remedios/i,"09-08"],
 [/santa ana/i,"07-26"],[/san bieito|san benito/i,"07-11"],[/san anton(io|in)|santo ant[oó]n/i,"06-13"],
 [/san cristov|san crist[oó]b/i,"07-10"],[/san paio|san pelayo|pelaio/i,"06-26"],
 [/san mamede|san mam[eé]s/i,"08-07"],[/san ram[oó]n/i,"08-31"],[/santa marta/i,"07-29"],
 [/virxe das neves|virgen de las nieves|nosa se[ñn]ora das neves/i,"08-05"],
 [/divino salvador|san salvador|santo salvador/i,"08-06"],[/santa margarida|santa margarita/i,"07-20"],
 [/san pantale[oó]n/i,"07-27"],[/santa cristina/i,"07-24"],[/san miguel/i,"09-29"],
 [/dolores|d[oó]res/i,"09-15"],[/santa baia|santa eulalia/i,"08-15"],
];
function santoDate(n){for(const [re,md] of SAINTS){if(re.test(n))return md;}return null;}
// combinada = 2+ santos (no fijar a uno solo, solo colapsar rango)
const combinada=n=>/( e san| y san| e santa| y santa| e virxe| e nosa| e santo| e o |santísimo sacramento|e san| & )/i.test(n)||(n.match(/\bsan |\bsanta |\bvirxe |\bsanto /gi)||[]).length>=2;
// EXCEPCIONES: mantienen rango multi-día
const EXC=/ap[oó]stol|peregrina|festival|semana (cultural|grande)|mundo celta|arde lucus|rapa das besta|os caneiros|albari[ñn]o|san froil|romaría dos|interceltico|intercéltico|festas do (cristo|apostol)|maruxaina/i;

let snap=0,collapse=0,exc=0,sinSanto=0;const ej=[];
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=objs.length-1;k>=0;k--){const [a,b]=objs[k];let o=t.slice(a,b),no=o;
    const nombre=get(o,'nombre'),fi=get(o,'fechaInicio'),ff=get(o,'fechaFin'),tipo=get(o,'tipo'),cob=getN(o,'cobertura')||getN(o,'estrellas')||1;
    if(!iso(fi))continue;
    const multi=iso(ff)&&ff!==fi;
    // EXCEPCIÓN: grande / festival / gastro / concierto / cobertura alta → no tocar
    if(cob>=4||tipo==="gastronomica"||tipo==="concierto"||EXC.test(nombre)){if(multi)exc++;continue;}
    const estado=get(o,'estado');
    const md=combinada(nombre)?null:santoDate(nombre);
    if(md&&estado!=="confirmada"){ // confirmada = cartel manda, no se mueve el día
      const canon=`2026-${md}`;
      if(diff(canon,fi)<=4){ // mismo santo, fecha MUY cercana → snap a su día exacto, 1 día
        if(fi!==canon||ff!==canon){no=no.replace(/fechaInicio:\s*"[^"]*"/,`fechaInicio: "${canon}"`);if(/fechaFin:/.test(no))no=no.replace(/fechaFin:\s*"[^"]*"/,`fechaFin: "${canon}"`);snap++;if(ej.length<16)ej.push(`[SNAP] ${nombre.slice(0,32)} ${fi}${multi?"→"+ff:""} ⇒ ${canon}`);t=t.slice(0,a)+no+t.slice(b);}
        continue;
      }
    }
    // no santo claro o fecha lejos: si tiene rango, colapsar a 1 día (mantener inicio)
    if(multi){no=no.replace(/fechaFin:\s*"[^"]*"/,`fechaFin: "${fi}"`);collapse++;if(ej.length<16&&!md)sinSanto++;t=t.slice(0,a)+no+t.slice(b);}
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN (no escribe; quita comentario fs.writeFileSync) ===");
console.log("snap a día de santo (1 día):",snap);
console.log("rango colapsado a 1 día (sin santo claro):",collapse);
console.log("excepciones mantenidas multi-día:",exc);
console.log("\nEjemplos:");ej.forEach(x=>console.log("  ",x));
