# Compatibilidad en navegador — protocolo y shortlist (2026-07-10)

Fuente: `bench/compat.json` (1.302 juegos `state-playable` del tracker oficial, descargado con
`tools/fetch_compat.py`). "Playable" = verificado en Play! nativo; el subset navegador hay que
validarlo aquí (RAM 2GB máx + code-space limitado → los DVD grandes pueden caer en OOM A/B).

## Caso Samurai Jack: The Shadow of Aku (Fase 0)

**No existe en el tracker** (0 resultados). Nadie lo ha probado nunca en Play!; su cuelgue es
soporte desconocido upstream, no regresión nuestra. Acción: reportar issue en el tracker con el
punto de cuelgue (aporta a upstream y queda documentado) y NO perseguir el fix en el core.

## Shortlist de validación (empezar por los ligeros)

Tanda 1 — CD/pequeños, alta probabilidad en navegador:
- SLUS-20328 Tekken 4 · SLUS-21059 Tekken 5
- SLUS-20591 DBZ Budokai · SLUS-20779 Budokai 2
- SLUS-20666 Disgaea: Hour of Darkness (2D)
- SLUS-20228 / SLES-51156 Silent Hill 2
- SLUS-20018 Onimusha: Warlords
- SLUS-20307 Burnout
- SCUS-97198 Sly Cooper

Tanda 2 — DVD grandes, prueba de estrés del code-space (candidatos a rescate vía batching JIT-04):
- SLUS-20312 Final Fantasy X · SLUS-20963 FFXII
- SLUS-20370 Kingdom Hearts · SLUS-21005 KH II
- SLUS-21134 Resident Evil 4
- SLUS-21207 Dragon Quest VIII
- SLUS-21621 Persona 3 FES · SLUS-21782 Persona 4

## Protocolo por juego (5 min)

1. Abrir https://dist-ivory-phi-37.vercel.app + DevTools (F12, pestaña Console).
2. Pegar el sniffer ANTES de cargar el ISO:
```js
(()=>{const t0=Date.now();window.__diag={errs:[],snaps:[]};
const oe=console.error.bind(console);console.error=(...a)=>{__diag.errs.push(String(a[0]).slice(0,200));oe(...a)};
setInterval(()=>{const m=window.__ps2web_metrics;if(m)__diag.snaps.push({t:((Date.now()-t0)/1000|0),fps:m.fps,spd:m.emuSpeedPct});},5000);
window.diagReport=()=>({errs:__diag.errs.slice(-5),ultimos:__diag.snaps.slice(-6),
mem:performance.memory?(performance.memory.usedJSHeapSize/1048576|0)+'MB':'n/a'});})();
```
3. Cargar el juego, jugar/esperar hasta cuelgue o 5 min de juego.
4. Ejecutar `diagReport()` y anotar resultado en la tabla.

Clasificación del resultado:
- `failed to allocate executable memory` en errs → **Clase A** (lo arregla batching JIT-04).
- `out of memory` → **Clase B** (memoria; flags).
- fps>0 y spd>0 pero pantalla congelada → **Clase C** (bug emulación, reportar upstream).
- fps=0 tras boot ok → **Clase D** (GS/render).
- 5 min jugable → ✔ entra en la librería verificada.

## Registro

| Serial | Juego | Resultado | Clase | Notas |
|---|---|---|---|---|
| SLUS-20802 | Samurai Jack: The Shadow of Aku | cuelgue (igual en purei.org) | pendiente clasificar | no existe en tracker upstream |
