#!/usr/bin/env node
/*
 * assert_speedup.js — DoD de F3 (JIT-02). Compara dos benches y verifica el speedup.
 * Uso:
 *   node tools/assert_speedup.js <baseline.json...> --vs <candidate.json...> --min 2.0 [--metric avgFps]
 * Cada lado acepta VARIOS ficheros (runs) y usa la MEDIANA para batir el ruido del runner (±10%).
 * Sale 0 si  median(candidate)/median(baseline) >= min  ; 1 si no; 2 si error de uso/datos.
 */
const fs = require('fs');

function parseArgs(argv) {
  const base = [], cand = []; let min = 2.0, metric = 'avgFps', bucket = base;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vs') bucket = cand;
    else if (a === '--min') min = parseFloat(argv[++i]);
    else if (a === '--metric') metric = argv[++i];
    else bucket.push(a);
  }
  return { base, cand, min, metric };
}
function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function readMetric(file, metric) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const v = d[metric];
  if (typeof v !== 'number') throw new Error(`${file}: metric '${metric}' ausente o no numérica`);
  return v;
}
function checkHash(baseFiles, candFiles) {
  const h = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).frameHash ?? null; } catch { return null; } };
  const bh = baseFiles.map(h).find(x => x != null);
  const ch = candFiles.map(h).find(x => x != null);
  if (bh == null || ch == null) return { ok: true, note: 'sin frameHash comparable' };
  return { ok: bh === ch, note: `baseline=${bh} candidate=${ch}` };
}

const { base, cand, min, metric } = parseArgs(process.argv);
if (!base.length || !cand.length || !(min > 0)) {
  console.error('uso: node tools/assert_speedup.js <baseline...> --vs <candidate...> --min <ratio> [--metric avgFps]');
  process.exit(2);
}
try {
  const bVals = base.map(f => readMetric(f, metric));
  const cVals = cand.map(f => readMetric(f, metric));
  const bMed = median(bVals), cMed = median(cVals);
  const ratio = cMed / bMed;
  const hash = checkHash(base, cand);
  console.log(`[assert_speedup] metric=${metric}`);
  console.log(`  baseline  runs=${bVals.length} median=${bMed.toFixed(2)}  (${bVals.join(', ')})`);
  console.log(`  candidate runs=${cVals.length} median=${cMed.toFixed(2)}  (${cVals.join(', ')})`);
  console.log(`  speedup=${ratio.toFixed(3)}x  (objetivo >= ${min}x)`);
  console.log(`  frameHash: ${hash.ok ? 'OK' : 'MISMATCH (posible regresión de corrección!)'} — ${hash.note}`);
  if (!hash.ok) { console.error('FALLO: frameHash cambió; la corrección manda sobre la velocidad.'); process.exit(1); }
  if (ratio + 1e-9 < min) { console.error(`FALLO: speedup ${ratio.toFixed(3)}x < ${min}x`); process.exit(1); }
  console.log('OK'); process.exit(0);
} catch (e) { console.error('ERROR:', e.message); process.exit(2); }
