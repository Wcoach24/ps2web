# PS2WEB — Plan Maestro de Ingeniería
## Emulador PS2 de excelencia técnica en el navegador (BYOR, zero-install)

**Documento para:** Opus 4.8 ejecutando vía gsd-cowork (discuss → plan → execute → verify)
**Autor del plan:** Ingeniero jefe (sesión de diseño 2026-07-08)
**Modo de uso:** Este documento ES el input de la fase `new-project` de gsd-cowork. Las secciones §5 contienen los seeds de `.gsd/` (ya volcados). Las fases F0–F8 se ejecutan una a una con el ciclo completo discuss→plan→execute→verify. NO ejecutar dos fases en la misma pasada.

---

## 0. Misión
Construir **la mejor experiencia de emulación PS2 en navegador del mundo**: el usuario abre una URL, arrastra SU ISO una única vez, y juega — con JIT real, SIMD, multihilo, render acelerado por GPU y persistencia local. Nada se descarga, nada se instala, ninguna ROM toca nuestro servidor.

**Base tecnológica decidida (LOCKED):** fork de **Play!** (`jpd002/Play-`), el único emulador PS2 con port a navegador funcional (playjs.purei.org) y con BIOS HLE propio (elimina el problema legal del BIOS de raíz). El moonshot PCSX2→wasm queda explícitamente FUERA de alcance.

**Definición de excelencia (métricas objetivo):**
- T1 (must): homebrew suite a 60 FPS estables en desktop medio (Chrome, CPU ≥ 4 cores).
- T2 (must): ≥ 3 juegos comerciales "playable" de Play! a full speed con ISO del propio agente de test NO incluido en el repo.
- T3 (should): render WebGPU con upscaling 2x–4x interno.
- T4 (should): input-to-photon < 50 ms medido con el harness.
- T5 (nice): funciona en Android Chrome con touch overlay.

---

## 1. Decisiones de ingeniería bloqueadas (LOCKED)

| # | Decisión | Rationale | Alternativa rechazada |
|---|----------|-----------|----------------------|
| D1 | Base = fork de Play! upstream `main` | Único PS2 wasm funcional; Jitter con abstracción de backends; BIOS HLE | PCSX2 port completo; escribir emulador desde cero |
| D2 | Toolchain = Emscripten (emsdk latest estable, pinned en `.emsdk-version`) | Toolchain oficial del target js de Play! | wasi-sdk (sin GL/browser glue) |
| D3 | Threads = pthreads emscripten (SharedArrayBuffer + Workers), cross-origin isolation obligatoria | Único mecanismo de threads reales en browser | Single-thread |
| D4 | SIMD = `-msimd128` global + revisión de hot paths VU/MMI | Registros de 128 bits PS2 mapean 1:1 a wasm SIMD | Escalar |
| D5 | Memoria wasm = INITIAL_MEMORY 1 GB, MAXIMUM 2 GB, sin ALLOW_MEMORY_GROWTH con threads | Growth + threads es frágil/lento | Growth dinámico |
| D6 | Render objetivo = WebGPU; fallback = WebGL2 | WebGPU en los 4 navegadores en 2026; compatible con handler Vulkan de Play! | Software renderer |
| D7 | Almacenamiento = OPFS con FileSystemSyncAccessHandle desde worker; formato preferente CHD | Lecturas síncronas tipo mmap, persistente, cero re-upload | IndexedDB |
| D8 | Hosting = Cloudflare Pages o Vercel con COOP `same-origin` + COEP `require-corp` en TODAS las rutas | SharedArrayBuffer lo exige | GitHub Pages (sin headers custom) |
| D9 | Contenido de test en repo = SOLO homebrew OSS y ELFs del ps2sdk. CERO ISOs comerciales, CERO BIOS Sony | Riesgo legal existencial; BIOS HLE lo hace innecesario | Fixtures comerciales |
| D10 | Upstream-friendly: commits limpios potencialmente PR-ables a jpd002/Play- | Rebasable sobre upstream activo; valor reputacional | Fork divergente cerrado |
| D11 | Frontend web = mantener React existente en `js/play_browser` y evolucionarlo | Minimizar blast radius | Reescritura Next/Svelte |
| D12 | Verificación = Playwright headless con servidor COOP/COEP local; frame-hash + FPS en `window.__ps2web_metrics` | "Funciona" no es evidencia; hash de frame sí | Verificación manual |

