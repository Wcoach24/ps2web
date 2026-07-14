# JIT-04 — BATCHING (N bloques → 1 módulo wasm): evidencia y diseño (2026-07-12)

Checkpoint de PLAN-OPUS-4.8 §Sprint 2 / PLAN-RESCATE Fase 2. Este documento cierra el paso 1
(instrumentar + medir) y **activa la regla de parada del paso 4**: el batching exige tocar el
layout del emisor de módulos de `deps/CodeGen`. Coste documentado abajo.

---

## 1. Baseline medido (CI run #42, commit 742d689)

| fixture | modulesCreated | instancesCreated | jitBlocks | **blocksPerModule** | moduleBytes |
|---|---|---|---|---|---|
| cube | 1034 | 1123 | 1034 | **1.00** | 657 703 |
| vu1  | 1099 | 1189 | 1099 | **1.00** | 724 642 |

**`modulesCreated == jitBlocks` exacto.** Confirmado con datos: **1 módulo WebAssembly por cada
bloque MIPS**. Gate de corrección intacto (`cube stateHashAtN = 3049433245 == golden`).

Los ~89 `instancesCreated` extra **no son recompilaciones**: salen de
`CBasicBlock::CopyFunctionFrom` → `CMemoryFunction::CreateInstance()`. Play! cachea bloques por
**hash de código** (`m_cachedBlocks`, EeExecutor.cpp) y, si el mismo código aparece en otro rango
de direcciones, **reutiliza el módulo y solo crea una Instance nueva**.

## 2. El coste real por módulo (medido, no estimado)

`docs/jit-04/codespace.mjs` — módulos wasm únicos del tamaño real de un bloque (636 B), en V8:

| escenario | módulos | RSS | por módulo |
|---|---|---|---|
| **reteniéndolos** (modelo actual) | 20 000 | **+342…369 MB** | **~18,9 KB** |
| soltándolos | 20 000 | +59 MB (se estabiliza) | — |

**Dos conclusiones duras:**

1. **Overhead fijo ≈ 18,9 KB por módulo para 636 B de código útil → 28x de desperdicio.** El coste
   no es el payload, es lo fijo por módulo (páginas ejecutables, metadata, objetos JS). Extrapolado
   a un comercial (~50 000 bloques): **≈ 920 MB solo en overhead de módulos** → eso es el
   `failed to allocate executable memory for module`.
2. **El motor SÍ reclama al soltar el módulo** (RSS plano: ~95–106 MB dé igual 5k/10k/15k). Esta era
   la suposición que podía matar el enfoque. **No lo mata.**

## 3. Cuánto gana el batching (medido)

`docs/jit-04/batchsim.mjs` — mismo código total (20 000 bloques), variando bloques/módulo:

| bloques/módulo | módulos | RSS | vs. hoy |
|---|---|---|---|
| **1 (hoy)** | 20 000 | **369 MB** | — |
| 8 | 2 500 | 104 MB | −72% |
| **32** | 625 | **81 MB** | **−78%** |
| 64 | 313 | 66 MB | −82% |

**N=32 captura casi toda la ganancia** (después, rendimientos decrecientes). Comercial de ~50k
bloques: ~920 MB → **~200 MB**. Esa es la diferencia entre morir y correr.

> Medido en V8 (Node). El motor de Chromium es el mismo; el error que vio Alvaro era de Firefox.
> `tests/e2e/codespace.spec.js` replica el experimento **en el navegador real** dentro del CI.

## 4. Por qué el batching "de libro" NO es implementable

El plan original decía: *"buffer de bloques pendientes: compilar en lotes de N=32"*. **No se puede.**
Play! compila **lazy, en el primer dispatch**: cuando el executor pide un bloque, tiene que ser
ejecutable **ya**. No puedes esperar a llenar un lote de 32 para poder ejecutar el primero.

## 5. El diseño que sí funciona: re-batching en dos tiers

1. **Tier 1 (primer hit):** el bloque se compila **solo**, como hoy → ejecutable al instante,
   semántica intacta.
2. **Tier 2 (cuando se acumulan N):** se emite **un módulo con las N funciones**, se re-apuntan sus
   `fctId` (tabla indirecta + mapa PC→fctId del patch 07) y **se sueltan los N módulos solitarios**
   → el motor libera su code-space (§2, punto 2).

Estado estacionario: `modules ≈ bloques/N` → el ≥10x del DoD.

