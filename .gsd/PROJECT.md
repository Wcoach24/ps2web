# PS2WEB

## Vision
El mejor emulador de PS2 en navegador: URL → arrastra tu ISO → juega.
Fork upstream-friendly de Play! con threads, SIMD, JIT-a-wasm, WebGPU y OPFS.
Cero ROMs/BIOS en servidor: 100% client-side, BYOR.

## Goals
1. Homebrew suite a 60 FPS en desktop medio (métrica: harness Playwright, emuSpeedPct ≥ 100 en ≥ 90% de frames).
2. ≥3 comerciales "playable" a full speed en test manual documentado (fuera de CI).
3. UX de producto: librería persistente OPFS, gamepad, save states, PWA.

## Tech Stack
- Core: C++ (fork jpd002/Play-), Emscripten → wasm (threads+SIMD)
- Render: WebGPU con fallback WebGL2
- Frontend: React existente en js/play_browser
- Storage: OPFS (FileSystemSyncAccessHandle)
- Test: Playwright + servidor local COOP/COEP + frame-hash
- Hosting: Cloudflare Pages (o Vercel) con COOP/COEP

## Constraints
- SharedArrayBuffer exige cross-origin isolation en TODAS las rutas.
- Sin ALLOW_MEMORY_GROWTH (threads): memoria fija 1 GB.
- CERO material con copyright en repo/CI (ver LEGAL.md).
- Commits rebasables sobre upstream de Play!.

## Out of Scope
- Port de PCSX2 a wasm.
- Netplay, cloud streaming, cuentas de usuario.
- iOS Safari como target primario (best-effort).
- Distribución de ROMs/BIOS de cualquier forma.
