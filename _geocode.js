// Geocodifica los 313 concellos vía Nominatim/OSM. Resumible (cache /tmp/concello_coords.json).
// Valida bbox Galicia. Uso: node _geocode.js   (corre hasta acabar; relanzable, salta los ya hechos)
const fs=require('fs');
const https=require('https');
const HOME=process.env.HOME+"/Desktop/VerbenApp/";
const CACHE="/tmp/concello_coords.json";
const all=JSON.parse(fs.readFileSync(HOME+"_state/all_concellos.json","utf8"));
let cache=fs.existsSync(CACHE)?JSON.parse(fs.readFileSync(CACHE,'utf8')):{};
// bbox Galicia (con margen)
const inGal=(la,lo)=>la>41.7&&la<43.9&&lo>-9.5&&lo<-6.6;
const UA="VerbenApp/1.0 (emiliofernandezlez@gmail.com)";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function geturl(u){return new Promise((res,rej)=>{https.get(u,{headers:{"User-Agent":UA}},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(d));}).on("error",rej);});}
async function query(q){const u="https://nominatim.openstreetmap.org/search?q="+encodeURIComponent(q)+"&format=json&limit=1&countrycodes=es";
  try{const j=JSON.parse(await geturl(u));if(j[0]){const la=+j[0].lat,lo=+j[0].lon;if(inGal(la,lo))return{lat:+la.toFixed(5),lng:+lo.toFixed(5),src:j[0].type};}}catch(e){}
  return null;}

(async()=>{
  let done=0,fail=[],ya=0;
  for(const c of all){
    const key=c.provincia+"|"+c.concello;
    if(cache[key]){ya++;continue;}
    let r=await query(`Concello de ${c.concello}, ${c.provincia}, Galicia, Spain`);
    await sleep(1100);
    if(!r){r=await query(`${c.concello}, ${c.provincia}, Galicia, Spain`);await sleep(1100);}
    if(r){cache[key]=r;done++;}else{fail.push(key);}
    if((done+fail.length)%25===0){fs.writeFileSync(CACHE,JSON.stringify(cache));process.stdout.write(`  ...${done} nuevos, ${fail.length} fallos\n`);}
  }
  fs.writeFileSync(CACHE,JSON.stringify(cache));
  console.log(`HECHO: cache=${Object.keys(cache).length}/313 · nuevos ${done} · ya estaban ${ya} · fallos ${fail.length}`);
  if(fail.length)console.log("FALLOS:",fail);
})();
