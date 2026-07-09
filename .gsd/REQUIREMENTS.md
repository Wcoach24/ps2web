# Requirements

## BLD: Build & toolchain
- BLD-01: Build wasm reproducible con script único `tools/build.sh` | must
- BLD-02: emsdk pinneado en `.emsdk-version`, documentado en BUILDING.md | must
- BLD-03: CI (GitHub Actions) que compila y publica artefactos por commit | should

## OBS: Observabilidad y harness
- OBS-01: Contrato `window.__ps2web_metrics` (fps, emuSpeedPct, frameHash, msPerFrame) | must
- OBS-02: Harness Playwright: arranca servidor COOP/COEP, carga ELF fixture, captura métricas 30 s, emite JSON | must
- OBS-03: Baseline benchmark documentado ANTES de optimizar (BASELINE.md) | must

## THR: Threads y SIMD
- THR-01: Build con -pthread + SharedArrayBuffer funcional (test: pthread_create OK en browser) | must
- THR-02: Build con -msimd128 sin regresiones (frame-hash idéntico al build escalar en fixtures) | must
- THR-03: VU1/GS fuera del hilo del EE donde la arquitectura de Play! lo permita | should

## JIT: Recompilación
- JIT-01: Informe AUDIT-JIT.md: qué ejecuta hoy el build emscripten (intérprete vs codegen), con evidencia (perfilado + lectura de código del Jitter) | must
- JIT-02: Ruta de codegen-a-wasm activa para el EE (existente optimizada o backend nuevo), con speedup ≥ 2x vs baseline en fixture CPU-bound | must
- JIT-03: Codegen SIMD para ops MMI/VU de 128 bits en hot paths identificados por perfil | should
- JIT-04: JIT cache con batching de módulos (amortizar WebAssembly.instantiate) | should

## GFX: Render
- GFX-01: Render desde worker con OffscreenCanvas | must
- GFX-02: Handler GS sobre WebGPU con paridad visual (frame-hash tolerante) vs WebGL2 en fixtures | should
- GFX-03: Upscaling interno 2x configurable | should
- GFX-04: Fallback automático WebGL2 si WebGPU no disponible | must

## IO: Almacenamiento y datos
- IO-01: Importar ISO/CHD por drag&drop a OPFS; persiste entre sesiones | must
- IO-02: Lecturas de disco vía FileSystemSyncAccessHandle desde worker | must
- IO-03: Memory cards virtuales persistentes en OPFS | must
- IO-04: Save states a OPFS con export/import a fichero | should
- IO-05: Soporte CHD (libchdr) verificado en build wasm | must

## UX: Producto
- UX-01: Librería de juegos con carátula-placeholder, título y último jugado | must
- UX-02: Gamepad API con mapeo DualShock2 + remapeo | must
- UX-03: Teclado como fallback siempre activo | must
- UX-04: Touch overlay para móvil | nice
- UX-05: PWA instalable (manifest + service worker que respeta COEP) | nice

## TST: Testing y compatibilidad
- TST-01: Suite de fixtures homebrew en repo (ps2sdk samples + homebrew OSS) con licencias verificadas | must
- TST-02: Regresión frame-hash en CI para cada fixture | must
- TST-03: COMPAT.md con matriz de resultados por fixture y navegador (Chrome, Firefox, Safari, Edge) | should

## SHP: Ship
- SHP-01: Deploy público con COOP/COEP verificado (crossOriginIsolated === true) | must
- SHP-02: Landing con onboarding "arrastra tu juego" + disclaimer legal | must
- SHP-03: Página /legal: solo tus propios backups; nada se sube a servidor | must

## LEG: Legal (transversal, bloqueante)
- LEG-01: Cero ISOs comerciales/BIOS Sony en repo, CI, hosting o docs | must
- LEG-02: LEGAL.md con política de contribución y de fixtures | must
