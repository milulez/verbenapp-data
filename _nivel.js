// Asigna 'nivel' (Festón>Festa Maior>Romaría>Verbena>Foliada) a cada fiesta desde señales.
// Idempotente (salta si ya tiene nivel:). ANALIZA por defecto; --apply escribe.
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";

function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const getN=(o,k)=>{const m=o.match(new RegExp(k+':\\s*(-?\\d+)'));return m?+m[1]:null;};
const getB=(o,k)=>new RegExp(k+':\\s*true').test(o);
const arrLen=(o,k)=>{const m=o.match(new RegExp(k+':\\s*\\[([^\\]]*)\\]'));return m&&m[1].trim()?m[1].split(",").length:0;};
const hasDate=o=>/fechaInicio:\s*"\d{4}-\d{2}-\d{2}"/.test(o);
const edicion=txt=>{const m=txt.match(/\b([XVILC]{1,6}|\d{1,3})\s*(?:ª|a)?\s*edici[oó]n/i);return m?1:0;};
const multitud=txt=>{const m=txt.match(/(\d{1,3})[.\s]?(\d{3})\s*(?:personas|visitantes|comensales|asistentes)/i);return m?+(m[1]+m[2]):0;};

function nivel(o,esEstrella){
  if(esEstrella) return "Festón";
  const itur=get(o,'interesTuristico');
  const dias=getN(o,'diasDuracion')||1;
  const fuegos=getB(o,'fuegos');
  const bandas=arrLen(o,'bandas');
  const tipo=get(o,'tipo');
  const estado=get(o,'estado');
  const nota=get(o,'nota')+" "+get(o,'regla');
  const mult=multitud(nota), ed=edicion(nota);
  const dated=hasDate(o)&&estado!=="fuera";
  if(/internacional|nacional/i.test(itur)) return "Festón";
  if(/tur[ií]stico/i.test(itur) || mult>=5000 || (dias>=4&&fuegos&&bandas>=2) || (dias>=4&&mult>=1000)) return "Festa Maior";
  if(dated && ((estado==="confirmada"||estado==="fija") && (dias>=2||bandas>=1||fuegos||(tipo==="gastronomica"&&ed)||mult>=1000))) return "Romaría";
  if(dated) return "Verbena";
  return "Foliada"; // sin fecha / desconocida / fuera
}

// cobertura 1-5: Festón=5, Festa Maior=4, Romaría=3, Verbena=2, Foliada=1
const STAR={"Festón":5,"Festa Maior":4,"Romaría":3,"Verbena":2,"Foliada":1};
const dist={5:0,4:0,3:0,2:0,1:0};
const samples={5:[],4:[],3:[],2:[],1:[]};

// 1) parroquiales — SOBRESCRIBE relevancia con el rating de cobertura (1-5)
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];
for(const f of files){
  let t=fs.readFileSync(HOME+f,"utf8");
  const objs=objects(t).filter(([a,b])=>{const o=t.slice(a,b);return /parroquia:|fechaInicio:/.test(o)&&!/fiestas:/.test(o)&&(o.match(/{/g)||[]).length===1;});
  for(let k=objs.length-1;k>=0;k--){const [a,b]=objs[k];let o=t.slice(a,b);
    const st=STAR[nivel(o,false)];dist[st]++;
    if(samples[st].length<4)samples[st].push(get(o,'nombre').slice(0,40));
    let no=/relevancia:\s*-?\d+/.test(o) ? o.replace(/relevancia:\s*-?\d+/,`relevancia: ${st}`) : o.replace(/\s*,?\s*\}$/,"")+`, relevancia: ${st} }`;
    if(APPLY)t=t.slice(0,a)+no+t.slice(b);
  }
  if(APPLY)fs.writeFileSync(HOME+f,t);
}
// 2) estrella → 5 (ya están a relevancia:5)
{let t=fs.readFileSync(HOME+"fiestas.ts","utf8");const c=(t.match(/relevancia:\s*5/g)||[]).length;dist[5]+=c;}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log("cobertura → nº fiestas:",JSON.stringify(dist));
console.log("Total:",Object.values(dist).reduce((a,b)=>a+b,0));
for(const k of [5,4,3,2,1])console.log(`\n${"★".repeat(k)} (${k}):`,samples[k].join(" · "));
