# SPIKE 2c — GO/NO-GO: dispatch loop residente en wasm (2026-07-10)

Pregunta única del brief (PLAN-OPUS-4.8.md): **¿puede `CWasmModuleBuilder` (deps/CodeGen)
emitir un módulo con `loop` + `br_if` + `call_indirect` que IMPORTE
`__indirect_function_table` (la `wasmTable` de emscripten, tabla 0) y `wasmMemory`?**

Fuente leída (upstream pinneado): `Play--CodeGen@a5009f7` (submódulo del commit
`b72057621e55…`): `src/WasmModuleBuilder.cpp`, `include/WasmDefs.h`,
`src/Jitter_CodeGen_Wasm.cpp`, `src/MemoryFunction.cpp`. Patches locales 06/07/08.

---

## VEREDICTO: **GO con coste acotado (~1.5–2.5 días al primer prototipo medible).**

El wasm no es el riesgo. Emitir el loop es trabajo de binario acotado y ya validado con un
prototipo real (abajo). El riesgo real es la **corrección del loop** (SMC/reciclaje de bloques,
semántica exacta de `nHasException`/`cycleQuota`), que este spike NO resuelve por diseño y que
debe cubrirse en implementación con un gate nuevo además del cube golden.

### Desglose de la pregunta

| Sub-pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿El **cuerpo** de función puede llevar `loop`/`br_if`/`call_indirect`/loads? | **SÍ** | `WasmDefs.h` define `INST_LOOP=0x03`, `INST_BR_IF=0x0D`, `INST_BLOCK=0x02`, `INST_CALL_INDIRECT=0x11`, `INST_I32_LOAD=0x28`, comparadores. El cuerpo en `WasmModuleBuilder::FUNCTION.code` es `std::vector<uint8>` **opaco**: el builder no valida el contenido. |
| ¿`WriteModule` **as-is** puede importar `__indirect_function_table`? | **NO** | La sección Import está **hardcodeada** (35 bytes fijos `0x23`): exactamente 2 imports — `env.memory` y `env.fctTable`. `fctTable` se liga en el glue a `Module.codeGenImportTable`, que es **otra tabla** (helpers del JIT), no la `wasmTable`. |
| ¿Se puede importar `wasmTable` + `wasmMemory` en un módulo hecho a mano? | **SÍ (probado)** | Prototipo `docs/spike-2c/` instanciado desde Node contra una `WebAssembly.Table`/`Memory` reales. Es el **mismo patrón** que el glue ya usa (`WasmCreateFunction` pasa objetos JS Table/Memory al import object). |
| ¿Los bloques son direccionables por índice en `wasmTable`? | **SÍ (ya en producción)** | `MemoryFunction.cpp::WasmCreateFunction` hace `addFunction(fct,'vi')` → registra el bloque en `wasmTable` y devuelve `fctId`, que Play! guarda como `m_code`. El **patch 08** ya lo llama como puntero: `reinterpret_cast<void(*)(void*)>(fctId)(&ctx)` → emscripten lo compila a `call_indirect` sobre `wasmTable`. |

**Conclusión mecánica:** `WriteModule` no sirve tal cual (su único import de tabla apunta a la
tabla equivocada), pero **no hay que reescribir el codegen**. Basta un **emisor de módulo paralelo
(~150 LOC)** que reutiliza `WasmDefs.h` + `WriteULeb128/WriteSLeb128`, más un **glue EM_JS nuevo**
que ligue `{ env: { memory: wasmMemory, __indirect_function_table: wasmTable } }`. El camino del
bloque (WriteModule actual) queda intacto.

---

## Evidencia: prototipo funcional (no solo lectura de código)