---

## 2. Stack y toolchain exactos

```
Toolchain
├── emsdk (Emscripten SDK), versión pinneada
├── CMake ≥ 3.22, Ninja
├── Node ≥ 20 (frontend js/play_browser)
├── Playwright (npm) para verificación E2E
└── Python 3 (harness y servidor local con headers)

Flags de build browser (punto de partida, F2 los evoluciona):
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTS=OFF \
  -DBUILD_PLAY=ON -DBUILD_PSFPLAYER=OFF -DUSE_QT=OFF -G Ninja

# Link flags objetivo tras F2:
#   -pthread -sSHARED_MEMORY=1 -sPTHREAD_POOL_SIZE=8
#   -msimd128
#   -sINITIAL_MEMORY=1073741824 -sMAXIMUM_MEMORY=2147483648
#   -sOFFSCREENCANVAS_SUPPORT=1
#   -sUSE_WEBGPU=1 (solo a partir de F4)

Artefactos del build:
  build/Source/ui_js/Play.js        → js/play_browser/src/Play.js
  build/Source/ui_js/Play.wasm      → js/play_browser/public/Play.wasm
  build/Source/ui_js/Play.js        → js/play_browser/public/Play.js
  build/Source/ui_js/Play.worker.js → js/play_browser/public/Play.worker.js

Servidor local (COOP/COEP obligatorio):
  python3 tools/serve.py   # http.server + COOP same-origin + COEP require-corp
```

Repos a clonar:
- `https://github.com/jpd002/Play-.git` (`--recurse-submodules`; incluye Framework, CodeGen/Jitter, libchdr, etc.)
- `https://github.com/copy/v86.git` (SOLO lectura, referencia de codegen-a-wasm en runtime)
- `https://github.com/ps2dev/ps2sdk.git` (samples ELF para fixtures)

---

## 3. Fuentes canónicas (leer antes de la fase que las lista)

| Fuente | URL | Fases |
|--------|-----|-------|
| Play! repo + README (build js emscripten) | github.com/jpd002/Play- | F0–F8 |
| Play!.js demo (referencia de comportamiento) | playjs.purei.org | F1 |
| Compatibility Tracker de Play! | enlazado desde el README | F1, F7 |
| Arquitectura PS2 | copetti.org/writings/consoles/playstation-2/ | F1, F3, F4 |
| ps2tek — HW PS2 (EE, VU, GS, DMAC, timings) | psi-rockin.github.io/ps2tek/ | F3, F4 |
| Emscripten pthreads | emscripten.org/docs/porting/pthreads.html | F2 |
| Emscripten WebGPU | emscripten.org/docs (USE_WEBGPU) + webgpufundamentals.org | F4 |
| COOP/COEP | web.dev/articles/coop-coep + cross-origin-isolation-guide | F2, F8 |
| OPFS + FileSystemSyncAccessHandle | web.dev/articles/origin-private-file-system + MDN | F5 |
| v86: JIT x86→wasm en navegador | github.com/copy/v86 | F3 |
| WASM SIMD | v8.dev/features/simd + MDN | F2, F3 |
| Gamepad API | MDN Gamepad API | F6 |
| PCSX2 blog (VU timing, GS) | pcsx2.net/blog | F3, F4 |
| Playwright docs | playwright.dev | F1, F7 |

Regla: si una URL cambió/cayó, buscar equivalente y anotar la sustitución en STATE.md. No inventar APIs: verificar contra doc actual de Emscripten/MDN.

---

## 4. Arquitectura del sistema

