#!/usr/bin/env bash
# Reproducible PS2WEB build. Clones Play! at the pinned commit, builds the wasm
# js target with the pinned emsdk, and assembles the frontend site into ./dist.
# Requires: git, cmake>=3.22, ninja, node>=20, and an ACTIVE emsdk (source emsdk_env.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM_SHA="$(cat "$ROOT/UPSTREAM.lock")"
WORK="${PS2WEB_WORK:-$ROOT/Play-}"

command -v emcmake >/dev/null || { echo "ERROR: emsdk not active. Run: source <emsdk>/emsdk_env.sh"; exit 1; }
command -v ninja  >/dev/null || { echo "ERROR: ninja not installed."; exit 1; }

echo "== [1/4] Fetch Play! @ $UPSTREAM_SHA =="
if [ ! -d "$WORK/.git" ]; then
  git clone https://github.com/jpd002/Play-.git "$WORK"
fi
git -C "$WORK" fetch --depth 1 origin "$UPSTREAM_SHA"
git -C "$WORK" checkout -q "$UPSTREAM_SHA"
git -C "$WORK" submodule update --init --recursive --depth 1

echo "== [2/4] Configure (emcmake, preset wasm-ninja) =="
( cd "$WORK" && emcmake cmake --preset wasm-ninja )

echo "== [3/4] Build (preset wasm-ninja-release) =="
( cd "$WORK" && cmake --build --preset wasm-ninja-release )

BUILD_DIR="$WORK/build_cmake/build/wasm-ninja/Source/ui_js/Release"
test -f "$BUILD_DIR/Play.wasm" || { echo "ERROR: Play.wasm not produced at $BUILD_DIR"; exit 1; }

echo "== [4/4] Assemble frontend site (js/play_browser) =="
( cd "$WORK/js/play_browser"
  cp "$BUILD_DIR/Play.js"   ./src/
  cp "$BUILD_DIR/Play.wasm" ./public/
  cp "$BUILD_DIR/Play.js"   ./public/
  export REACT_APP_VERSION="$(git -C "$WORK" describe --tags --always 2>/dev/null || echo dev)"
  npm install
  npm run build )

rm -rf "$ROOT/dist" && mkdir -p "$ROOT/dist"
cp -r "$WORK/js/play_browser/build/." "$ROOT/dist/"
cp "$BUILD_DIR/Play.wasm" "$ROOT/dist/Play.wasm"
echo "OK: site in $ROOT/dist ; Play.wasm present."
