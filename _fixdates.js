// Arregla fechas SEGURO: A) recurrente con ordinal+día mal → recalcula; B) rango invertido; C) confirmada/fija sin fecha → desconocida.
// NO toca santo-lejos ni fechas de confirmada/fija (vienen de fuente). DRY-RUN por defecto; --apply.
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const WD={domingo:0,luns:1,lunes:1,martes:2,mercores:3,miercoles:3,xoves:4,jueves:4,venres:5,viernes:5,sabado:6};
const MON={xaneiro:1,enero:1,febrero:2,febreiro:2,marzo:3,abril:4,mayo:5,maio:5,junio:6,xuño:6,julio:7,xullo:7,agosto:8,septiembre:9,setembro:9,octubre:10};
const ORD={primer:1,primeir:1,segundo:2,segund:2,tercer:3,terceir:3,cuarto:4,cuart:4};
function nthW(y,m,wd,n){let c=0;for(let d=1;d<=31;d++){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCMonth()!==m-1)break;if(dt.getUTCDay()===wd){c++;if(c===n)return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}}return null;}
function lastW(y,m,wd){let r=null;for(let d=1;d<=31;d++){const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCMonth()!==m-1)break;if(dt.getUTCDay()===wd)r=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}return r;}
const addDays=(iso,n)=>{const d=new Date(iso+"T12:00:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const span=(a,b)=>/^\d{4}-\d{2}-\d{2}$/.test(b)?Math.round((new Date(b)-new Date(a))/864e5):0;

let A=0,B=0,C=0;const sa=[],sb=[],sc=[];
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).filter(([a,b])=>isLeaf(t.slice(a,b)));
  for(let k=objs.length-1;k>=0;k--){const [a,b]=objs[k];let o=t.slice(a,b),no=o,ch=false;
    const fi=get(o,'fechaInicio'),ff=get(o,'fechaFin'),est=get(o,'estado'),regla=get(o,'regla').toLowerCase(),nombre=get(o,'nombre');
    // C) confirmada/fija sin fecha -> desconocida
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fi)){
      if(est==="confirmada"||est==="fija"){no=no.replace(/estado:\s*"[^"]*"/,'estado: "desconocida"');ch=true;C++;if(sc.length<8)sc.push(`${nombre.slice(0,30)} (${est}→desconocida)`);}
    } else {
      // B) rango invertido
      if(/^\d{4}-\d{2}-\d{2}$/.test(ff)&&ff<fi){
        const sp=Math.round((new Date(fi)-new Date(ff))/864e5);
        if(sp<=10){no=no.replace(`fechaInicio: "${fi}"`,`fechaInicio: "${ff}"`).replace(`fechaFin: "${ff}"`,`fechaFin: "${fi}"`);} // swap
        else{no=no.replace(/fechaFin:\s*"[^"]*"/,`fechaFin: "${fi}"`);} // fin=inicio
        ch=true;B++;if(sb.length<8)sb.push(`${nombre.slice(0,30)} ${fi}→${ff}`);
      }
      // A) recurrente con ordinal+día mal -> recalcular
      else if(est==="recurrente"){
        const mt=regla.match(/(primer|primeir|segundo|segund|tercer|terceir|cuarto|cuart|[uú]ltim)\w*\s+(domingo|luns|lunes|martes|m[ée]rcores|mi[ée]rcoles|xoves|jueves|venres|viernes|s[áa]bado)\s+de\s+(\w+)/);
        if(mt){const wd=WD[mt[2].normalize("NFD").replace(/[̀-ͯ]/g,"")];const mon=MON[mt[3]];
          if(wd!=null&&mon){let exp;if(/[uú]ltim/.test(mt[1]))exp=lastW(2026,mon,wd);else exp=nthW(2026,mon,wd,ORD[mt[1]]||ORD[mt[1].slice(0,6)]||1);
            if(exp&&exp!==fi){const sp=span(fi,ff);no=no.replace(`fechaInicio: "${fi}"`,`fechaInicio: "${exp}"`);if(/^\d{4}-\d{2}-\d{2}$/.test(ff))no=no.replace(`fechaFin: "${ff}"`,`fechaFin: "${addDays(exp,Math.max(0,sp))}"`);ch=true;A++;if(sa.length<10)sa.push(`${nombre.slice(0,28)} ${fi}→${exp} (${mt[0]})`);}
          }
        }
      }
    }
    if(ch&&APPLY)t=t.slice(0,a)+no+t.slice(b);
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log(`A) recurrente recalculadas: ${A}`);sa.forEach(x=>console.log("   ",x));
console.log(`B) rangos invertidos: ${B}`);sb.forEach(x=>console.log("   ",x));
console.log(`C) confirmada/fija sin fecha → desconocida: ${C}`);sc.forEach(x=>console.log("   ",x));
