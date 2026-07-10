import fs from 'fs';
import wabtInit from 'wabt';

const wabt = await wabtInit();

// 1) Ensamblar el .wat -> .wasm (valida que el binario del loop es correcto)
const wat = fs.readFileSync('loop.wat', 'utf8');
let wasmBytes;
try {
  const mod = wabt.parseWat('loop.wat', wat, { mutable_globals: true, bulk_memory: true, reference_types: true });
  const { buffer } = mod.toBinary({});
  wasmBytes = Buffer.from(buffer);
  fs.writeFileSync('loop.wasm', wasmBytes);
  console.log('ASSEMBLE: OK  (' + wasmBytes.length + ' bytes)');
} catch (e) {
  console.log('ASSEMBLE: FAIL -> ' + e.message);
  process.exit(1);
}

// 2) Simular el entorno emscripten real:
//    - wasmMemory compartida
//    - __indirect_function_table (wasmTable) donde "addFunction" registra bloques
const memory = new WebAssembly.Memory({ initial: 1 });
const table  = new WebAssembly.Table({ initial: 8, element: 'anyfunc' });
const mem32 = new Int32Array(memory.buffer);

// Bloques "compilados" (dummy). Firma void(i32 ctx). Cada uno avanza el PC del programa
// y decrementa nada (el loop maneja la quota). Simulan el efecto de un bloque MIPS.
function makeBlock(nextPc, mark) {
  return () => { mem32[0] = nextPc; mem32[64] = (mem32[64]|0) + mark; }; // mem[256 bytes]=trace
}
// Registrar bloques en la tabla como haría addFunction(fct,'vi') de emscripten:
async function addFunction(fn) {
  // Emular convertJsFunctionToWasm: envolver JS fn en un wasm import re-exportado.
  const w = (await WebAssembly.instantiate(
    wabt.parseWat('w', '(module (import "e" "f" (func $f (param i32))) (func (export "g") (param i32) (local.get 0) (call $f)))')
        .toBinary({}).buffer,
    { e: { f: fn } }
  )).instance.exports.g;
  const idx = table.length; table.grow(1); table.set(idx, w);
  return idx;
}

const idBlockA = await addFunction(makeBlock(0x2000, 1)); // en PC 0x1000 -> salta a 0x2000
const idBlockB = await addFunction(makeBlock(0x1000, 10)); // en PC 0x2000 -> vuelve a 0x1000

// 3) Cargar el mapa PC->fctId en memoria lineal (mapBase=4096 -> Int32 index 1024)
mem32[1024] = 0x1000; mem32[1025] = idBlockA;
mem32[1026] = 0x2000; mem32[1027] = idBlockB;
mem32[1028] = 0; // terminador

// 4) Estado inicial: PC=0x1000, sin excepcion, quota=5 -> el loop debe hacer 5 dispatches
//    entre A<->B SIN volver a JS, luego salir por quota.
mem32[0] = 0x1000; // nPC
mem32[1] = 0;      // nHasException (offset 4)
mem32[2] = 5;      // cycleQuota (offset 8)

const { instance } = await WebAssembly.instantiate(wasmBytes, {
  env: { memory, __indirect_function_table: table }
});

console.log('INSTANTIATE: OK (import __indirect_function_table + memory aceptado)');
instance.exports.codeGenFunc(0 /*ctx ptr dummy*/);

const dispatches = mem32[64]; // suma de marks
console.log('POST-RUN nHasException=' + mem32[1] + ' quota=' + mem32[2] + ' trace=' + dispatches);
// 5 dispatches empezando en A: A(1)B(10)A(1)B(10)A(1)=23 ; quota 5->0
console.log('RESULT: ' + ((mem32[2] === 0 && dispatches === 23) ? 'PASS (loop residente despacho 5 bloques via call_indirect sin volver a JS)' : 'CHECK trace'));
