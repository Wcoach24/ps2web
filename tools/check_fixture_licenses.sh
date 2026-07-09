#!/usr/bin/env bash
# LEG-02: every binary fixture in tests/fixtures/ must have an adjacent license file.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/tests/fixtures"
[ -d "$DIR" ] || { echo "no fixtures dir yet — OK"; exit 0; }
shopt -s nullglob
fail=0; found=0
for f in "$DIR"/*; do
  [ -d "$f" ] && continue
  case "$(basename "$f")" in LICENSE*|*.md|*.txt|.gitkeep) continue;; esac
  found=1
  stem="${f%.*}"
  if ! compgen -G "$DIR/LICENSE*" >/dev/null && ! compgen -G "${stem}.LICENSE*" >/dev/null; then
    echo "MISSING LICENSE for fixture: $(basename "$f")"; fail=1
  fi
done
[ "$found" -eq 0 ] && echo "no binary fixtures yet — OK"
[ "$fail" -eq 0 ] && echo "fixture license check OK" || { echo "FAIL: unlicensed fixtures"; exit 1; }
