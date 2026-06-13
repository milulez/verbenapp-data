// Mejora bandas[] (alta precisión: diccionario orquestas + patrón con stoplist) y añade verbena:boolean.
// Idempotente (verbena se recalcula; bandas solo AÑADE nombres nuevos). DRY-RUN por defecto; --apply.
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const curBandas=o=>{const m=o.match(/bandas:\s*\[([^\]]*)\]/);return m&&m[1].trim()?m[1].split(",").map(s=>s.trim().replace(/^"|"$/g,"")):[];};

const VERBENA=/orquesta|orquestra|charanga|verbena|disco m[oó]vil|\bdj\b|m[uú]sica en (vivo|directo)|actuaci[oó]n(es)? musical|conjunto musical|grupo musical|baile|foliada|ses[ió]on vermú/i;

const DICT=["Panorama","París de Noia","Paris de Noia","Olympus","Orquesta Marbella","Marbella","América de Vigo","La Fórmula","Combo Dominicano","Cinema","Capitol","Compostela","Saudade","Finisterre","Cíclope","New York","Miramar","Los Players","Gran Parada","Los Satélites","Trébol","Assia","Kubo","Costa Dorada","Tokio","Venecia","Ámbar","Galia","Solara","Maquinaria","Crystal","Acordes","Metrópolis","Magma","Origen","Atlanta","Millenium","La Ocaband","Ocaband","Charleston","Alkar","Eureka","Tania Veiras","Nueva Estrella","Furia Joven","Acirema","Stereo","Tic-Tac","Europa","París de Noia","Fórmula Abierta","Diamante","París","Brasil","Algarabía","La Banda de Ayer","Show Ría de Vigo","Marabilla","Disco Móvil Chocolate","Ti Tan","Yenco","Velvet","Claxxon"];
const dictRe=new RegExp("\\b("+DICT.map(d=>d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")+")\\b","g");

const STOP=new Set(["agosto","julio","junio","septiembre","setembro","xullo","xuño","mayo","octubre","celebración","celebracion","celebraciones","última","ultima","últimas","matices","fiestas","festas","fiesta","festa","barrio","local","locales","tradicional","popular","infantil","verbena","verbenas","noche","tarde","mañana","domingo","sábado","sabado","viernes","vermú","vermut","gaita","gaitas","música","musica","misa","procesión","procesion","actuación","actuacion","actuaciones","grupo","banda","disco","móvil","movil","dj","sesión","sesion","y","de","la","el","los","las","con","por"]);

function names(txt){const out=new Set();
  // diccionario (alta precisión)
  let d;while((d=dictRe.exec(txt))!==null)out.add(d[1]);
  // patrón keyword+nombre, cortado en puntuación, con stoplist
  let m;const KW=/(?:orquestas?|orquestra|charangas?|disco m[oó]vil|tr[ií]o|dj|verbena con|conjunto)\s+([A-ZÁÉÍÓÚÑ][^,.;:\n"]{2,40})/g;
  while((m=KW.exec(txt))!==null){
    let n=m[1].trim().replace(/\s+(y|e)\s.*$/,"").replace(/[.,;:)(]+$/,"").trim();
    const first=n.split(/\s+/)[0].toLowerCase();
    if(STOP.has(first))continue;
    if(STOP.has(n.toLowerCase()))continue;
    if(n.length<3||n.length>34)continue;
    // rechazar fechas/santos colados: dígito, nombre de mes, día semana, "fin de semana"
    if(/\d/.test(n))continue;
    if(/\b(enero|febrero|marzo|abril|mayo|maio|junio|xuño|julio|xullo|agosto|septiembre|setembro|octubre|outubro|noviembre|decembro|diciembre|fin de semana|domingo|s[áa]bado|venres|viernes|v[ií]spera|asunci[oó]n|san |santa |santo |virxe|virgen)\b/i.test(n))continue;
    out.add(n);
  }
  return [...out];
}

let conV=0,addNames=0,fiestasNuevas=0;const ej=[];let total=0;
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=objs.length-1;k>=0;k--){const [a,b]=objs[k];let o=t.slice(a,b),no=o,ch=false;total++;
    const txt=get(o,'nota')+" "+get(o,'regla');
    // verbena boolean
    const v=VERBENA.test(txt);if(v)conV++;
    if(/verbena:\s*(true|false)/.test(no))no=no.replace(/verbena:\s*(true|false)/,`verbena: ${v}`);
    else no=no.replace(/\s*,?\s*\}$/,"")+`, verbena: ${v} }`;
    ch=true;
    // bandas: añadir nombres nuevos
    const cur=curBandas(o);const found=names(txt).filter(n=>!cur.some(c=>c.toLowerCase()===n.toLowerCase()));
    if(found.length){const all=[...cur,...found];const arrStr="["+all.map(n=>`"${n.replace(/"/g,"")}"`).join(", ")+"]";no=no.replace(/bandas:\s*\[[^\]]*\]/,`bandas: ${arrStr}`);addNames+=found.length;if(cur.length===0)fiestasNuevas++;if(ej.length<14)ej.push(get(o,'nombre').slice(0,26)+" → "+JSON.stringify(found));}
    if(APPLY)t=t.slice(0,a)+no+t.slice(b);
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log("Total:",total,"· con verbena:true:",conV,`(${Math.round(conV/total*100)}%)`);
console.log("nombres de banda nuevos:",addNames,"· fiestas que pasan de 0→tiene banda:",fiestasNuevas);
console.log("\nEjemplos nombres recuperados:");ej.forEach(x=>console.log("  ",x));