```
NAVEGADOR (origen cross-origin-isolated)
├── Main thread: UI React (librería, settings, overlay) + <canvas> (OffscreenCanvas → worker)
├── Worker EE (Play.wasm): Intérprete/JIT EE (R5900 + MMI 128-bit → wasm SIMD),
│     VU0 macro (COP2), IOP (R3000) + SPU2 → AudioWorklet, Scheduler/DMAC/timers
├── Worker(s) pthread pool (VU1 micro, GS si se separa)
├── GS renderer: WebGPU (F4) / WebGL2 (fallback)
├── OPFS: /games/*.chd|iso, /memcards/*.ps2, /states/*  (acceso síncrono SOLO desde worker)
└── window.__ps2web_metrics = { fps, emuSpeedPct, frameHash, msPerFrame }
```

Subsistemas PS2 en Play! (verificar en F1):
- **EE (R5900)**: `Source/ee/` — intérprete + recompilador vía Jitter.
- **VU0/VU1**: `Source/ee/` (COP2 / VuExecutor) — hotspot #1.
- **GS**: `Source/gs/` — handlers `GSH_OpenGL`, `GSH_Vulkan`, y el del port js.
- **IOP/SPU2**: `Source/iop/`.
- **Jitter/CodeGen**: submódulo jpd002 con backends por arquitectura. **Pregunta clave F1: ¿el build emscripten usa intérprete puro o codegen-a-wasm?** Todo F3 pivota sobre esa respuesta.

---

## 6. Fases en detalle (briefs para el ejecutor)

### F0 — Toolchain y build reproducible
**Objetivo:** compilar el target js de Play! reproducible y arrancar un ELF homebrew en local.
**Waves:** W1) instalar emsdk (pin `.emsdk-version`), clonar Play! con submódulos, crear `tools/build.sh` y `tools/serve.py` (http.server + COOP/COEP), crear `LEGAL.md` (D9) y `BUILDING.md`. W2) compilar ELF ps2sdk (o homebrew OSS con licencia), arrancarlo local, screenshot Playwright.
**Verify:** `bash tools/build.sh` exit 0; `Play.wasm` existe; `npx playwright test tests/smoke.spec.ts`; existen `LEGAL.md`, `BUILDING.md`, `.emsdk-version`.
**Presupuesto:** 20 it / 6 h. **Riesgo:** build js roto en HEAD → bisectar al último commit verde del workflow Actions y pinnear en `UPSTREAM.lock`.

### F1 — Auditoría de arquitectura + harness + baseline
**Objetivo:** saber EXACTAMENTE qué tenemos antes de tocar nada. Produce conocimiento, no features.
**Waves:** W1 Auditoría JIT (JIT-01): leer Jitter/CodeGen, responder con evidencia (backends, intérprete vs codegen-wasm, dispatch, hot paths) → `docs/AUDIT-JIT.md`. W2 métricas (OBS-01): exponer `window.__ps2web_metrics`. W3 harness (OBS-02) + fixtures (TST-01): `tests/harness/run.ts` Playwright, JSON a `bench/results/`. W4 baseline (OBS-03): `docs/BASELINE.md` INMUTABLE.
**Verify:** `AUDIT-JIT.md` contiene "Backend en build emscripten:" + "interprete"|"codegen-wasm"; `node tests/harness/run.js --all`; `bench/results/baseline.json`, `docs/BASELINE.md`; cada fixture con `LICENSE*` adyacente.
**Presupuesto:** 25 it / 8 h. **Riesgo:** frameHash no determinista → fijar seed/timers en modo harness.

### F2 — Threads + SIMD + memoria
**Waves:** W1 `-pthread -sSHARED_MEMORY=1 -sPTHREAD_POOL_SIZE=8` + memoria fija (D5), resolver link/runtime (OffscreenCanvas). W2 `-msimd128` global, frame-hash idéntico al escalar. W3 GitHub Actions `build.yml`.
**Verify:** build.sh con nuevos flags exit 0; `f2.json` con `threadsOk:true`; `compare_hashes.js` exit 0; CI verde.
**Presupuesto:** 25 it / 8 h. **Fallback:** si OffscreenCanvas rompe render, proxied al main thread en F2, migrar en F4.