`docs/spike-2c/loop.wat` — esqueleto del loop residente 2c:
- importa `env.memory` y `env.__indirect_function_table` (tabla 0, funcref),
- `loop $again` / `block $exit`,
- sale si `nHasException != 0` (mem[4]) o `cycleQuota <= 0` (mem[8]) → **respeta HANDOFF §3 #4**,
- `pc = mem[0]`, `fctId = lookup(pc)` sobre un mapa PC→fctId en memoria lineal (mapBase=4096,
  modelo del patch 07 → **reutiliza HANDOFF §3 #3**),
- `call_indirect (type $blockSig=vi)` con el `fctId` del bloque,
- si `fctId==0` sale a C++ (fallback `FindBlockAt`).

`docs/spike-2c/run.mjs` — arnés Node que:
1. ensambla el `.wat` con `wabt` → **219 bytes de wasm válido**,
2. crea `WebAssembly.Memory` + `WebAssembly.Table` reales (modelo emscripten),
3. registra 2 bloques dummy en la tabla emulando `addFunction(fct,'vi')`,
4. carga el mapa PC→fctId en memoria lineal,
5. arranca con PC=0x1000, quota=5 y **una sola llamada JS** `codeGenFunc(ctx)`.

Salida reproducible (`node docs/spike-2c/run.mjs`):

```
ASSEMBLE: OK  (219 bytes)
INSTANTIATE: OK (import __indirect_function_table + memory aceptado)
POST-RUN nHasException=0 quota=0 trace=23
RESULT: PASS (loop residente despacho 5 bloques via call_indirect sin volver a JS)
```

El `trace=23` = A(1)+B(10)+A(1)+B(10)+A(1): el loop alternó A↔B **5 veces dentro de wasm**,
decrementando la quota en memoria, **sin retornar a JS entre bloques**. Eso es exactamente la
transición bloque→bloque que hoy cruza la frontera C++↔wasm (~1.85 M dispatches/s, cuello medido
en BENCH-F3.md) y que 2c elimina.

---

## Por qué esto puede dar el ≥2x (y las mediciones previas no)

BENCH-F3 ya probó que optimizar el **lado C++** (patch 08: mapa per-executor + fast-path que salta
`FindBlockAt` y el `Execute` virtual) da **0 fps** (vu1 −2.9%): aunque se ahorra el lookup y el
despacho virtual, **cada iteración sigue cruzando C++↔wasm** (`fct(context)` retorna al `while` de
C++). El único ahorro que queda es **borrar la frontera**: mover el `while` a wasm. El prototipo
demuestra que esa frontera se puede borrar con la infraestructura existente.

---

## Plan de implementación (solo si Alvaro da OK; el spike NO lo ejecuta)

Referencia: `docs/JIT-DESIGN.md` §2c y las 4 incógnitas de `docs/HANDOFF.md` §3.

1. **Emisor de módulo del loop** (`deps/CodeGen`, patch nuevo): función paralela a `WriteModule`
   que emite type section (`vi` para el bloque + firma del loop), import section
   (`env.memory` + `env.__indirect_function_table`), code section con el cuerpo del loop, export
   `codeGenFunc`. Reutiliza `WriteULeb128`. ~150 LOC. **No toca el matcher del Jitter.**
2. **Glue de instanciación** (`MemoryFunction.cpp` o nuevo EM_JS en `ui_js`): instancia el módulo
   del loop ligando `__indirect_function_table: wasmTable`, `memory: wasmMemory`. Patrón idéntico
   al `WasmCreateFunction` actual. → cierra **incógnita #2**.
3. **Mapa PC→fctId en memoria lineal**: exponer el mapa del patch 07 (hoy `std::vector` por
   executor) con puntero base estable pasado al loop. → cierra **incógnita #3** (el layout ya existe).
4. **Semántica exacta** de `nHasException`/`cycleQuota`: leer sus offsets reales en `CMIPS`/
   `m_State` y replicar la condición del `while` de `GenericMipsExecutor.h`. → **incógnita #4**.
5. **Corrección / reciclaje (el riesgo real, incógnita #4b):** un bloque invalidado (SMC) o
   reciclado deja una entrada **stale** en el mapa. El patch 08 ya instrumenta esto
   (`g_ps2webFastMismatches`, auditoría periódica vs `FindBlockAt`). Añadir un **gate de estrés de
   reciclaje** (fixture que fuerce invalidación) porque el **cube golden podría no cubrirlo**
   (HANDOFF §3 #4). Sin este gate nuevo, no declarar corrección.
6. **Flag de build** para activar/desactivar el loop residente y comparar con `assert_speedup`
   (mediana ≥3 runs) en vu1 + **1 juego real** (lección D5). Cube golden intacto obligatorio.

### Riesgos / condiciones de STOP
- Si al leer los offsets de `m_State` la condición del `while` resulta más rica de lo modelado
  (interrupts, check de quota por sub-bloque VU): parar y documentar antes de emitir el loop final.
- Si el reciclaje de bloques no se puede hacer determinista para un gate → no hay corrección
  demostrable → **NO-GO efectivo** aunque el wasm funcione.
- `call_indirect` con `sigIdx`/`tableIdx` a 1 byte (como hace Play! hoy): válido para índices
  pequeños; si el número de tipos crece habría que LEB-encodear (trivial).

**Estimación:** 1.5–2.5 días a un prototipo medible tras el flag; +1–2 días para el gate de
reciclaje y la validación con juego real. Coste total de-riesgado por este spike.
