// QA sobre-granularidad/duplicados. ANALIZA por defecto; --apply ejecuta.
// Categorías: A=núcleo de otra parroquia (regla "Parte de"); B=sin info/no-evento; C=dup exacto en mismo concello;
//             D=fuera de ventana por regla (santo invierno); KEEP=real sin fecha (se queda "por confirmar").
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");

const PARTE=/parte de |núcleo de |nucleo de |pertenece a |sumergid|desaparecid|administrativamente/i;
const NOINFO=/sin informaci|no encontrada|sin datos|sin fecha precisa|sin confirmaci[oó]n|no confirmad|sin detalles|no publicada|sin información fiable|no localiz|sin fecha confirmada|sin fecha 2026/i;
const OUTSAINT=/(30 de noviembre|30 noviembre|san andr[eé]s.*noviembre|26 de diciembre|santo estevo.*diciembre|santo estevo.*26|noviembre.*fuera|fuera del per[ií]odo|fuera del rango|fuera de verano|octubre.*fuera|enero|febrero|santo: 17 enero|11 de noviembre)/i;
const GENERIC=/^(festas?|fiestas?) (de |do |da |del |dos )/i;

const cats={A:[],B:[],D:[],dup:[],keep:0,total:0,dated:0};
const perFile={};
for(const f of files){
  const t=fs.readFileSync(HOME+f,"utf8");
  const O=objects(t).sort((a,b)=>a[0]-b[0]);
  const crs=O.filter(([a,b])=>/fiestas:/.test(t.slice(a,b)));
  const leaves=O.filter(([a,b])=>isLeaf(t.slice(a,b)));
  // concello de cada leaf
  const info=leaves.map(([a,b])=>{const o=t.slice(a,b);let best=null;for(const [ca,cb] of crs){if(ca<=a&&cb>=b){if(!best||(cb-ca)<(best[1]-best[0]))best=[ca,cb]}}let cn="";if(best){const cm=t.slice(best[0],best[0]+200).match(/nombre:\s*"([^"]*)"/);cn=cm?cm[1]:""}return{a,b,o,concello:cn,nombre:get(o,'nombre'),parroquia:get(o,'parroquia'),estado:get(o,'estado'),regla:get(o,'regla')};});
  perFile[f]={t,info};
  // dup exacto: mismo concello + mismo nombre normalizado (o mismo parroquia+nombre)
  const seen={};
  for(const x of info){const k=norm(x.concello)+"|"+norm(x.nombre);if(seen[k])cats.dup.push({f,...x,dupOf:seen[k]});else seen[k]=x.nombre;}
  for(const x of info){cats.total++;
    if(/^\d{4}-\d{2}-\d{2}$/.test(get(x.o,'fechaInicio'))){cats.dated++;continue;}
    if(x.estado!=="desconocida")continue;
    if(PARTE.test(x.regla)){cats.A.push({f,...x});continue;}
    if(OUTSAINT.test(x.regla)){cats.D.push({f,...x});continue;}
    // B = ruido puro: el nombre es LITERALMENTE "Fiestas de <parroquia>" (sin santo ni tema propio)
    // o "Festa da Xuventude/Mocidade" genérica. NO toca eventos con nombre propio (Festa do Polo, da Sardinha…).
    const stripped = norm(x.nombre).replace(/^(fiestas?|festas?)(de|do|da)/,"");
    const esLugarPelado = stripped===norm(x.parroquia) || (GENERIC.test(x.nombre) && stripped.length<=norm(x.parroquia).length+2 && norm(x.parroquia).includes(stripped));
    const xuvGenerica = /^festas? da (xuventude|mocidade)$/i.test(x.nombre.trim());
    if(esLugarPelado||xuvGenerica){cats.B.push({f,...x});continue;}
    cats.keep++;  // nombre propio o santo → se queda "por confirmar"
  }
}
console.log("TOTAL fiestas:",cats.total,"· con fecha:",cats.dated);
console.log("\n--- CATEGORÍAS DE RUIDO (desconocida) ---");
console.log("A) núcleo de otra parroquia / no-evento real:",cats.A.length);
console.log("B) sin info / nombre genérico sin contexto:",cats.B.length);
console.log("D) fuera de ventana por santo invierno:",cats.D.length);
console.log("dup) duplicado exacto en mismo concello:",cats.dup.length);
console.log("KEEP) real sin fecha (se queda 'por confirmar'):",cats.keep);
console.log("\nMuestras A:");cats.A.slice(0,8).forEach(x=>console.log("  ",x.concello+" / "+x.nombre+" — "+x.regla.slice(0,45)));
console.log("Muestras B:");cats.B.slice(0,8).forEach(x=>console.log("  ",x.concello+" / "+x.nombre+" — "+x.regla.slice(0,45)));
console.log("Muestras dup:");cats.dup.slice(0,8).forEach(x=>console.log("  ",x.concello+" / "+x.nombre+" (dup de: "+x.dupOf+")"));

if(APPLY){
  // eliminar A + B + dup; D -> marcar estado:"fuera"
  let removed=0,marked=0;
  for(const f of files){
    let t=perFile[f].t;
    const toRemove=[...cats.A,...cats.B,...cats.dup].filter(x=>x.f===f);
    const toMark=cats.D.filter(x=>x.f===f);
    // marcar D primero (no cambia offsets mucho, pero hagámoslo por rango desc)
    const ops=[...toRemove.map(x=>({...x,op:"rm"})),...toMark.map(x=>({...x,op:"mark"}))].sort((a,b)=>b.a-a.a);
    for(const x of ops){
      if(x.op==="rm"){
        // engullir coma y espacios alrededor
        let s=x.a,e=x.b;while(e<t.length&&/[\s,]/.test(t[e])&&t[e]!=="\n")e++; // coma trailing
        // quitar también salto de línea + indent previo
        let s2=s;while(s2>0&&/[ \t]/.test(t[s2-1]))s2--;if(t[s2-1]==="\n")s2--;
        t=t.slice(0,s2)+t.slice(e);removed++;
      }else{
        const no=x.o.replace(/estado:\s*"desconocida"/,'estado: "fuera"');t=t.slice(0,x.a)+no+t.slice(x.b);marked++;
      }
    }
    fs.writeFileSync(HOME+f,t);
  }
  console.log(`\n=== APLICADO === eliminadas: ${removed} · marcadas fuera: ${marked}`);
}