### F3 — JIT-a-wasm (LA fase crítica)
**Objetivo:** velocidad. Ruta EE→wasm activa y rápida.
**Bifurcación según AUDIT-JIT.md:** Rama A (ya hay codegen-wasm) → optimizar (batching JIT-04, cache con invalidación, SIMD MMI/VU JIT-03). Rama B (intérprete) → implementar backend wasm del Jitter siguiendo abstracción x86/AArch64. Orden incremental OBLIGATORIO: (1) ops enteras EE con fallback intérprete; (2) loads/stores contra memoria compartida; (3) branches y bloques enlazados; (4) FPU con clamping de Play!; (5) MMI/VU con SIMD. Harness completo tras cada sub-hito: corrección (frame-hash) innegociable, velocidad después.
**Técnica (v86):** acumular bloques, compilar por lotes en un `WebAssembly.instantiate` (worker aparte), importar `WebAssembly.Memory` compartida, dispatch por `WebAssembly.Table`. Medir coste de instanciación.
**Waves:** 1) `docs/JIT-DESIGN.md` (checkpoint decision si rama B); 2) implementación incremental; 3) SIMD hot paths; 4) benchmark vs BASELINE.
**Verify:** harness sin regresión de hashes; `assert_speedup.js baseline.json f3.json --min 2.0` exit 0; `docs/JIT-DESIGN.md` existe.
**Presupuesto:** 60 it / 20 h en varias misiones. **Fallbacks:** (a) JIT solo bloques enteros EE + intérprete resto; (b) intérprete optimizado (threaded dispatch, SIMD MMI/VU) documentando JIT-02 en 1.3–1.5x. NUNCA sacrificar corrección por velocidad.

### F4 — Render WebGPU
**Waves:** W1 `docs/GS-NOTES.md` (cómo el handler traduce primitivas GS: contextos, TEX0, alpha blending, CLUT, framebuffer feedback). W2 esqueleto `GSH_WebGPU` con `-sUSE_WEBGPU=1`. W3 paridad feature-a-feature con `compare_frames.js --perceptual`. W4 upscaling 2x (GFX-03) + selección runtime (GFX-04) + OffscreenCanvas (GFX-01).
**Verify:** harness `?renderer=webgpu` en fixtures; `compare_frames.js` WebGPU vs WebGL2; settings con selector "renderer".
**Presupuesto:** 50 it / 16 h. **Fallback:** WebGPU Chrome/Edge-only si Firefox/Safari fallan; WebGL2 default universal.

### F5 — OPFS e I/O
**Waves:** W1 `DiskStore`: drag&drop → OPFS `/games/` (streaming), listado/borrado. W2 lectura vía `FileSystemSyncAccessHandle` en worker; verificar CHD (IO-05). W3 memcards OPFS `/memcards/` (IO-03); save states `/states/` con export/import (IO-04).
**Verify (Playwright E2E):** importar fixture → `page.reload()` → sigue listado → bootea → `emuSpeedPct>0`; memcard persiste tras reload.
**Presupuesto:** 25 it / 8 h. **Riesgo:** `QuotaExceededError` con UX clara.

### F6 — UX de producto
**Waves:** 1) librería (UX-01: grid, título por fichero, último jugado en localStorage). 2) Gamepad API mapeo DS2 + remapeo + teclado fallback (UX-02/03). 3) touch overlay móvil (UX-04) y PWA (UX-05: el SW debe inyectar COEP en respuestas cacheadas o rompe SAB offline; si complica, posponer).
**Verify:** Playwright E2E con gamepad sintético; screenshot-diff de librería; axe-core sin errores críticos.
**Presupuesto:** 25 it / 8 h.

### F7 — Compatibilidad y hardening
**Waves:** 1) CI regresión frame-hash por fixture (TST-02). 2) matriz navegadores Playwright (chromium/firefox/webkit) → `docs/COMPAT.md` (TST-03). 3) fuzzing ligero de ficheros corruptos/truncados (no colgar pestaña). 4) presupuesto memoria: soak 30 min sin OOM.
**Verify:** CI verde; `docs/COMPAT.md` con 3 engines; soak test exit 0.
**Presupuesto:** 30 it / 10 h.

