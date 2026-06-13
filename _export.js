// Export UNIFICADO: estrella (fiestas.ts) + parroquiales (concellos-*.ts) → verbenas.json, misma forma.
const fs=require('fs');
const HOME=(process.env.VERBEN_DIR||(process.env.HOME+"/Desktop/VerbenApp"))+"/";
function objects(t){const arr=[],st=[];let inS=false,sc="",p="";for(let i=0;i<t.length;i++){const c=t[i];if(inS){if(c===sc&&p!=="\\")inS=false;p=c;continue}if(c==='"'||c==="'"||c==="`"){inS=true;sc=c;p=c;continue}if(c==='{')st.push(i);else if(c==='}'){const x=st.pop();if(x!==undefined)arr.push([x,i+1])}p=c}return arr;}
const get=(o,k)=>{const m=o.match(new RegExp(k+':\\s*"([^"]*)"'));return m?m[1]:"";};
const getN=(o,k)=>{const m=o.match(new RegExp(k+':\\s*(-?\\d+(?:\\.\\d+)?)'));return m?+m[1]:null;};
const getB=(o,k)=>new RegExp(k+':\\s*true').test(o);
const getArr=(o,k)=>{const m=o.match(new RegExp(k+':\\s*\\[([^\\]]*)\\]'));return m&&m[1].trim()?m[1].split(",").map(s=>s.trim().replace(/^"|"$/g,"")):[];};
const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const slug=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ñ/g,"n").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const dias=(a,b)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(a))return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(b))return 1;const d=Math.round((new Date(b)-new Date(a))/864e5)+1;return d>0&&d<40?d:1;};

