// Enriquecedor parroquias VerbenApp — DERIVA campos comparables con estrella desde nota+regla.
// NO web research (4409 fiestas inviable + datos ya están en el texto verificado de los agentes).
// Añade: bandas[], comida[], atracciones, fuegos, franja(día|noche|ambas), interesTuristico, diasDuracion, relevancia(1-5).
// Uso: node _enrich.js   (DRY-RUN)   |   node _enrich.js --apply
const fs=require('fs');
const APPLY=process.argv.includes('--apply');
const files=["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"];

function objects(t){const arr=[],stack=[];let inStr=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inStr){if(c===sc&&p!=="\\")inStr=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inStr=true;sc=c;p=c;continue}if(c==='{')stack.push(i);else if(c==='}'){const x=stack.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const isLeaf=o=>/nombre:/.test(o)&&!/fiestas:/.test(o)&&!/concello:/.test(o)&&(o.match(/{/g)||[]).length===1;
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};

// --- extractores ---
const COMIDA=[['pulpo|polbo|pulpeir','pulpo'],['churrasc','churrasco'],['sardi[ñn]','sardiñada'],['empanada','empanada'],['callos','callos'],['costela|costill','costillar'],['paella','paella'],['fideg|fideos','fideuá'],['mexill[oó]n|mejill[oó]n','mexillón'],['ostra','ostras'],['lamprea','lamprea'],['vi[ñn]o|albari[ñn]o|godello','vino'],['queimada','queimada'],['chorizo','chorizo'],['cachena','carne cachena'],['cabrito|cordeiro|cordero','cordeiro'],['torrezn','torreznos'],['caldo','caldo galego'],['cocido','cocido'],['raxo|zorza','raxo'],['pemento|pimiento','pemento'],['vieira','vieira'],['berberecho','berberecho'],['cereix|cereza','cereixa'],['troita|trucha','troita'],['anguila','anguila'],['codillo','codillo'],['chulet[oó]n','chuletón'],['polo asado|pollo asado','polo asado'],['mexillonada|mejillonada','mexillonada'],['xant|comida popular|comida de|cena popular|churrascada','comida popular']];
const ATRAC=/hinchabl|inchabl|inflabl|\bfoam\b|espuma|festa infantil|fiesta infantil|atracci[oó]n|\bferia\b|parque infantil|cama el[aá]stica|cucañas|inflable/i;
const FUEGOS=/fuegos artific|pirotecn|pirot[eé]cn|foguete|\btraca\b|castelo de fog|castillo de fueg|\bfogos\b|fogueira|hoguera|cacharela|lumeirada/i;
const ITUR=/inter[eé]s tur[ií]stico(\s+(internacional|nacional|de galicia|galego|gallego))?/i;
// franja
const NOCHE=/verbena|nocturn|madrugada|\bnoite\b|disco m[oó]vil|\bdj\b|de noche|22:|23:|00:|01:|02:|sesi[oó]n vermú.*noche/i;
const DIA=/\bmisa\b|procesi[oó]n|alborada|pasacalles|medio[ dí]|vermú|vermut|romer[ií]a|12:|13:|14:|comida popular|diurn/i;

// extraer nombres de bandas/orquestas/charangas/grupos
function bandas(txt){
  const out=new Set();
  const KW=/(?:orquestras?|orquestas?|charangas?|grupo(?:\s+de\s+(?:danza|gaita|baile))?|disco m[oó]vil|tr[ií]o|banda(?:\s+de\s+m[uú]sica| municipal)?|dj)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ’.&-]*(?:\s+(?:de|da|do|e|y|&|la|las|los|del|of|the|big)\s+[\wÁÉÍÓÚÑáéíóúñ’.&-]+|\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ’.&-]+){0,3})/g;
  let m;
  while((m=KW.exec(txt))){let name=m[1].trim().replace(/[.,;:)]+$/,"");
    // recortar si arranca con palabra común
    if(name.length>=2 && !/^(con|por|y|e|de|la|el|los|las|del|hasta|tarde|noche|por la|matin)/i.test(name)) out.add(name);
    if(out.size>=6)break;
  }
  return [...out];
}
function comida(txt){const out=new Set();for(const [re,lab] of COMIDA){if(new RegExp(re,'i').test(txt))out.add(lab);}return [...out];}
function franja(txt){const n=NOCHE.test(txt),d=DIA.test(txt);if(n&&d)return"ambas";if(n)return"noche";if(d)return"día";return null;}
function diasDur(fi,ff){if(!/^\d{4}-\d{2}-\d{2}$/.test(fi))return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(ff))return 1;const a=new Date(fi),b=new Date(ff);const dd=Math.round((b-a)/864e5)+1;return dd>0&&dd<40?dd:1;}
function edicion(txt){const m=txt.match(/\b([XVILC]{1,6}|\d{1,3})\s*(?:ª|a)?\s*edici[oó]n/i);if(!m)return 0;const r=m[1];const rom={X:10,V:5,I:1,L:50,C:100};let n=+r;if(isNaN(n)){n=0;let prev=0;for(let i=r.length-1;i>=0;i--){const v=rom[r[i].toUpperCase()]||0;if(v<prev)n-=v;else{n+=v;prev=v}}}return n||0;}
function multitud(txt){const m=txt.match(/(\d{1,3})[.\s]?(\d{3})\s*(?:personas|visitantes|comensales|asistentes|raciones)/i);return m?(+(m[1]+m[2])):0;}

