// Limpieza fechas capa parroquial — VerbenApp. Solo días, sin horas. No colapsa homónimas.
// Reglas: A) normalizar DD-MM-YYYY→ISO; B) "2026-07-" incompleta→blanco;
//         C) fuera de ventana (mes no jun-sep)→estado:"fuera"; D) desconocida+santo→mapear.
// Uso: node _clean.js          (DRY-RUN, no escribe)
//      node _clean.js --apply  (escribe ficheros)
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];

// santo canónico -> MM-DD (de /tmp/resolve.js, ampliado)
const S=[
 [/carm(e|en)/i,'07-16'],[/san roque/i,'08-16'],[/san pedro|san pablo/i,'06-29'],
 [/santiago|ap[oó]stol/i,'07-25'],[/santa mari[ñn]a|santa marina/i,'07-18'],
 [/bartolom/i,'08-24'],[/divino salvador|san salvador|santo salvador/i,'08-06'],
 [/asunci[oó]n|nosa se[ñn]ora.*agosto|virxe.*neves|virgen.*nieves/i,'08-05'],[/lourenzo|lorenzo/i,'08-10'],
 [/san xo[aá]n|san juan/i,'06-24'],[/margarida|margarita/i,'07-20'],[/pantale[oó]n/i,'07-27'],
 [/bieito|benito/i,'07-11'],[/dos anxos|de los [aá]ngeles/i,'08-02'],[/san paio|pelayo/i,'06-26'],
 [/mamede|mam[eé]s/i,'08-07'],[/san ram[oó]n/i,'08-31'],[/santa ana/i,'07-26'],
 [/remedios/i,'09-08'],[/santa cristina/i,'07-24'],[/san mart[ií]/i,'07-11'],
 [/santa baia|santa eulalia/i,'08-15'],[/dolores|dores/i,'09-15'],[/san lois|san luis/i,'08-25'],
];
const M={enero:'01',xaneiro:'01',febrero:'02',febreiro:'02',marzo:'03',abril:'04',mayo:'05',maio:'05',junio:'06',xuño:'06',xuño:'06',julio:'07',xullo:'07',agosto:'08',septiembre:'09',setembro:'09',septembro:'09',octubre:'10',outubro:'10',noviembre:'11',decembro:'12',diciembre:'12'};
const HEDGE=/variable|aprox|~|mediados|comezos|comienzos|principios|finais|finales|probable|desconocid|no especificada|por confirmar/i;
const inWin=mm=>mm>='06'&&mm<='09';

// extraer valor de campo "x: \"...\"" o x: null/false dentro de un bloque de objeto
const getStr=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:null;};

// resolver desconocida -> {date,est} | null
function resolveSanto(nombre,regla){
  const txt=(nombre+' '+regla).toLowerCase();
  // fecha explícita "DD de MES"
  let m=regla.match(/(\d{1,2})\s*(?:de\s*)?(xaneiro|enero|febrero|febreiro|marzo|abril|mayo|maio|junio|xuño|xuño|julio|xullo|agosto|septiembre|setembro|septembro|octubre|outubro)/i);
  if(m){const mm=M[m[2].toLowerCase()];const dd=String(m[1]).padStart(2,'0');return {date:`2026-${mm}-${dd}`,mm,est:HEDGE.test(regla)?'recurrente':'fija'};}
  for(const [re,md] of S){ if(re.test(txt)){ return {date:`2026-${md}`,mm:md.slice(0,2),est:HEDGE.test(regla)?'recurrente':'fija'}; } }
  return null;
}

