// Validación integridad de fechas. REPORTA (no toca). Chequea ordinal+día semana, santo fijo,
// rango invertido, fuera de ventana sin marcar, confirmada/fija sin fecha.
const fs=require('fs');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};

const WD={domingo:0,luns:1,lunes:1,martes:2,mercores:3,miercoles:3,"miércoles":3,xoves:4,jueves:4,venres:5,viernes:5,sabado:6,"sábado":6};
const ORD={primer:1,primeir:1,"1º":1,segundo:2,segund:2,"2º":2,tercer:3,terceir:3,"3º":3,cuarto:4,cuart:4,"4º":4};
const MON={xaneiro:1,enero:1,febrero:2,febreiro:2,marzo:3,abril:4,mayo:5,maio:5,junio:6,xuño:6,julio:7,xullo:7,agosto:8,septiembre:9,setembro:9,octubre:10,outubro:10,noviembre:11,decembro:12,diciembre:12};
// santos fijos MM-DD
const SAINT=[[/carm(e|en)/i,"07-16"],[/san roque/i,"08-16"],[/san pedro/i,"06-29"],[/santiago|ap[oó]stol/i,"07-25"],[/santa mari[ñn]a/i,"07-18"],[/asunci[oó]n|nosa se[ñn]ora.*agosto/i,"08-15"],[/lourenzo|lorenzo/i,"08-10"],[/bartolom/i,"08-24"],[/san xo[aá]n|san juan/i,"06-24"],[/remedios/i,"09-08"],[/santa ana/i,"07-26"],[/san bieito|san benito/i,"07-11"],[/san lois|san luis/i,"08-25"],[/neves|nieves/i,"08-05"]];
const dow=iso=>new Date(iso+"T12:00:00").getDay();
function nthWeekday(year,month,wd,n){ // n>=1; devuelve YYYY-MM-DD del n-ésimo weekday wd del mes
  let count=0;for(let d=1;d<=31;d++){const dt=new Date(Date.UTC(year,month-1,d));if(dt.getUTCMonth()!==month-1)break;if(dt.getUTCDay()===wd){count++;if(count===n)return `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}}return null;}
function lastWeekday(year,month,wd){let res=null;for(let d=1;d<=31;d++){const dt=new Date(Date.UTC(year,month-1,d));if(dt.getUTCMonth()!==month-1)break;if(dt.getUTCDay()===wd)res=`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}return res;}
const diffDays=(a,b)=>Math.abs((new Date(a)-new Date(b))/864e5);

const R={wdMismatch:[],saintFar:[],inverted:[],outUnmarked:[],noDate:[],ok:0,total:0};
for(const f of files){
  const t=fs.readFileSync(HOME+f,"utf8");
  for(const [a,b] of objects(t)){const o=t.slice(a,b);if(!isLeaf(o))continue;R.total++;
    const fi=get(o,'fechaInicio'),ff=get(o,'fechaFin'),est=get(o,'estado'),regla=get(o,'regla').toLowerCase(),nombre=get(o,'nombre');
    const tag=`[${f.slice(10,13)}] ${nombre.slice(0,34)}`;
    // sin fecha pero confirmada/fija
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fi)){ if(est==="confirmada"||est==="fija")R.noDate.push(`${tag} (${est}, fecha vacía)`); continue; }
    // rango invertido
    if(/^\d{4}-\d{2}-\d{2}$/.test(ff)&&ff<fi)R.inverted.push(`${tag} ${fi}→${ff}`);
    // fuera de ventana sin marcar
    const mo=fi.slice(5,7); if((mo<"06"||mo>"09")&&est!=="fuera")R.outUnmarked.push(`${tag} ${fi}`);
    // ordinal + día de semana + mes
    let mt=regla.match(/(primer|primeir|segundo|segund|tercer|terceir|cuarto|cuart|[uú]ltim|pen[uú]ltim)\w*\s+(domingo|luns|lunes|martes|m[ée]rcores|mi[ée]rcoles|xoves|jueves|venres|viernes|s[áa]bado)\s+de\s+(\w+)/);
    if(mt){const wd=WD[mt[2].replace(/[́̀]/g,"")]??WD[mt[2]];const mon=MON[mt[3]];
      if(wd!=null&&mon){let expected;if(/[uú]ltim/.test(mt[1]))expected=lastWeekday(2026,mon,wd);else{const n=ORD[mt[1]]||ORD[mt[1].slice(0,6)]||1;expected=nthWeekday(2026,mon,wd,n);}
        if(expected&&expected!==fi&&diffDays(expected,fi)>0)R.wdMismatch.push(`${tag} · regla:"${mt[0]}" · es ${fi}(${["dom","lun","mar","mié","jue","vie","sáb"][dow(fi)]}) · esperado ${expected}`);
        else if(expected)R.ok++;
      }
    }
    // santo fijo: si nombre/regla cita santo y estado fija, fecha debe estar cerca
    if(est==="fija"){for(const [re,md] of SAINT){if(re.test(nombre)||re.test(regla)){const sd=`2026-${md}`;if(diffDays(sd,fi)>9){R.saintFar.push(`${tag} · santo~${md} · fecha ${fi} (Δ${Math.round(diffDays(sd,fi))}d)`);}break;}}}
  }
}
const show=(t,arr)=>{console.log(`\n${t}: ${arr.length}`);arr.slice(0,12).forEach(x=>console.log("  ",x));if(arr.length>12)console.log(`  …(+${arr.length-12})`);};
console.log("TOTAL leaves:",R.total,"· ordinal-weekday verificados OK:",R.ok);
show("⚠ DÍA DE SEMANA no coincide con regla",R.wdMismatch);
show("⚠ SANTO fijo lejos de su fecha (>9d)",R.saintFar);
show("⚠ RANGO invertido (fin<inicio)",R.inverted);
show("⚠ FUERA de ventana sin marcar 'fuera'",R.outUnmarked);
show("⚠ confirmada/fija SIN fecha",R.noDate);