### F8 — Ship
**Waves:** 1) deploy Cloudflare Pages (`_headers` COOP/COEP en `/*`) o Vercel (`vercel.json`) — verificar `crossOriginIsolated===true` en prod con Playwright. 2) landing: hero "Tu PS2, en tu navegador. Tus juegos nunca salen de tu equipo", onboarding drag&drop, FAQ. 3) `/legal`: solo backups propios, nada se sube, sin enlaces a ROMs (SHP-03). 4) auditoría Playwright 1280×720 y ~390px.
**Verify:** `http_status` 200 URL pública; `crossOriginIsolated===true` + smoke fixture bootea; landing enlaza a /legal; Lighthouse ≥ 90.
**Presupuesto:** 15 it / 5 h.

---

## 7. Reglas operativas para el ejecutor
1. **Una fase por misión.** Al terminar, actualizar STATE.md y parar.
2. **Corrección antes que velocidad.** El frame-hash es la verdad.
3. **Evidencia antes que afirmación.** Prohibido "funciona" sin salida de harness/Playwright.
4. **No inventar APIs.** Verificar cada flag/API contra doc actual; si contradice el plan, gana la doc (anotar en STATE.md).
5. **Upstream-first.** Comprobar si upstream ya lo tiene antes de reimplementar.
6. **Git:** rama por fase (`feat/f3-jit-wasm`), commits atómicos, jamás force-push, PRs contra `main` del fork.
7. **Legal es bloqueante:** si algo requiere ISO comercial/BIOS en repo/CI, rediseñar con homebrew. Tests comerciales (T2) los hace el humano en local.
8. **Presupuestos:** agotado sin DoD verde → aplicar fallback declarado, documentar, cerrar misión con estado honesto. Nunca degradar el DoD en silencio.
9. **Checkpoints humanos** (`type="decision"`): fin de F1 (rama de F3), diseño F3 rama B, elección de hosting en F8.

## 8. Protocolo legal de testing
- Repo/CI: solo ELFs homebrew con licencia libre archivada junto al binario (ps2sdk, homebrew OSS — verificar cada fixture).
- BIOS: nunca. El HLE BIOS de Play! es la solución técnica y legal.
- Juegos comerciales: solo el humano, en local, con sus backups, fuera del repo. Resultados a COMPAT.md.
- Web pública: disclaimers SHP-03; cero enlaces a ROMs; mensaje = preservación + BYOR.

## 9. Registro de riesgos global
| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|------------|
| Build js upstream roto en HEAD | Media | Bloquea F0 | Pinnear commit verde (UPSTREAM.lock) |
| Jitter no abstrae para backend wasm (F3 rama B) | Media | F3 se alarga | Fallbacks escalonados; intérprete optimizado como suelo |
| Coste WebAssembly.instantiate mata el JIT | Media | Speedup < objetivo | Batching agresivo + compilación en worker (patrón v86) |
| Semántica FP PS2 (no-NaN/Inf, RZ) diverge en wasm | Media | Bugs visuales | Portar clamping de Play! tal cual; tests frame-hash |
| WebGPU inconsistente entre navegadores | Alta | GFX-02 parcial | WebGL2 default; WebGPU opt-in |
| Safari: threads/OPFS limitados | Alta | T5/compat | Safari = best-effort en COMPAT.md |
| Compat limitada por HLE BIOS (~60% techo Play!) | Alta | Expectativas | Comunicar honestamente; contribuir fixes upstream |
| Deriva hacia moonshot PCSX2 | Media | Muerte del proyecto | D1 LOCKED; propuestas PCSX2 → backlog post-v1 |

## 10. Orden de ejecución
```
F0 → F1 → F2 → { F3 ∥ F4 } → F5 → F6 → F7 → F8
```
F3 y F4 paralelizables (ee/Jitter vs gs/frontend). F5 puede adelantarse tras F2. Camino crítico: F3.