**Se paga compilar cada bloque dos veces**, y es asumible: BENCH-F3 midió que el JIT-compile **no**
domina (≈0,13 ms/bloque, casi todo en warmup). Vigilancia: `jitCompileMs` ya instrumentado.

### Lo que hace este diseño viable (verificado en el código, no supuesto)

- **En wasm NO hay linking entre bloques.** `CBasicBlock::LinkBlock`/`UnlinkBlock` están compilados
  fuera bajo `__EMSCRIPTEN__` (`#if !defined(AOT_ENABLED) && !defined(__EMSCRIPTEN__)`). No hay
  trampolines que parchear: **la identidad de un bloque es solo su `fctId` + el mapa PC→fctId**, así
  que re-apuntarlo es seguro.
- **Las Instances comparten el código compilado del Module** → el dedup (`CreateInstance`) sigue
  siendo barato con módulos batch, y **el code-space lo gobierna `modulesCreated`** (la métrica que
  sale 1:1). Instanciar un batch para reusar 1 función NO duplica código.

## 6. EL OBSTÁCULO REAL (regla de parada del plan, paso 4)

**Los índices de firma de `call_indirect` son LOCALES a cada módulo.**

`CCodeGen_Wasm::PrepareSignatures` registra la firma del propio bloque (`"vi"`) como **tipo 0** y
luego añade **solo las firmas de las funciones externas que ese bloque llama** (tipos 1, 2, …).
`Emit_Call` emite `call_indirect <sigIdx> <table 0>` con ese índice **relativo a la tabla de tipos
de su módulo**. Si concatenamos cuerpos compilados por separado en un módulo batch, esos `sigIdx`
apuntan a tipos equivocados → **corrupción silenciosa**.

### Solución: tabla de tipos CANÓNICA

Emitir en **todos** los módulos la **misma** sección de tipos: la unión de todas las firmas
conocidas, en orden determinista. Las firmas salen de `CWasmFunctionRegistry` (registro global de
externs, con sus signatures, poblado al arrancar) → el conjunto es **pequeño y finito** (~5–15).

Con la tabla canónica, los `sigIdx` son **globalmente estables** y los cuerpos compilados de forma
independiente **se pueden concatenar sin tocar sus bytes**. Coste: unos pocos tipos sin usar por
módulo (bytes despreciables).

Verificado que nada más del cuerpo es relativo al módulo: el codegen **no emite `call` directo** a
funciones locales (solo `call_indirect` contra la tabla importada), y los `local` van por función
en la code section.

## 7. Coste de implementación (lo que exige la regla de parada)

| pieza | dónde | LOC aprox. | riesgo |
|---|---|---|---|
| Tabla de tipos canónica | `Jitter_CodeGen_Wasm.cpp::PrepareSignatures` | ~40 | bajo (gate: cube golden) |
| Emitir N funciones | `WasmModuleBuilder.cpp::WriteModule` (hoy `assert(size()==1)`, secciones function/export/code hardcodeadas a 1) | ~120 | bajo (emisión binaria acotada) |
| `CMemoryFunction` = (módulo, índice de export) | `MemoryFunction.{h,cpp}` + glue EM_JS | ~80 | medio (toca el dedup) |
| Re-batching + re-apuntado + release | `GenericMipsExecutor.h` / `BasicBlock` | ~150 | **el riesgo real** |
| Contadores `modulesLive` / `modulesReleased` | patches 09 + codegen/01 | ~20 | bajo |

**Total ≈ 400 LOC** repartidas entre el submódulo CodeGen y el árbol principal. No hay que
reescribir el backend del codegen ni el matcher.

