// F0 smoke: proves the cloud build produced a deployable, cross-origin-isolated
// site whose Play.wasm is a valid WebAssembly module. (ELF-boot smoke is F1.)
const { test, expect } = require('@playwright/test');

test('F0 smoke: app shell loads, COOP/COEP active, Play.wasm valid', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // COOP/COEP -> cross-origin isolation (required for SharedArrayBuffer/threads)
  const coi = await page.evaluate(() => self.crossOriginIsolated);
  expect(coi, 'crossOriginIsolated must be true').toBe(true);

  // Play.wasm served and is a valid WebAssembly module
  const w = await page.evaluate(async () => {
    const r = await fetch('/Play.wasm');
    if (!r.ok) return { ok: false, status: r.status };
    const buf = await r.arrayBuffer();
    const m = new Uint8Array(buf.slice(0, 4));
    const isWasm = m[0] === 0x00 && m[1] === 0x61 && m[2] === 0x73 && m[3] === 0x6d;
    let valid = false;
    try { valid = WebAssembly.validate(buf); } catch (e) {}
    return { ok: true, size: buf.byteLength, isWasm, valid };
  });
  expect(w.ok, `Play.wasm must return 200 (got ${w.status})`).toBeTruthy();
  expect(w.isWasm, 'Play.wasm must have the \\0asm magic header').toBeTruthy();
  expect(w.valid, 'Play.wasm must validate as WebAssembly').toBeTruthy();
  expect(w.size, 'Play.wasm should be non-trivial in size').toBeGreaterThan(100000);

  // Soft signal: the app shell renders a canvas (Play! draws into <canvas>).
  const canvases = await page.locator('canvas').count();
  console.log(`[smoke] crossOriginIsolated=${coi} wasm=${w.size}B canvases=${canvases}`);

  await page.screenshot({ path: 'test-results/f0-smoke.png', fullPage: true });
});
