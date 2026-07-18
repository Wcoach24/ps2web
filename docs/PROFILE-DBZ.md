# PROFILE-DBZ — Fase 0 del PLAN-DBZ-FLUID (reparto del frame + árbol de decisión)

> Salida OBLIGATORIA de la Fase 0. Este documento NO contiene optimización: solo mide el reparto
> exacto del frame de DBZ BT3 (SLUS-21678) para decidir con datos qué cuello atacar (rama 1A/1B/1C).
> Estado: **instrumentación lista y verificada; pendiente la medición real de Alvaro en gameplay.**

---

## 1. Qué se instrumentó (patch `11-profile-fase0.patch`, read-only, `#ifdef __EMSCRIPTEN__`)

Todo son contadores. Ninguno toca EE RAM → **el gate del cube (`stateHashAtN=3049433245`) es inmune**.
`steady_clock` (no `emscripten_get_now`) para no meter un round-trip a JS en el bucle caliente.

| Métrica en `window.__ps2web_metrics` | Getter wasm | Qué mide | Dónde |
|---|---|---|---|
| `eeIdlePct` | `getEeIdlePct()` | % de EE ocioso en el intervalo (idle/total ticks) | `StatsManager` ← `CPS2VM` util info |
| `drawCallsPerFrame` | `getDrawCalls()`/frames | draw calls por frame = carga de GS | `CStatsManager::GetDrawCalls` |
| `framePctEe` | `getEeExecMs()` | % del tiempo del hilo EE en `ExecuteCpu` (dispatch+exec) | `CPS2VM::UpdateEe` |
| `framePctVu` | `getVuExecMs()` | % del hilo EE en VU0+VU1 `Execute` | `CPS2VM::UpdateEe` |
| `framePctGsStall` | `getGsStallMs()` | % del hilo EE **bloqueado** esperando al GS | `CGSHandler::SendGSCall` (waitForCompletion) |
| `gsLoadPct` | `getGsBusyMs`/`getGsWaitMs` | % del **hilo GS** rasterizando vs. ocioso | `CGSHandler::ThreadProc` |
| `eeExecMsS`,`vuExecMsS`,`gsBusyMsS`,`gsWaitMsS`,`gsStallMsS` | — | ms/seg crudos por subsistema (para depurar) | — |
| `vuBlocks` | `getVuBlocks()` | bloques VU compilados en fresco (== módulos VU; la VU no batchea) | `CVuExecutor::BlockFactory` |

`framePct*` normalizan al tiempo **atribuible** del hilo EE (`eeExec+vuExec+gsStall`); el resto
(IOP/SPU/otros) no se reparte. `gsLoadPct` es del hilo GS, independiente.

## 2. Protocolo de medición (Alvaro) — la única medida real

El ISO no está en CI, así que la Fase 0 se valida en dos patas:
- **CI (cube/vu1):** golden intacto + la instrumentación no rompe el harness (automático).
- **Alvaro (DBZ BT3):** arrancar el juego en `https://dist-ivory-phi-37.vercel.app`, entrar a un
  **combate real** (no menú), dejar correr **≥30 s** para pasar el warmup, y pegar:
  ```js
  copy(JSON.stringify(window.__ps2web_metrics, null, 2))   // en la consola del navegador
  ```
  Repetir en 2-3 momentos (combate abierto, muchos efectos, cámara cercana) para ver si el cuello
  se mueve. Pega también `fps`/`emuSpeedPct` de cada muestra.

## 3. RESULTADOS (rellenar con las muestras de Alvaro)

| muestra | fps | emuSpeed% | eeIdle% | framePctEe | framePctVu | framePctGsStall | gsLoad% | drawCalls/f | vuBlocks | jitBlocks | modulesCreated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| combate 1 | _ | _ | _ | _ | _ | _ | _ | _ | _ | _ | _ |
| combate 2 | _ | _ | _ | _ | _ | _ | _ | _ | _ | _ | _ |
| efectos   | _ | _ | _ | _ | _ | _ | _ | _ | _ | _ | _ |

## 4. ÁRBOL DE DECISIÓN (qué rama ejecutar, del PLAN §2)

| Señal medida | Cuello | Rama |
|---|---|---|
| `eeIdlePct`~0, `framePctEe` domina, dispatches altísimos | **EE dispatch** | **1A** — tail-calls intra-región + 2c |
| `framePctVu` domina | **VU1** | **1B** — batch VU + tail-calls VU + SIMD |
| `eeIdlePct` alto + `framePctGsStall` alto + `gsLoad`~100% + drawCalls altos | **GS** | **1C** — frameskip → GL opts → WebGPU |
| Nada >40%, todo repartido | mil cortes | 1A+1B+1C en serie |

## 5. Veredicto (rellenar tras la medición)

_Cuello #1 identificado: ____. Rama elegida: ____. Checkpoint con Alvaro antes de comprometer la
rama grande (1A.1 tail-calls / 1C.3 WebGPU)._

## 6. Nota de honestidad

Esto mide; no acelera. El objetivo de la Fase 0 es no quemar semanas de CI adivinando. La palabra
"infalible" del plan aplica al **método** (medir → atacar el cuello medido → verificar con gate),
no al resultado: DBZ BT3 a 30 fps es un salto de 5-10x y ningún plan honesto lo promete de antemano.