function relevancia({iturText,bn,cm,fuegos,dias,ed,mult,estado,tipo}){
  let s=1;
  if(iturText){s+= /internacional/i.test(iturText)?3 : /nacional/i.test(iturText)?2 : 1.5;}
  if(dias>=4)s+=2;else if(dias>=2)s+=1;
  if(bn>=3)s+=1.5;else if(bn>=1)s+=0.5;
  if(cm>=3)s+=1;else if(cm>=2)s+=0.5;
  if(fuegos)s+=0.7;
  if(ed>=20)s+=1;else if(ed>=5)s+=0.5;
  if(mult>=5000)s+=1.5;else if(mult>=1000)s+=0.8;
  if(estado==="confirmada")s+=0.5;
  if(tipo==="concierto"||tipo==="gastronomica")s+=0.3;
  return Math.max(1,Math.min(5,Math.round(s)));
}

const stats={total:0,conBandas:0,conComida:0,atrac:0,fuegos:0,itur:0,franjaSet:0,rel:{1:0,2:0,3:0,4:0,5:0}};
const samples=[];

for(const f of files){
  let t=fs.readFileSync(f,"utf8");
  const objs=objects(t);
  for(let k=objs.length-1;k>=0;k--){
    const [a,b]=objs[k];let o=t.slice(a,b);
    if(!isLeaf(o))continue;
    if(/relevancia:/.test(o))continue; // ya enriquecido (idempotente)
    stats.total++;
    const nombre=get(o,'nombre'),regla=get(o,'regla'),nota=get(o,'nota'),tipo=get(o,'tipo'),estado=get(o,'estado');
    const fi=get(o,'fechaInicio'),ff=get(o,'fechaFin');
    const txt=[nombre,regla,nota].join(' ');
    const bn=bandas(txt), cm=comida(txt), at=ATRAC.test(txt), fg=FUEGOS.test(txt);
    const iturM=txt.match(ITUR); const itur=iturM?iturM[0].replace(/\s+/g,' ').trim():null;
    const fr=franja(txt), dias=diasDur(fi,ff), ed=edicion(txt), mult=multitud(txt);
    const rel=relevancia({iturText:itur,bn:bn.length,cm:cm.length,fuegos:fg,dias:dias||1,ed,mult,estado,tipo});
    if(bn.length)stats.conBandas++; if(cm.length)stats.conComida++; if(at)stats.atrac++; if(fg)stats.fuegos++; if(itur)stats.itur++; if(fr)stats.franjaSet++; stats.rel[rel]++;
    if(samples.length<10&&(bn.length||cm.length||itur))samples.push(`[r${rel}] ${nombre.slice(0,32)} | bandas:${JSON.stringify(bn)} comida:${JSON.stringify(cm)} ${itur?'·ITUR':''} ${fr||''} ${dias}d`);

    // construir campos
    const esc=s=>'"'+s.replace(/"/g,'\\"')+'"';
    const fields=`bandas: [${bn.map(esc).join(", ")}], comida: [${cm.map(esc).join(", ")}], atracciones: ${at}, fuegos: ${fg}, franja: ${fr?esc(fr):"null"}, interesTuristico: ${itur?esc(itur):"null"}, diasDuracion: ${dias===null?"null":dias}, relevancia: ${rel}`;
    // insertar antes del cierre, normalizando coma final
    let body=o.replace(/\s*,?\s*\}$/,"");
    const no=body+`, ${fields} }`;
    if(APPLY)t=t.slice(0,a)+no+t.slice(b);
  }
  if(APPLY)fs.writeFileSync(f,t);
}
console.log(APPLY?"=== APLICADO ===":"=== DRY-RUN ===");
console.log(JSON.stringify(stats,null,2));
console.log("\nMuestras:");samples.forEach(s=>console.log("  "+s));