// --- helpers de descubrimiento / display (atacan cold-start #2 y discovery #3) ---
const MES=["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESLARGO=["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DOW=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const isISO=s=>/^\d{4}-\d{2}-\d{2}$/.test(s);
function cuando(fi,ff,regla){
  if(isISO(fi)){
    const d1=+fi.slice(8,10),m1=+fi.slice(5,7),wd=DOW[new Date(fi+"T12:00:00").getDay()].slice(0,3);
    if(isISO(ff)&&ff!==fi){const d2=+ff.slice(8,10),m2=+ff.slice(5,7);return m1===m2?`${d1}–${d2} ${MES[m1]}`:`${d1} ${MES[m1]} – ${d2} ${MES[m2]}`;}
    return `${wd} ${d1} ${MES[m1]}`;
  }
  // sin fecha: intentar mes desde regla
  const mm=(regla||"").toLowerCase().match(/\b(xaneiro|enero|febrero|marzo|abril|mayo|maio|junio|xuño|julio|xullo|agosto|septiembre|setembro|octubre|outubro)\b/);
  const M2={enero:1,febrero:2,marzo:3,abril:4,mayo:5,maio:5,junio:6,xuño:6,julio:7,xullo:7,agosto:8,septiembre:9,setembro:9,octubre:10,outubro:10};
  if(mm)return `${MESLARGO[M2[mm[1]]]} · por confirmar`;
  return "Fecha por confirmar";
}
function imagenCat(tipo,comida,fuegos){
  const c=comida.join(" ").toLowerCase();
  if(tipo==="gastronomica"){
    if(/percebe|pulpo|polbo|mexill[oó]n|marisco|ostra|vieira|berberecho|sardi|lamprea|anguila/.test(c))return "marisco";
    if(/vi[ñn]o|albari[ñn]o|godello/.test(c))return "vino";
    if(/churrasc|carne|cachena|cordeiro|costell|chulet|raxo|cocido|callos|polo/.test(c))return "carne";
    return "gastro";
  }
  if(tipo==="concierto")return "concierto";
  if(tipo==="romeria")return "romeria";
  if(fuegos)return "fuegos";
  return "verbena"; // tradicional / patronal
}
const ordenScore=(cobertura,estado,fi)=>cobertura*1000+({confirmada:300,fija:200,recurrente:100}[estado]||0)+(isISO(fi)?50:0);
// reclamo = gancho "por qué ir" (1 línea), por prioridad de motivación
function reclamo(f){
  const txt=((f.descripcion||"")+" "+(f.regla||"")).toLowerCase();
  if(/internacional|nacional/i.test(f.interesTuristico||""))return "Fiesta de Interés Turístico";
  if(f.bandas&&f.bandas.length){const top=f.bandas.slice(0,2).join(", ");return f.bandas.length>2?`Orquestas ${top}…`:`Con ${top}`;}
  if(f.tipo==="gastronomica"&&f.comida&&f.comida.length)return `Festa gastronómica · ${f.comida.slice(0,2).join(", ")}`;
  if(f.tipo==="concierto")return "Música en directo / festival";
  if(f.interesTuristico)return "Fiesta de Interés Turístico de Galicia";
  if(f.fuegos)return "Fuegos artificiales";
  if(/rapa das besta|danzas? ancestrai|queimada popular|batalla.*vino|carretada|globo|curro/.test(txt))return "Tradición singular";
  if(/procesi[oó]n/.test(txt))return "Procesión y verbena";
  if(f.comida&&f.comida.length)return `Comida popular · ${f.comida.slice(0,2).join(", ")}`;
  if(f.verbena)return "Verbena de baile";
  return "Festa patronal";
}
// nombre popular = "Festas de/do/da [lugar]" (como lo conoce la prensa/vecindario)
function artLugar(lugar){
  let l=(lugar||"").replace(/\s*\([^)]*\)/g,"").split("/")[0].trim();
  if(!l)return "";
  if(/^O\s+/i.test(l))return "do "+l.replace(/^O\s+/i,"");
  if(/^A\s+/i.test(l))return "da "+l.replace(/^A\s+/i,"");
  if(/^As\s+/i.test(l))return "das "+l.replace(/^As\s+/i,"");
  if(/^Os\s+/i.test(l))return "dos "+l.replace(/^Os\s+/i,"");
  return "de "+l;
}
// santos universales → forma popular corta (la gente los llama así, el lugar los distingue)
const SANTOS_POP=[
 [/ap[oó]stolo?|santiago/i,"Santiago"],[/carm(e|en)/i,"O Carme"],[/san roque/i,"San Roque"],
 [/san pedro/i,"San Pedro"],[/santa mari[ñn]a|santa marina/i,"Santa Mariña"],
 [/asunci[oó]n|nosa se[ñn]ora.*agosto/i,"A Asunción"],[/san lourenzo|san lorenzo/i,"San Lourenzo"],
 [/bartolom/i,"San Bartolomeu"],[/remedios/i,"Os Remedios"],[/santa ana/i,"Santa Ana"],
 [/san bieito|san benito/i,"San Bieito"],[/san anton(io|in)|santo ant[oó]n/i,"San Antonio"],
 [/san mamede|san mam[eé]s/i,"San Mamede"],[/san ram[oó]n/i,"San Ramón"],
 [/divino salvador|san salvador|santo salvador/i,"San Salvador"],[/san miguel/i,"San Miguel"],
 [/san paio|san pelayo|pelaio/i,"San Paio"],[/santa marta/i,"Santa Marta"],
 [/virxe das neves|virgen de las nieves|nosa se[ñn]ora das neves/i,"As Neves"],
 [/san cristov|san crist[oó]b/i,"San Cristovo"],[/dolores|d[oó]res/i,"As Dores"],
 [/corpus/i,"Corpus"],[/santa cristina/i,"Santa Cristina"],[/san pantale[oó]n/i,"San Pantaleón"],
 [/santa margarida|santa margarita/i,"Santa Margarida"],
];
// combinada = 2+ santos o "X e San Y" → no se reduce a un santo
const esCombinada=n=>/( e san| y san| e santa| e virxe| e nosa| e o |e santísimo|y santa|sacramento|coraz[oó]n)/i.test(n) || (n.match(/\bsan |\bsanta |\bvirxe |\bsanto /gi)||[]).length>=2;
// santo = etiqueta de santo para filtrar/agrupar (no es el nombre mostrado)
function santoDe(f){
  const n=f.nombre;
  if(/san xo[aá]n|san juan/i.test(n))return "San Xoán";
  if(esCombinada(n))return null; // combinada: no un solo santo
  for(const [re,pop] of SANTOS_POP){ if(re.test(n)) return pop; }
  return null;
}
function nombrePopular(f){
  if(f.origen==="estrella")return f.nombre;
  const n=f.nombre;
  // San Xoán PURO en junio = "San Xoán" a secas (la hoguera universal, así la conoce todo el mundo)
  if(/san xo[aá]n|san juan/i.test(n)){
    const enJunio=f.fechaInicio&&f.fechaInicio.slice(5,7)==="06";
    if(!esCombinada(n)&&enJunio)return "San Xoán";
  }
  // resto → "Festas de [lugar]" (como lo llama la gente: do Burgo, de Mosteirón…)
  if(f.parroquia&&f.parroquia.trim())return "Festas "+artLugar(f.parroquia);
  return n;
}
function extras(f){
  const mes=isISO(f.fechaInicio)?+f.fechaInicio.slice(5,7):null;
  const wd=isISO(f.fechaInicio)?new Date(f.fechaInicio+"T12:00:00").getDay():null;
  const txt=((f.descripcion||"")+" "+(f.regla||"")).toLowerCase();
  const np=nombrePopular(f);
  const santo=santoDe(f);
  return {
    nombrePopular: np,
    santo,
    busqueda: norm((f.busqueda||"")+" "+np+" "+(santo||"")),
    mes, diaSemana: wd!=null?DOW[wd]:null, finde: wd!=null?(wd===5||wd===6||wd===0):false,
    cuando: cuando(f.fechaInicio,f.fechaFin,f.regla),
    imagenCat: imagenCat(f.tipo,f.comida,f.fuegos),
    destacada: f.cobertura>=4,
    orden: ordenScore(f.cobertura,f.estado,f.fechaInicio),
    reclamo: reclamo(f),
    procesion: /procesi[oó]n|misa solemne|misa cantada|romaría relixiosa|ofrenda/.test(txt),
    familiar: f.atracciones || /infantil|inflabl|hinchabl|inchabl|\bfoam\b|espuma|festa infantil|cama el[aá]stica|cucañas|nenos|parque infantil/.test(txt),
  };
}
const out=[];

