#!/usr/bin/env bash
# F2 build-flag changes over the pinned Play! tree (D3/D4/D5). Surgical seds
# pinned to known upstream lines of Source/ui_js/CMakeLists.txt. Idempotent-safe.
#   D3: pthread pool 2 -> 8
#   D5: drop -sALLOW_MEMORY_GROWTH, use fixed -sINITIAL_MEMORY=1GB (no growth w/ threads)
#   (D4 SIMD -msimd128 is passed as a global compile flag at configure time, not here)
set -euo pipefail
ROOT="${1:-.}"
f="$ROOT/Source/ui_js/CMakeLists.txt"
test -f "$f" || { echo "not found: $f"; exit 1; }

sed -i 's/-sPTHREAD_POOL_SIZE=2/-sPTHREAD_POOL_SIZE=8/' "$f"
sed -i 's#target_link_options(Play PRIVATE "-sALLOW_MEMORY_GROWTH")#target_link_options(Play PRIVATE "-sINITIAL_MEMORY=1073741824")#' "$f"

grep -q -- '-sPTHREAD_POOL_SIZE=8'     "$f" || { echo "FAIL: pool size not applied"; exit 1; }
grep -q -- '-sINITIAL_MEMORY=1073741824' "$f" || { echo "FAIL: fixed memory not applied"; exit 1; }
if grep -q -- '-sALLOW_MEMORY_GROWTH' "$f"; then echo "FAIL: growth still present"; exit 1; fi
grep -q -- '-sALLOW_TABLE_GROWTH'      "$f" || { echo "FAIL: table growth (JIT) missing!"; exit 1; }

echo "F2 flags OK:"; grep -nE 'PTHREAD_POOL_SIZE|INITIAL_MEMORY|ALLOW_TABLE_GROWTH' "$f"
