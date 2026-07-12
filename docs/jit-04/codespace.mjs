// ¿Libera el motor el code-space al soltar un WebAssembly.Module?
// Fabricamos módulos ÚNICOS del tamaño real de un bloque de Play! (~640 B) y medimos RSS.
function uleb(n){const b=[];do{let x=n&0x7f;n>>>=7;if(n)x|=0x80;b.push(x);}while(n);return b;}
function sleb(n){const b=[];let more=1;while(more){let x=n&0x7f;n>>=7;if((n===0&&!(x&0x40))||(n===-1&&(x&0x40)))more=0;else x|=0x80;b.push(x);}return b;}
function sect(id,payload){return [id,...uleb(payload.length),...payload];}
function makeModule(i,padPairs=200){
  const body=[];
  for(let k=0;k<padPairs;k++) body.push(0x41,0x00,0x1a);      // i32.const 0; drop
  body.push(0x41,...sleb(i));                                  // i32.const <unique>
  body.push(0x0b);                                             // end
  const code=[0x00,...body];                                   // 0 local decls
  const bytes=[
    0x00,0x61,0x73,0x6d, 0x01,0x00,0x00,0x00,
    ...sect(1,[0x01,0x60,0x00,0x01,0x7f]),                     // type: ()->i32
    ...sect(3,[0x01,0x00]),                                    // func: typeidx 0
    ...sect(7,[0x01,0x01,0x66,0x00,0x00]),                     // export "f" func 0
    ...sect(10,[0x01,...uleb(code.length),...code]),           // code
  ];
  return new Uint8Array(bytes);
}
const size=makeModule(1).length;
const rss=()=>Math.round(process.memoryUsage().rss/1048576);
const N=parseInt(process.argv[3]||'20000',10);
const mode=process.argv[2];
console.log(`módulo unitario = ${size} B (bloque real de Play! ≈ 636 B) | N=${N} | modo=${mode}`);
const base=rss();
let held=[];
let created=0;
try{
  for(let i=0;i<N;i++){
    const m=new WebAssembly.Module(makeModule(i));
    if(mode==='hold') held.push(m);          // retiene: simula 1 módulo por bloque, vivos
    created++;
    if(mode==='release' && (i%2000===0)) { global.gc && global.gc(); }
    if(i%5000===0 && i) console.log(`  ${i} módulos | RSS ${rss()} MB (+${rss()-base})`);
  }
}catch(e){ console.log(`  ❌ FALLO en ${created}: ${e.message}`); }
if(global.gc) global.gc();
const end=rss();
console.log(`RESULT mode=${mode} created=${created} RSS_base=${base}MB RSS_end=${end}MB delta=${end-base}MB perModule=${(((end-base)*1048576)/Math.max(created,1)).toFixed(0)} B`);
if(mode==='hold') console.log(`  (held ${held.length})`);
