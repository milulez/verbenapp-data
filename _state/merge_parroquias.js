const fs=require('fs');
const DIR='/private/tmp/claude-501/-Users-milulez/e047f94c-7af2-4a74-b327-806e446c95e1/tasks/';
const provFile={"A Coruña":"concellos-coruna.ts",Lugo:"concellos-lugo.ts",Ourense:"concellos-ourense.ts",Pontevedra:"concellos-pontevedra.ts"};
const base='/Users/milulez/Desktop/VerbenApp/';
const s=v=>v==null?'':String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');

function fiestaLine(f){
  let o='      {';
  o+=` nombre: "${s(f.nombre)}",`;
  if(f.parroquia)o+=` parroquia: "${s(f.parroquia)}",`;
  if(f.fechaInicio)o+=` fechaInicio: "${s(f.fechaInicio)}",`;
  if(f.fechaFin)o+=` fechaFin: "${s(f.fechaFin)}",`;
  o+=` estado: "${s(f.estado)}",`;
  if(f.regla)o+=` regla: "${s(f.regla)}",`;
  o+=` tipo: "${s(f.tipo||'patronal')}",`;
  if(f.nota)o+=` nota: "${s(f.nota)}",`;
  o+=' },';
  return o;
}

const batchFiles=process.argv.slice(2).map(x=>DIR+x+'.output');
let added=0,dups=0,concellosTouched=0;
const txt={}; for(const f of Object.values(provFile)) txt[f]=fs.readFileSync(base+f,'utf8');

for(const bf of batchFiles){
  const o=JSON.parse(fs.readFileSync(bf,'utf8'));
  const concellos=(o.result||o).concellos||[];
  for(const c of concellos){
    const file=provFile[c.provincia]; if(!file)continue;
    let t=txt[file];
    const marker=`    nombre: "${c.concello}",`;
    const idx=t.indexOf(marker);
    if(idx<0){ console.error('NO encontrado:',c.provincia,c.concello); continue; }
    // cierre de fiestas de ESTE concello: primer "\n    ],\n  }," tras idx
    const close=t.indexOf('\n    ],\n  },', idx);
    if(close<0){ console.error('sin cierre:',c.concello); continue; }
    const block=t.slice(idx, close);
    // nombres ya presentes en el bloque
    const existing=new Set([...block.matchAll(/nombre: "([^"]+)"/g)].map(m=>norm(m[1])));
    const newLines=[];
    for(const f of (c.fiestas||[])){
      const k=norm(f.nombre)+ '|' + norm(f.parroquia);
      const k2=norm(f.nombre);
      if(existing.has(k2)){ dups++; continue; }
      existing.add(k2);
      newLines.push(fiestaLine(f));
    }
    if(newLines.length){
      t=t.slice(0,close)+'\n'+newLines.join('\n')+t.slice(close);
      txt[file]=t; added+=newLines.length; concellosTouched++;
    }
  }
}
for(const f of Object.values(provFile)) fs.writeFileSync(base+f,txt[f]);
console.log(`Parroquias añadidas: ${added} · duplicadas saltadas: ${dups} · concellos tocados: ${concellosTouched}`);
