# PS2WEB — PLAN DE RESCATE (2026-07-10)

Contexto: un juego comercial se cuelga igual en nuestro deploy y en purei.org → el cuelgue es
límite de Play! upstream, no regresión nuestra (HANDOFF §0). El objetivo de este plan:
**(1) que el emulador FUNCIONE hoy con juegos reales, (2) superar a purei.org en algo medible.**

## Reencuadre honesto

"Que funcione con cualquier juego" = arreglar la emulación de Play! juego a juego. Eso es trabajo
de años del equipo upstream y NO es alcanzable aquí. Lo que SÍ es alcanzable:

- **Dato clave (verificado hoy vía API de GitHub):** el tracker oficial
  [jpd002/Play-Compatibility](https://github.com/jpd002/Play-Compatibility) lista
  **1.302 juegos `state-playable`** y 994 `state-ingame`. El emulador SÍ funciona — con los
  juegos correctos. El fallo fue probar un juego al azar sin consultar compatibilidad.
- **Vector de superioridad real:** los juegos grandes fallan en NAVEGADOR por agotamiento de
  code-space (`failed to allocate executable memory`, 1 módulo wasm por bloque — HANDOFF §3).
  Ese bug lo tiene purei.org también. **Batching (JIT-04)** lo arregla → juegos que purei.org
  no puede correr, nosotros sí. Diferenciador medible y menos arriesgado que 2c.

## FASE 0 — Diagnóstico del cuelgue (1 sesión, sin build)

Reproducir el juego en https://dist-ivory-phi-37.vercel.app con DevTools y clasificar:

| Clase | Señal | Salida |
|---|---|---|
| A. Code-space OOM | consola: `failed to allocate executable memory` | Lo arregla FASE 2 (batching) |
| B. Memoria OOM | `out of memory` en worker | flags de build (ya conocido, §4) |
| C. Bug de emulación | EE vivo (dispatches suben en `__ps2web_metrics`) pero sin avanzar | Upstream: reportar issue, NO perseguir |
| D. Render/GS | EE avanza, canvas muerto | Candidato F4 (WebGPU) |

Instrumentación ya existe (patches 01–07). Coste: ~0 código.
**Necesito: nombre del juego y punto exacto del cuelgue.**

## FASE 1 — "Un emulador que funciona": biblioteca curada (2–4 días, paralelo)

1. Script que descarga los issues `state-playable` del tracker → `bench/compat.json`.
2. Cruce con restricciones navegador (tamaño ISO, formato soportado) → top ~20 candidatos.
3. Protocolo de prueba: Alvaro valida con sus propios dumps en el deploy; harness Playwright
   auto-reporta fps/boot donde sea posible.
4. **F6 mínima:** UI de librería con badge "✔ verificado en navegador" + persistencia OPFS ya
   hecha (F5 W1) hecha visible.

Resultado: URL donde eliges un juego de la lista y **juega**. purei.org no ofrece esto
(cero curación, cero UX, persistencia invisible). Primer diferenciador, riesgo bajo.

## FASE 2 — Superioridad #1: batching JIT-04 (1–2 semanas, CI)

N bloques MIPS → 1 módulo wasm (hoy: 1 módulo por bloque, decenas de miles por juego).
- Arregla el code-space OOM → **habilita juegos grandes que fallan en purei.org**.
- Bonus: menos overhead de instanciación → mejora de arranque.
- Gates: cube golden intacto + `assert_speedup` (mediana ≥3 runs) + juego real (T2). HANDOFF §7.
- KPI: "N juegos que se cuelgan en purei.org y aquí funcionan" — publicable y honesto.

## FASE 3 — La apuesta de velocidad: spike 2c (1 día, gate duro)

Spike GO/NO-GO: ¿`CWasmModuleBuilder` puede emitir `loop`+`call_indirect` importando
`__indirect_function_table` + memoria compartida? (incógnitas 1–2 de HANDOFF §3).
- NO → se cierra 2c definitivamente, cero inversión extra.
- SÍ → implementar dispatch loop residente según `docs/JIT-DESIGN.md` (la única vía al ≥2x).

## FASE 4 — WebGPU (F4)

Solo si FASE 0 o los juegos de FASE 1 muestran cuello en GS. Medir antes de construir.

## Definición de éxito (nueva, verificable)

1. ≥10 juegos comerciales verificados jugables en nuestra URL con librería UI. (FASE 1)
2. ≥1 diferenciador medible vs purei.org: juegos grandes vía batching, o ≥1.5x vía 2c, o
   librería curada + persistencia. (FASES 1–3)
3. El cuelgue reportado queda clasificado con causa raíz y decisión (fix/upstream/descartar). (FASE 0)

## Qué NO haremos

- Arreglar bugs de emulación por-juego en el core (se reportan upstream).
- Declarar mejoras sin gate (`assert_speedup` + cube golden + juego real).
- Repetir D5: toda validación incluye un juego comercial, no solo homebrew.

## Dependencias de Alvaro

- Nombre del juego que se colgó + punto del cuelgue (FASE 0).
- Dumps propios para validar la biblioteca (FASE 1).
- PAT de push cuando toque tocar el repo (no se guarda).
