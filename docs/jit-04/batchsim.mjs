function uleb(n){const b=[];do{let x=n&0x7f;n>>>=7;if(n)x|=0x80;b.push(x);}while(n);return b;}
function sleb(n){const b=[];let more=1;while(more){let x=n&0x7f;n>>=7;if((n===0&&!(x&0x40))||(n===-1&&(x&0x40)))more=0;else x|=0x80;b.push(x);}return b;}
function sect(id,p){return [id,...uleb(p.length),...p];}
// módulo con FN funciones, cada una del tamaño de un bloque real (~636B de cuerpo)
function makeBatch(seed,FN,padPairs=200){
  const types=sect(1,[0x01,0x60,0x00,0x01,0x7f]);
  const funcs=sect(3,[...uleb(FN),...Array(FN).fill(0x00)]);
  const exps=[];for(let f=0;f<FN;f++){const nm=`f${f}`;exps.push(nm.length,...[...nm].map(c=>c.charCodeAt(0)),0x00,...uleb(f));}
  const exp=sect(7,[...uleb(FN),...exps]);
  const bodies=[];
  for(let f=0;f<FN;f++){
    const body=[];
    for(let k=0;k<padPairs;k++) body.push(0x41,0x00,0x1a);
    body.push(0x41,...sleb(seed*1000+f),0x0b);
    const code=[0x00,...body];
    bodies.push(...uleb(code.length),...code);
  }
  const codeSec=sect(10,[...uleb(FN),...bodies]);
  return new Uint8Array([0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,...types,...funcs,...exp,...codeSec]);
}
const rss=()=>Math.round(process.memoryUsage().rss/1048576);
const FN=parseInt(process.argv[2]||'1',10);
const TOTAL_BLOCKS=20000;
const NMOD=Math.ceil(TOTAL_BLOCKS/FN);
const b1=makeBatch(0,FN);
console.log(`batch=${FN} bloques/módulo | ${NMOD} módulos para ${TOTAL_BLOCKS} bloques | módulo=${b1.length} B`);
const base=rss(); const held=[];
for(let i=0;i<NMOD;i++) held.push(new WebAssembly.Module(makeBatch(i,FN)));
global.gc&&global.gc();
const end=rss();
console.log(`RESULT batch=${FN} modules=${NMOD} RSS_delta=${end-base} MB | overhead/módulo=${(((end-base)*1048576)/NMOD/1024).toFixed(1)} KB | held=${held.length}`);
