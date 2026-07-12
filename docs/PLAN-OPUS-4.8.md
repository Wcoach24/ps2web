# PS2WEB — BRIEF DE EJECUCIÓN PARA OPUS 4.8 (2026-07-10)

Eres el agente ejecutor de este plan. Lee PRIMERO y ENTERO: `docs/HANDOFF.md` (estado real,
gotchas), luego este documento. No empieces a tocar código antes de leer ambos.

## Misión

Superar a https://playjs.purei.org (mismo core, Play!) en tres frentes medibles, en este orden:

1. **Producto**: librería de juegos verificados + persistencia visible (purei.org no tiene ninguna).
2. **Compatibilidad navegador**: batching JIT (N bloques → 1 módulo wasm) para rescatar juegos
   grandes que en purei.org mueren por code-space OOM.
3. **Velocidad**: spike GO/NO-GO de 1 día del dispatch loop residente en wasm (2c). Solo
   implementar si el spike da GO.

**NO es objetivo:** arreglar bugs de emulación por-juego del core (se reportan upstream);
WebGPU (solo si aparece evidencia de cuello en GS); reescribir el backend de codegen.

## Contexto mínimo (detalle en HANDOFF.md)

- Repo overlay: `github.com/Wcoach24/ps2web`. El CI clona `jpd002/Play-` @ `UPSTREAM.lock`,
  aplica `patches/01..07`, copia `overlay/` sobre `js/play_browser/src/`, compila (emsdk 4.0.1,
  preset wasm-ninja) y despliega a Vercel (https://dist-ivory-phi-37.vercel.app).
- Deploy automático en cada push a `main`. Ciclo de iteración ≈ 30 min.
- Datos nuevos de esta sesión: `bench/compat.json` (1.302 juegos state-playable del tracker
  oficial), `tools/fetch_compat.py`, `docs/COMPAT-BROWSER.md` (shortlist + protocolo + sniffer),
  `docs/PLAN-RESCATE.md` (plan estratégico).
- Diagnóstico clave: Samurai Jack: The Shadow of Aku NO existe en el tracker de Play! →
  cuelgue = soporte desconocido upstream, no regresión nuestra.

## Reglas de entorno (obligatorias, HANDOFF §7)

- Build SOLO en CI. El sandbox no compila (sin toolchain, 3.8 GB RAM).
- git no opera sobre la carpeta montada: clonar en `/tmp`, pushear con el PAT que da Alvaro en
  sesión (no guardarlo en disco ni memoria), espejar a la carpeta montada con `cp`.
- El PAT solo pushea a repos existentes de Wcoach24; no puede crear/forkear repos.
- Verificar cada run de CI por API antes de declarar nada verde.
- Ficheros de Play! con CRLF (p.ej. `Source/BasicBlock.h`): editar en binario; verificar con
  `git diff --numstat` que el diff es mínimo.
- Nunca `git add -A` tras renombrar patches; usar `git rm`.

## Gates transversales (sin excepciones)

- **Corrección**: `bench/results/cube-golden.json` (stateHashAtN=3049433245) intacto en el
  harness tras CUALQUIER cambio del lado JIT/C++.
- **Rendimiento**: solo se declara mejora con `tools/assert_speedup.js` (mediana ≥3 runs).
- **Realidad**: toda fase cierra con validación de ≥1 juego comercial real (lección D5:
  homebrew diminuto no valida nada).

---

## SPRINT 1 — Producto: librería + persistencia visible (riesgo bajo)

Estado de partida: persistencia OPFS YA funciona (`ps2web_diskstore.ts`, F5 W1) pero solo por
consola (`window.__ps2web.diskStore`). La UI es la de upstream: un botón de cargar archivo.

Tareas:
1. **Vista librería** en el frontend CRA (`overlay/js/play_browser/src/`):
   - Grid/lista de discos importados en OPFS: nombre, tamaño, botones Jugar / Borrar.
   - Importar ISO → se persiste en OPFS → aparece en la librería → reload → sigue ahí → bootea.
   - Buscador sobre `bench/compat.json` (servirlo como asset estático): al importar un ISO,
     intentar matchear por serial/nombre y mostrar badge de estado del tracker.
   - Badge "✔ verificado en navegador" desde `bench/verified.json` (nuevo; lo alimenta Alvaro
     con el protocolo de `docs/COMPAT-BROWSER.md`).
2. **E2E**: extender `tests/e2e/opfs.spec.js` para cubrir el flujo por UI (import→reload→boot).
3. No tocar nada del lado C++ en este sprint.

DoD (verificable):
- [ ] Deploy público donde import→reload→librería→boot funciona por UI (vídeo o e2e verde en CI).
- [ ] Búsqueda sobre los 1.302 juegos funcionando en la página.
- [ ] e2e OPFS por UI verde en CI.

## SPRINT 2 — Batching JIT-04: N bloques → 1 módulo wasm (riesgo medio)

Problema: hoy cada bloque MIPS = `new WebAssembly.Module` + `Instance` propio (decenas de miles
por juego grande) → `failed to allocate executable memory` (code-space del navegador agotado).
purei.org tiene el mismo bug. Arreglarlo = juegos que allí mueren, aquí funcionan.

Dónde mirar: `Source/MemoryFunction.cpp` (glue de instanciación wasm), `Source/BasicBlock.*`,
`deps/CodeGen/src/Jitter_CodeGen_Wasm*.cpp`, `docs/AUDIT-JIT.md`, `docs/JIT-DESIGN.md`
(JIT-04/Palanca 1). Los patches 06/07 (mapa PC→índice per-executor) son base reutilizable.

Enfoque sugerido (validar contra el código real antes de comprometerse):
1. Instrumentar primero: añadir `modulesCreated` y `blocksCompiled` a `__ps2web_metrics`
   (patch nuevo). Medir en cube, vu1 y un juego real → baseline de módulos.
2. Buffer de bloques pendientes: compilar en lotes de N (empezar N=32) emitiendo un módulo
   multi-función; registrar cada función en la tabla indirecta (`addFunction` ya existe).
3. Cuidado con: invalidación/reciclaje de bloques (SMC) — un bloque invalidado dentro de un
   módulo batch no puede liberar el módulo entero (aceptar leak lógico acotado o refcount);
   latencia de compilación del primer uso (batch = compilar bloques aún no calientes: medir
   impacto en warmup).
4. Si el batching exige tocar el layout de `CWasmFunctionBuilder`, parar y documentar coste
   antes de seguir.

DoD (verificable):
- [ ] cube golden intacto + `assert_speedup` sin regresión (±5%).
- [ ] `modulesCreated` cae ≥10x en un juego real.
- [ ] ≥1 juego de la Tanda 2 (`docs/COMPAT-BROWSER.md`) que antes moría por clase A ahora
      bootea y juega ≥5 min. Ese juego, contrastado en purei.org (donde sigue muriendo), es EL
      titular del proyecto.

## SPIKE 2c — GO/NO-GO velocidad (1 día máximo, paralelizable con Sprint 1)

Pregunta única: ¿puede `CWasmModuleBuilder` (deps/CodeGen) emitir un módulo con
`loop` + `br_if` + `call_indirect` que IMPORTE `__indirect_function_table` (la `wasmTable` de
emscripten, tabla 0) y `wasmMemory`? Hoy el glue (`MemoryFunction.cpp`) importa OTRA tabla
(`codeGenImportTable`) — esa es la incógnita.

Método: leer `WasmModuleBuilder.cpp` + `Jitter_CodeGen_Wasm.cpp`; si el builder no lo soporta,
estimar el coste de extenderlo; prototipo mínimo a mano (módulo wat→wasm hardcodeado
instanciado desde JS contra la tabla real) para validar la instanciación aunque el builder no
llegue.

Salida OBLIGATORIA: `docs/SPIKE-2C.md` con veredicto GO / NO-GO / GO-con-coste-X, evidencia
(código del prototipo, errores exactos), y si GO: plan de implementación citando
`docs/JIT-DESIGN.md` §2c y las 4 incógnitas de `docs/HANDOFF.md` §3. NO empezar la
implementación completa dentro del spike.

---

## Orden de ejecución y presupuesto

1. Spike 2c (día 1, mientras CI del Sprint 1 itera).
2. Sprint 1 completo (2–4 días de calendario, iteraciones de CI de 30 min).
3. Sprint 2 (1–2 semanas). Checkpoint con Alvaro tras la instrumentación (paso 1) con el
   baseline de módulos antes de escribir el batching.
4. Si spike = GO y Sprint 2 cerrado: proponer plan 2c a Alvaro, no ejecutarlo sin su OK.

## Dependencias de Alvaro (pedir cuando toque, no antes)

- PAT de push al inicio de cada bloque de trabajo (no persistirlo).
- Pruebas manuales con sus dumps: Tanda 1 para `verified.json` (Sprint 1), Tanda 2 para el
  titular de batching (Sprint 2).
- Decisión GO tras el spike 2c.

## Definición de éxito global

- purei.org: carga un archivo y reza. ps2web: librería con 1.302 juegos catalogados + verificados
  con badge, partidas persistentes, y ≥1 juego grande demostrado funcionando aquí y muriendo allí.
- Todo speedup/mejora declarada tiene gate automático que lo respalda. Nada se afirma sin CI verde.