### Riesgos y STOP
- **Invalidación (SMC):** un bloque invalidado dentro de un batch no puede liberar el módulo entero.
  Se acepta **leak lógico acotado** (la función muerta sigue en el módulo) + refcount para soltar el
  módulo cuando todos sus bloques mueran. Hay que gatearlo con un **test de estrés de reciclaje**:
  el cube golden **podría no cubrirlo** (HANDOFF §3 #4).
- Si el re-apuntado resulta no ser atómico respecto al executor (threads), parar y rediseñar.

## 8. Progreso de implementación

### ✅ Etapa A — primitivos habilitantes (`patches/codegen/02-batch-module-emitter.patch`)

Cambio **behavior-preserving**: el path de un bloque por módulo sigue funcionando igual.

1. **Tabla de tipos canónica** (`Jitter_CodeGen_Wasm.cpp::PrepareSignatures`). Todos los módulos
   emiten las **7 firmas** reales (`vi, iii, iiii, jii, jiji, viii, viji`), con **`"vi"` en el índice
   0** (lo exige la Function section). Verificado que **los 17 externs se registran al arranque**
   (`Ps2VmJs.cpp::CreateVM`), antes de compilar ningún bloque → la tabla es estable y no hay carrera.
   Construida con un **static local de función** (init thread-safe por C++11), porque los bloques
   compilan en varios hilos (EE/VU). Confinada a `#ifdef __EMSCRIPTEN__`: fuera de wasm, upstream
   intacto.
2. **`WriteModule` emite N funciones** (`WasmModuleBuilder.cpp`; antes: `assert(size()==1)` y
   secciones function/export/code hardcodeadas a 1). **N==1 sigue exportando `codeGenFunc`** → el
   glue de `MemoryFunction.cpp` no se toca y el cube golden queda protegido. N>1 exporta
   `codeGenFunc0..N-1`.

**Verificación offline** (`tools/wasm-emitter-check/`, cableada al CI como gate rápido): compila el
`CWasmModuleBuilder` **real** contra un stub de `CStream`, emite N=1/2/32 y los **valida e instancia**
en un motor wasm. Resultado: los tres válidos e instanciables, N=1 con `exports.codeGenFunc`, tabla
de 7 tipos con `vi` en el 0. Corre en ~20 s → caza roturas de formato **antes** del build de 25 min.

### ✅ Etapa B — re-batching: FUNCIONA (commit 4a1db5b, run 29324777509)

**cube, 1034 bloques:**

| | modo 0 (off) | **modo 2 (producción)** |
|---|---|---|
| avgFps | 26,0 | **25,2** (sin regresión) |
| **stateHashAtN** | 3049433245 | **3049433245 ✅ golden** |
| batches / bloques batcheados | 0 / 0 | 32 / 1024 |
| **modulesLive** | 1034 | **54** |
| **blocksPerLiveModule** | 1,0 | **19,15** |
| badIndices / badInstances / traps | 0 / 0 / 0 | **0 / 0 / 0** |

**El batching es CORRECTO**: hash golden idéntico con los cuerpos re-emitidos ejecutándose. Era el
riesgo abierto (que la extracción/re-emisión corrompiese la emulación) y ha caído.

**Solo el modo 2 sirve.** Los modos 1 y 3 no sueltan los módulos solitarios → mantienen 1066
módulos vivos → son **peores** que no batchear. El ahorro de code-space viene del *release*, y este
run confirma en un navegador real lo que §2 midió en V8: **el motor reclama al soltar el módulo**.

### Los tres bugs que costó (y lo que enseñan)
1. **Move ctor sin definir.** Upstream *declara* `CMemoryFunction(CMemoryFunction&&)` y nunca lo
   define (nadie upstream move-construye). Nuestro batching sí → `undefined symbol` en el link.
   → Gate de linkado en `tools/wasm-emitter-check` (segundos, no 25 min).
2. **`HEAP32` en EM_JS.** Los índices de la tabla se devolvían escribiendo
   `HEAP32[(outIds>>2)+i]` desde el worker del pthread → la escritura se perdía → índices a 0 →
   trap. Arreglado devolviéndolos **por valor de retorno**. (Bug real, pero *no* era la muerte.)
3. **El bug de verdad: `CreateInstance` pedía el export equivocado.** Un módulo batch exporta
   `codeGenFunc0..N-1`, no `codeGenFunc`. `CreateInstance()` es el path de **dedup**
   (`CopyFunctionFrom`, §1) → leía `exports.codeGenFunc` → `undefined` → `addFunction(undefined)`
   → `LinkError: function import requires a callable` → moría el worker.
   **Estaba escrito como riesgo en §7 de este mismo documento y no se implementó.**

**Lección de método:** se gastaron 3 ciclos de CI razonando sobre un trap que nadie había leído —
la excepción moría dentro del worker y se descartaba. El harness ahora captura `console`,
`pageerror` y workers. **Leer el error primero; deducir después.**

---

## 10. v2 — COMPILACIÓN POR REGIONES (el diseño definitivo, commit a0814fd)

**El diseño de dos tiers estaba mal para el caso que existía para arreglar.** Lo demostró el juego de
Alvaro con un stack trace inapelable:

```
out of memory
    WasmCreateBatchModule      <- nuestro código
    _EmptyBlockHandler
```

Se quedó sin memoria ejecutable **mientras construía el módulo batch**. Porque el tier 1 **seguía
creando un módulo por bloque** y solo los devolvía cuando pasaba el GC: allocaba **~2x** y dependía
del recolector. En cube (1034 bloques en 20 s) el GC llega y parece un 19x. En un juego real que
compila decenas de miles de bloques en avalancha **no llega**, y el juego muere **antes** que sin
batching. Eso explica que una partida llegase al gameplay y la siguiente ni cargase: era una moneda
al aire según el GC.

**El estado estacionario nunca fue el problema. La avalancha lo era.**

### El diseño
Al fallar un bloque, se camina la **región** alcanzable desde esa dirección (fall-through + destinos
de salto directo, en anchura, tope 32 bloques, solo direcciones alineadas y en rango) y se compilan
**todos en UN módulo**. Sigue siendo compilación lazy — el bloque es ejecutable en su primer
dispatch — pero se compilan más de golpe, lo cual es legal **precisamente porque ninguno de la
región se ha ejecutado aún**. Sin tier solitario, **nada que liberar, cero dependencia del GC**.

### Resultados (cube, run 29355727498)

| | baseline (OFF) | **regiones (v2)** |
|---|---|---|
| **stateHashAtN** | 3049433245 | **3049433245 ✅ golden** |
| jitBlocks compilados | 1034 | 2260 (especula ~2,2x) |
| **modulesCreated** | **1034** | **135** |
| **blocksPerModule** | **1,00** | **16,74** |
| **jitCompileMs** | **129,45** | **10,62 (12x más rápido)** |
| regionFallbacks / badInstances | 0 | **0 / 0** |
| avgFps | 25,65 | 25,5 |

**7,7x menos módulos wasm allocados**, de una sola tacada, y el golden intacto pese a compilar
bloques especulativos. **Bonus inesperado: el JIT es 12x más rápido** — crear el módulo wasm era el
coste dominante del JIT, no generar el código. Al crear 8x menos módulos, el warmup se desploma.

### Caveats honestos
- **La especulación compila 2,2x más bloques** de los que se ejecutan. Sale gratis en tiempo (el JIT
  es más rápido igualmente), pero infla el código emitido. Si un juego especulase mucho peor, el
  ratio caería. `PS2WEB_REGION_SIZE` (32) es la palanca.
- **7,7x, no 32x**: el ratio real lo baja la especulación. Sigue siendo la diferencia entre ~19,5 MB
  y ~2,4 MB de overhead fijo de módulos en cube.

### El path de dedup me mordió TRES veces
`CopyFunctionFrom` → `CMemoryFunction::CreateInstance()` es el sitio más traicionero del sistema:
1. Pedía el export `codeGenFunc` en un módulo batch (que exporta `codeGenFunc0..N-1`) → `LinkError`.
2. Instanciaba un bloque **diferido** (sin módulo aún) → `TypeError: Argument 0 must be a
   WebAssembly.Module`. Arreglado copiando los **bytes** en vez de instanciar: el bloque se une a la
   región como uno más. (Guardar sin más habría dejado el bloque **sin función** = trap seguro.)
3. Y por eso ahora lleva dos fail-safes explícitos.
**Regla: cualquier cambio en cómo un bloque obtiene su función DEBE revisar el dedup.**

### ⬜ Lo que queda
- `CMemoryFunction` = (módulo, índice de export) en vez de (módulo, `codeGenFunc`) + glue EM_JS.
- Acumulador de N bloques → re-emitir como 1 módulo → re-apuntar `fctId` (tabla + mapa patch 07) →
  soltar los módulos solitarios.
- Contadores `modulesLive` / `modulesReleased`.
- **Test de estrés de reciclaje/SMC** (el cube golden podría no cubrirlo — HANDOFF §3 #4).

## 9. Gates (innegociables)
- `cube stateHashAtN == 3049433245` intacto.
- `assert_speedup` sin regresión (±5%) — el batching no debe costar fps.
- `modulesCreated` cae **≥10x** en un juego real (`blocksPerModule ≥ 10`).
- ≥1 juego de la Tanda 2 que hoy muere por clase A **bootea y juega ≥5 min**, contrastado contra
  purei.org (donde sigue muriendo). Ese es el titular.
