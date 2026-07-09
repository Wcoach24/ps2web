# Fixtures homebrew (LEG-02 / TST-01)

Solo homebrew open-source con licencia libre archivada. CERO ROM/BIOS.

## cube (src/cube/)
Sample gráfico del **ps2sdk** (ps2dev): cubo 3D rotando (EE + math3d + GS via draw3d).
Licencia: **Academic Free License v2.0** — ver `src/cube/LICENSE`.
Origen: `ee/draw/samples/cube` de github.com/ps2dev/ps2sdk. (c) 2005 Naomi Peori.
Se compila a `cube.elf` en CI con la imagen `ps2dev/ps2dev` (job `fixtures`).

Ejercita: pipeline EE→GS, genera frames GS medibles por `getFrames()` → fps/emuSpeedPct.

## vu1 (src/vu1/)
Sample **VU1 + libpacket2** del ps2sdk: modelo 3D texturizado procesado por el VU1 (el
hotspot #1 de la auditoría JIT). Licencia AFL v2.0 — ver `src/vu1/LICENSE`. (c) 2020 Sandro
Sobczyński. No requiere VCL (usa `draw_3D.vsm` pre-ensamblado + `dvp-as`).
Es un fixture **CPU/VU-bound**: da margen medible para el speedup de F3 (a diferencia del
cubo, topado a ~60fps). `vu1.json` (build F2 actual) = referencia de speedup para F3.