// parser de objetos {..} string-aware — captura TODOS los objetos (cualquier profundidad) vía pila
function objects(t){
  const arr=[]; const stack=[]; let inStr=false,strCh="",prev="";
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(inStr){if(ch===strCh&&prev!=="\\")inStr=false;prev=ch;continue;}
    if(ch==='"'||ch==="'"||ch==="`"){inStr=true;strCh=ch;prev=ch;continue;}
    if(ch==='{'){stack.push(i);}
    else if(ch==='}'){const s=stack.pop();if(s!==undefined)arr.push([s,i+1]);}
    prev=ch;
  }
  return arr;
}
// objeto hoja = no contiene "{" anidado (no es bloque concello)
const isLeafFiesta=o=>/nombre:/.test(o) && !/fiestas:/.test(o) && !/concello:/.test(o) && (o.match(/{/g)||[]).length===1;

const stats={normDate:0,blanked:0,fuera:0,resolved:0,resolvedFuera:0,stillDesc:0,total:0,skipNoDate:0};
const samples={normDate:[],blanked:[],fuera:[],resolved:[]};

for(const f of files){
  let t=fs.readFileSync(f,"utf8");
  const objs=objects(t);
  // procesar de atrás a adelante para no desplazar índices
  for(let k=objs.length-1;k>=0;k--){
    const [a,b]=objs[k];
    let o=t.slice(a,b);
    if(!isLeafFiesta(o)) continue; // solo objetos fiesta hoja
    if(!/fechaInicio:|estado:/.test(o)) continue;
    stats.total++;
    let fi=getStr(o,'fechaInicio'); // puede ser null si no existe la clave
    let ff=getStr(o,'fechaFin');
    let est=getStr(o,'estado');
    const nombre=getStr(o,'nombre')||'';
    const regla=getStr(o,'regla')||'';
    let no=o, changed=false;

    // --- A) normalizar DD-MM-YYYY -> YYYY-MM-DD ---
    const flip=s=>{const m=s&&s.match(/^(\d{2})-(\d{2})-(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:s;};
    if(fi&&/^\d{2}-\d{2}-\d{4}$/.test(fi)){const nf=flip(fi);no=no.replace(`fechaInicio: "${fi}"`,`fechaInicio: "${nf}"`);fi=nf;changed=true;stats.normDate++;if(samples.normDate.length<8)samples.normDate.push(`${nombre.slice(0,30)}: ${nf}`);}
    if(ff&&/^\d{2}-\d{2}-\d{4}$/.test(ff)){const nf=flip(ff);no=no.replace(`fechaFin: "${ff}"`,`fechaFin: "${nf}"`);ff=nf;changed=true;}

    // --- B) fecha incompleta "2026-07-" -> recuperar día por santo, si no blanquear ---
    const incomplete=s=>s&&/^\d{4}-\d{2}-?$/.test(s);
    if(incomplete(fi)){
      const r=resolveSanto(nombre,regla);
      if(r&&inWin(r.mm)&&r.date.slice(0,7)===fi.slice(0,7)){ // mismo mes -> recuperar día
        no=no.replace(`fechaInicio: "${fi}"`,`fechaInicio: "${r.date}"`);fi=r.date;changed=true;stats.recovered=(stats.recovered||0)+1;
      }else{
        no=no.replace(`fechaInicio: "${fi}"`,`fechaInicio: ""`);changed=true;stats.blanked++;if(samples.blanked.length<8)samples.blanked.push(`${nombre.slice(0,30)}: era ${fi}`);fi="";
      }
    }
    if(incomplete(ff)){no=no.replace(`fechaFin: "${ff}"`,`fechaFin: ""`);changed=true;ff="";}

    // --- D) desconocida + resolver santo (antes de marcar fuera) ---
    if(est==="desconocida"){
      const r=resolveSanto(nombre,regla);
      if(r){
        if(inWin(r.mm)){
          // añadir/!setear fechaInicio y cambiar estado
          if(fi===null){ // no existe clave fechaInicio -> insertar tras nombre
            no=no.replace(/estado:\s*"desconocida"/,`fechaInicio: "${r.date}", estado: "${r.est}"`);
          }else{
            no=no.replace(`fechaInicio: "${fi}"`,`fechaInicio: "${r.date}"`).replace(/estado:\s*"desconocida"/,`estado: "${r.est}"`);
          }
          fi=r.date;est=r.est;changed=true;stats.resolved++;if(samples.resolved.length<8)samples.resolved.push(`${nombre.slice(0,30)} -> ${r.date}`);
        }else{
          no=no.replace(/estado:\s*"desconocida"/,`estado: "fuera"`);est="fuera";changed=true;stats.resolvedFuera++;
        }
      }else{stats.stillDesc++;}
    }

    // --- C) fuera de ventana por fecha (mes no jun-sep) ---
    if(fi&&/^\d{4}-\d{2}-\d{2}$/.test(fi)){
      const mm=fi.slice(5,7);
      if(!inWin(mm)&&est!=="fuera"){
        if(est) no=no.replace(new RegExp(`estado:\\s*"${est}"`),`estado: "fuera"`);
        changed=true;stats.fuera++;if(samples.fuera.length<8)samples.fuera.push(`${nombre.slice(0,30)}: ${fi}`);
      }
    } else if(fi===null||fi===""){stats.skipNoDate++;}

    if(changed){ t=t.slice(0,a)+no+t.slice(b); }
  }
  if(APPLY){fs.writeFileSync(f,t);}
}

console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN (sin escribir) ===");
console.log(JSON.stringify(stats,null,2));
console.log("\nMuestras normDate:",samples.normDate);
console.log("Muestras blanked:",samples.blanked);
console.log("Muestras fuera:",samples.fuera);
console.log("Muestras resolved desconocida:",samples.resolved);
