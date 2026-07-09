# BUILDING — PS2WEB

PS2WEB es una capa (overlay) sobre el emulador **Play!** (`jpd002/Play-`). El build wasm
real corre en **GitHub Actions** (entorno reproducible con emsdk pinneado). También puedes
compilar en local con `tools/build.sh`.

## Versiones pinneadas
- Emscripten: ver `.emsdk-version` → **4.0.1**
- Commit de Play! upstream: ver `UPSTREAM.lock`

## Build en CI (recomendado)
`.github/workflows/build.yml` hace, en cada push:
1. Checkout de este repo (overlay).
2. Checkout de `jpd002/Play-` en el commit de `UPSTREAM.lock`, con submódulos recursivos.
3. Instala emsdk 4.0.1 + ninja + Node 20.17.
4. `emcmake cmake --preset wasm-ninja` && `cmake --build --preset wasm-ninja-release`.
5. Ensambla el frontend `js/play_browser` (CRA) con `Play.js`/`Play.wasm`.
6. Sube artefactos: `play-wasm` (Play.wasm) y `ps2web-site` (build del frontend).
7. Smoke test Playwright bajo servidor COOP/COEP.

Descarga los artefactos desde la pestaña Actions del run.

## Build en local (opcional)
Requisitos: git, cmake ≥ 3.22, ninja, Node ≥ 20, Python 3, y emsdk 4.0.1 activado.

```bash
# 1) Instala/activa emsdk 4.0.1 (una vez):
git clone https://github.com/emscripten-core/emsdk && cd emsdk
./emsdk install 4.0.1 && ./emsdk activate 4.0.1 && source ./emsdk_env.sh && cd -

# 2) Build reproducible:
bash tools/build.sh            # clona Play! al commit pinneado, compila, ensambla el site en ./dist

# 3) Sirve con las cabeceras obligatorias COOP/COEP y abre el navegador:
python3 tools/serve.py dist 8080
# -> http://localhost:8080  (crossOriginIsolated debe ser true)
```

## Nota sobre COOP/COEP
SharedArrayBuffer (threads) exige *cross-origin isolation*. Cualquier servidor que sirva
PS2WEB DEBE enviar en TODAS las rutas:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
`tools/serve.py` ya lo hace para desarrollo local.
