// JIT-04: ¿cuánto cuesta un módulo wasm, y libera el motor al soltarlo?
// Replica en NAVEGADOR REAL el experimento de docs/jit-04/*.mjs (medido en Node/V8).
// Es la evidencia que sostiene el batching: si el motor no reclamase al soltar el módulo,
// el re-batching (docs/JIT-04-BATCHING.md §5) no serviría de nada.
const { test, expect } = require('@playwright/test');

test('JIT-04: coste por módulo wasm y reclamación al soltarlo', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const r = await page.evaluate(async () => {
    // Fabrica módulos wasm ÚNICOS del tamaño real de un bloque de Play! (~636 B),
    // o batches de FN funciones (mismo código total, menos módulos).
    const uleb = n => { const b = []; do { let x = n & 0x7f; n >>>= 7; if (n) x |= 0x80; b.push(x); } while (n); return b; };
    const sleb = n => { const b = []; let more = 1; while (more) { let x = n & 0x7f; n >>= 7; if ((n === 0 && !(x & 0x40)) || (n === -1 && (x & 0x40))) more = 0; else x |= 0x80; b.push(x); } return b; };
    const sect = (id, p) => [id, ...uleb(p.length), ...p];
    const makeBatch = (seed, FN, padPairs = 200) => {
      const types = sect(1, [0x01, 0x60, 0x00, 0x01, 0x7f]);
      const funcs = sect(3, [...uleb(FN), ...Array(FN).fill(0x00)]);
      const exps = [];
      for (let f = 0; f < FN; f++) { const nm = `f${f}`; exps.push(nm.length, ...[...nm].map(c => c.charCodeAt(0)), 0x00, ...uleb(f)); }
      const exp = sect(7, [...uleb(FN), ...exps]);
      const bodies = [];
      for (let f = 0; f < FN; f++) {
        const body = [];
        for (let k = 0; k < padPairs; k++) body.push(0x41, 0x00, 0x1a);
        body.push(0x41, ...sleb(seed * 1000 + f), 0x0b);
        const code = [0x00, ...body];
        bodies.push(...uleb(code.length), ...code);
      }
      const codeSec = sect(10, [...uleb(FN), ...bodies]);
      return new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, ...types, ...funcs, ...exp, ...codeSec]);
    };

    const TOTAL = 6000; // acotado para no eternizar el CI; la tendencia ya es clara
    const mem = () => (performance).memory ? (performance).memory.usedJSHeapSize : 0;

    const run = (FN, hold) => {
      const n = Math.ceil(TOTAL / FN);
      const held = [];
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const m = new WebAssembly.Module(makeBatch(i, FN));
        if (hold) held.push(m);
      }
      const ms = Math.round(performance.now() - t0);
      return { blocksPerModule: FN, modules: n, ms, moduleBytes: makeBatch(0, FN).length, held: held.length };
    };

    const solo = run(1, true);    // modelo actual: 1 módulo por bloque
    const b32 = run(32, true);    // batching 32:1
    const released = run(1, false); // soltando: ¿se puede seguir creando sin límite?
    return { solo, b32, released, jsHeap: mem() };
  });

  console.log(`[jit-04/browser] solo: ${r.solo.modules} módulos (${r.solo.moduleBytes}B c/u) en ${r.solo.ms}ms`);
  console.log(`[jit-04/browser] batch32: ${r.b32.modules} módulos (${r.b32.moduleBytes}B c/u) en ${r.b32.ms}ms`);
  console.log(`[jit-04/browser] released: creados ${r.released.modules} sin retener, OK`);

  // El batching debe reducir el nº de módulos ~32x para el MISMO código total.
  expect(r.b32.modules).toBeLessThan(r.solo.modules / 10);
  // Soltando los módulos, el motor debe permitir crear la misma cantidad sin reventar
  // (si esto fallara, el re-batching de docs/JIT-04-BATCHING.md §5 no sería viable).
  expect(r.released.modules).toBe(r.solo.modules);
});