// 1) ESTRELLA
{
  const t=fs.readFileSync(HOME+"fiestas.ts","utf8");
  const coords=JSON.parse(fs.readFileSync("/tmp/estrella_coords.json","utf8"));
  for(const [a,b] of objects(t)){const o=t.slice(a,b);
    if((o.match(/{/g)||[]).length!==1)continue;
    if(!get(o,'id')||!get(o,'nombre')||!get(o,'pueblo'))continue; // excluye la interface (id: string; sin comillas)
    const pueblo=get(o,'pueblo'),bandas=getArr(o,'bandas'),comida=getArr(o,'comida');
    const co=coords[pueblo]||{};
    const f={
      id:get(o,'id'), nombre:get(o,'nombre'), origen:"estrella",
      tipo:get(o,'tipo'), cobertura:getN(o,'cobertura')||5,
      fechaInicio:get(o,'fechaInicio'), fechaFin:get(o,'fechaFin'), estado:get(o,'estadoFecha'),
      provincia:get(o,'provincia'), comarca:"", concello:pueblo.replace(/\s*\([^)]*\)/,""), parroquia:"",
      lat:co.lat??null, lng:co.lng??null, precisionGeo:"pueblo",
      bandas, comida, verbena:bandas.length>0||/tradicional|concierto/.test(get(o,'tipo')),
      atracciones:getB(o,'atracciones'), fuegos:/fuego|pirotec|globo|hoguera|cacharela/i.test(get(o,'datoCurioso')),
      franja:null, interesTuristico:(o.match(/interesTuristico:\s*"([^"]*)"/)||[])[1]||null,
      diasDuracion:dias(get(o,'fechaInicio'),get(o,'fechaFin')),
      descripcion:get(o,'datoCurioso'), motivo:(o.match(/motivoEspecial:\s*"([^"]*)"/)||[])[1]||null,
      regla:"", busqueda:norm([get(o,'nombre'),pueblo,get(o,'provincia'),get(o,'tipo'),...comida,...bandas].join(" ")),
    };
    out.push(f);
  }
}
// 2) PARROQUIALES
for(const f of ["concellos-coruna.ts","concellos-lugo.ts","concellos-ourense.ts","concellos-pontevedra.ts"]){
  const t=fs.readFileSync(HOME+f,"utf8");
  const all=objects(t).sort((a,b)=>a[0]-b[0]);
  const crs=all.filter(([a,b])=>/fiestas:/.test(t.slice(a,b)));
  for(const [a,b] of all){const o=t.slice(a,b);
    if(!(/parroquia:|fechaInicio:/.test(o))||/fiestas:/.test(o)||(o.match(/{/g)||[]).length!==1)continue;
    let best=null;for(const [ca,cb] of crs){if(ca<=a&&cb>=b){if(!best||(cb-ca)<(best[1]-best[0]))best=[ca,cb]}}
    let cn="",pv="",cm="";if(best){const head=t.slice(best[0],best[0]+260);cn=(head.match(/nombre:\s*"([^"]*)"/)||[])[1]||"";pv=(head.match(/provincia:\s*"([^"]*)"/)||[])[1]||"";cm=(head.match(/comarca:\s*"([^"]*)"/)||[])[1]||"";}
    out.push({
      id:get(o,'id')||slug(get(o,'nombre')+"-"+(get(o,'parroquia')||cn)), nombre:get(o,'nombre'), origen:"parroquial",
      tipo:get(o,'tipo'), cobertura:getN(o,'cobertura')||1,
      fechaInicio:get(o,'fechaInicio'), fechaFin:get(o,'fechaFin'), estado:get(o,'estado'),
      provincia:pv, comarca:cm, concello:cn, parroquia:get(o,'parroquia'),
      lat:getN(o,'lat'), lng:getN(o,'lng'), precisionGeo:get(o,'precisionGeo')||"concello",
      bandas:getArr(o,'bandas'), comida:getArr(o,'comida'), verbena:getB(o,'verbena'),
      atracciones:getB(o,'atracciones'), fuegos:getB(o,'fuegos'),
      franja:(o.match(/franja:\s*"([^"]*)"/)||[])[1]||null, interesTuristico:(o.match(/interesTuristico:\s*"([^"]*)"/)||[])[1]||null,
      diasDuracion:getN(o,'diasDuracion'),
      descripcion:get(o,'nota'), motivo:null, regla:get(o,'regla'), busqueda:get(o,'busqueda'),
    });
  }
}
// fallback descripción para las pocas vacías (sin inventar: solo tipo+lugar)
const TIPOLABEL={patronal:"Festa patronal",gastronomica:"Festa gastronómica",romeria:"Romería",concierto:"Festival de música",tradicional:"Festa tradicional"};
for(const f of out){
  if(!f.descripcion||!f.descripcion.trim()){
    const lugar=f.parroquia?`${f.parroquia} (${f.concello})`:f.concello;
    f.descripcion=`${TIPOLABEL[f.tipo]||"Festa"} en ${lugar}. Celebración local con verbena.`;
  }
}
// añadir campos derivados de descubrimiento/display a cada fiesta
const final=out.map(f=>({...f,...extras(f)}));
fs.writeFileSync(HOME+"verbenas.json",JSON.stringify(final));
// stats
const byProv={},byTipo={},byStar={},conFecha=out.filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(f.fechaInicio)).length,conCoord=out.filter(f=>f.lat).length;
out.forEach(f=>{byProv[f.provincia]=(byProv[f.provincia]||0)+1;byTipo[f.tipo]=(byTipo[f.tipo]||0)+1;byStar[f.cobertura]=(byStar[f.cobertura]||0)+1;});
console.log("verbenas.json escrito ·",out.length,"fiestas");
console.log("con fecha ISO:",conFecha,"· con coords:",conCoord);
console.log("por provincia:",JSON.stringify(byProv));
console.log("por tipo:",JSON.stringify(byTipo));
console.log("por cobertura:",JSON.stringify(byStar));
