# Roadmap

## Phase F0: Toolchain y build reproducible — 1 sesión
Requirements: BLD-01, BLD-02, LEG-01, LEG-02
Success: `tools/build.sh` sale 0; Play.wasm generado; ELF homebrew bootea en local; LEGAL.md en repo.
Dependencies: none

## Phase F1: Auditoría + harness + baseline — 1-2 sesiones
Requirements: OBS-01, OBS-02, OBS-03, JIT-01, TST-01
Success: AUDIT-JIT.md y BASELINE.md con números reales; harness emite JSON; fixtures con licencias en tests/fixtures/.
Dependencies: F0

## Phase F2: Threads + SIMD + memoria — 1-2 sesiones
Requirements: THR-01, THR-02, BLD-03
Success: build -pthread -msimd128 arranca fixtures; frame-hash estable; CI verde.
Dependencies: F1

## Phase F3: JIT-a-wasm — 3-6 sesiones (la fase crítica)
Requirements: JIT-02, JIT-03, JIT-04
Success: speedup ≥2x vs BASELINE.md en fixture CPU-bound; sin regresión frame-hash.
Dependencies: F2

## Phase F4: Render WebGPU — 2-4 sesiones
Requirements: GFX-01, GFX-02, GFX-03, GFX-04
Success: fixtures renderizan por WebGPU con paridad visual; fallback WebGL2 automático.
Dependencies: F2 (paralelizable con F3)

## Phase F5: OPFS e I/O — 1-2 sesiones
Requirements: IO-01..IO-05
Success: importar CHD → recargar página → juego sigue en librería y bootea; memcard persiste.
Dependencies: F2

## Phase F6: UX de producto — 1-2 sesiones
Requirements: UX-01..UX-05, THR-03
Success: flujo completo drag&drop→jugar con gamepad; Playwright E2E del flujo pasa.
Dependencies: F5

## Phase F7: Compatibilidad y hardening — 2-3 sesiones
Requirements: TST-02, TST-03
Success: CI con regresión frame-hash; COMPAT.md 4 navegadores.
Dependencies: F3, F4, F6

## Phase F8: Ship — 1 sesión
Requirements: SHP-01..SHP-03
Success: URL pública, crossOriginIsolated true, Lighthouse ≥ 90 en la landing, disclaimer visible.
Dependencies: F7
