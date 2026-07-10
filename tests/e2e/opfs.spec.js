// F5 W1 (IO-01): OPFS game library — import once, reload, still there, boots from OPFS.
const path = require('path');
const { test, expect } = require('@playwright/test');

const FIXTURE = path.resolve(__dirname, '../../dist/fixtures/cube.elf');

// Original API-level test: the diskStore contract survives reloads and boots from OPFS.
test('OPFS persistence (API): import -> reload -> persists -> boots', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps2web && window.__ps2web.ready && window.__ps2web.diskStore, null, { timeout: 60000 });

  const saved = await page.evaluate(() => window.__ps2web.importAndSave('/fixtures/cube.elf'));
  expect(saved.size, 'imported bytes').toBeGreaterThan(0);

  let list = await page.evaluate(() => window.__ps2web.diskStore.list());
  expect(list, 'listed after import').toContain('cube.elf');

  // reload → persistence across sessions is the whole point of OPFS
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps2web && window.__ps2web.ready && window.__ps2web.diskStore, null, { timeout: 60000 });
  list = await page.evaluate(() => window.__ps2web.diskStore.list());
  expect(list, 'game persists across reload (OPFS)').toContain('cube.elf');

  const booted = await page.evaluate(() => window.__ps2web.bootElfFromOpfs('cube.elf'));
  expect(booted.size).toBeGreaterThan(0);
  await page.waitForTimeout(8000);
  const m = await page.evaluate(() => window.__ps2web_metrics);
  console.log(`[opfs api] persisted + booted from OPFS, fps=${m.fps}`);
  expect(m.fps, 'boots from OPFS and runs').toBeGreaterThan(0);

  await page.evaluate(() => window.__ps2web.diskStore.remove('cube.elf').catch(() => {}));
});

// Sprint 1: the SAME flow driven entirely through the library UI (no window.__ps2web calls
// for the import/persist/boot steps). This is what a real user does and what purei.org can't do.
test('OPFS library (UI): import via picker -> card -> reload -> card persists -> Play -> runs', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps2web && window.__ps2web.ready, null, { timeout: 60000 });

  // clean any leftover so the assertion is meaningful
  await page.evaluate(() => window.__ps2web.diskStore.remove('cube.elf').catch(() => {}));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps2web && window.__ps2web.ready, null, { timeout: 60000 });

  // 1) import through the real file input (hidden, inside the "+ Importar" label)
  await page.setInputFiles('[data-testid="ps2-import"]', FIXTURE);

  // 2) the game card appears in the library (import persisted it to OPFS + refreshed the grid)
  const card = page.locator('[data-game="cube.elf"]');
  await expect(card, 'card appears after UI import').toBeVisible({ timeout: 20000 });

  // 3) reload -> the card is still there, sourced from OPFS (persistence, by UI)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ps2web && window.__ps2web.ready, null, { timeout: 60000 });
  const cardAfter = page.locator('[data-game="cube.elf"]');
  await expect(cardAfter, 'card persists across reload (OPFS, by UI)').toBeVisible({ timeout: 20000 });

  // 4) click Play on the card -> emulator boots from OPFS
  await cardAfter.getByRole('button', { name: /Jugar/ }).click();
  await page.waitForTimeout(8000);
  const m = await page.evaluate(() => window.__ps2web_metrics);
  console.log(`[opfs ui] booted via library UI, fps=${m.fps}`);
  expect(m.fps, 'boots from OPFS via UI and runs').toBeGreaterThan(0);

  // 5) the search box is wired against the 1302-game catalog served as a static asset
  const total = await page.evaluate(async () => {
    const r = await fetch('compat.json').then(x => x.json()).catch(() => null);
    return r ? (r.count || (r.games ? r.games.length : 0)) : 0;
  });
  expect(total, 'catalog served as static asset').toBeGreaterThan(1000);

  await page.evaluate(() => window.__ps2web.diskStore.remove('cube.elf').catch(() => {}));
});
