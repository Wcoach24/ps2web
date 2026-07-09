# PLAN — Phase F0

<plan>
  <metadata>
    <wave>1</wave>
    <depends_on></depends_on>
    <files_modified>
      UPSTREAM.lock, .emsdk-version, LEGAL.md, BUILDING.md, README.md,
      tools/build.sh, tools/serve.py, tools/check_fixture_licenses.sh,
      tests/smoke.spec.js, playwright.config.js, package.json,
      .github/workflows/build.yml
    </files_modified>
    <requirements>BLD-01, BLD-02, LEG-01, LEG-02</requirements>
    <must_haves>
      - UPSTREAM.lock pins jpd002/Play- commit; .emsdk-version = 4.0.1
      - tools/build.sh reproducibly builds Play.wasm (local path)
      - tools/serve.py serves with COOP/COEP
      - LEGAL.md (LEG-01/02) + BUILDING.md present
      - .github/workflows/build.yml builds Play.wasm in CI and uploads artifacts
    </must_haves>
  </metadata>
  <task type="auto">
    <name>Overlay repo + reproducible build scripts + legal/docs</name>
    <verify>
      - [ ] UPSTREAM.lock and .emsdk-version exist with pinned values
      - [ ] tools/build.sh, serve.py, check_fixture_licenses.sh executable
      - [ ] LEGAL.md, BUILDING.md, README.md present
    </verify>
  </task>
</plan>

<plan>
  <metadata>
    <wave>2</wave>
    <depends_on>wave1</depends_on>
    <files_modified>.github/workflows/build.yml, tests/smoke.spec.js</files_modified>
    <requirements>BLD-01, BLD-03(partial)</requirements>
    <must_haves>
      - CI run is green
      - Artifact play-wasm (Play.wasm) uploaded and non-trivial in size
      - Smoke test: crossOriginIsolated === true AND Play.wasm validates
    </must_haves>
  </metadata>
  <task type="human-verify">
    <name>Green CI run producing Play.wasm + passing COOP/COEP smoke</name>
    <verify>
      - [ ] GitHub Actions "Build PS2WEB (wasm)" conclusion == success
      - [ ] play-wasm artifact present
      - [ ] smoke assertions pass (COI true, wasm valid)
    </verify>
  </task>
</plan>
