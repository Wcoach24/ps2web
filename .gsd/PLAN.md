# PLAN — Phase F2

<plan>
  <metadata>
    <wave>1</wave>
    <files_modified>tools/apply_f2_flags.sh, overlay/js/play_browser/src/ps2web_metrics.ts, .github/workflows/build.yml</files_modified>
    <requirements>THR-01, BLD-03</requirements>
    <must_haves>
      - CI aplica pool=8 + memoria fija 1GB sobre Play! (apply_f2_flags.sh asserts)
      - Build wasm sigue verde con los flags nuevos
      - Harness reporta threadsOk=true (crossOriginIsolated + SharedArrayBuffer)
    </must_haves>
  </metadata>
  <task type="auto"><name>Threads pool 8 + memoria fija 1GB + señal threadsOk</name>
    <verify>
      - [ ] apply_f2_flags.sh exit 0 (asserts pool8, INITIAL_MEMORY, no growth, table growth intacto)
      - [ ] job build verde con flags nuevos
      - [ ] bench json: threadsOk=true
    </verify>
  </task>
</plan>

<plan>
  <metadata>
    <wave>2</wave>
    <depends_on>wave1</depends_on>
    <files_modified>.github/workflows/build.yml, tests/harness/bench.spec.js</files_modified>
    <requirements>THR-02</requirements>
    <must_haves>
      - -msimd128 global en el configure; build verde
      - Harness registra frameHash vs baseline (simdHashMatchesBaseline) sin romper
      - avgFps > 0 (sigue booteando y renderizando con SIMD)
    </must_haves>
  </metadata>
  <task type="human-verify"><name>-msimd128 global sin regresión de corrección</name>
    <verify>
      - [ ] job build verde con -msimd128
      - [ ] job harness verde; bench/results/cube.json con threadsOk + simdHashMatchesBaseline
    </verify>
  </task>
</plan>
