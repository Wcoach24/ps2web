# LEGAL — PS2WEB

## Principio rector
PS2WEB es un emulador **BYOR** (Bring Your Own ROM). Todo ocurre en el navegador del
usuario. **Ninguna ROM, ISO, BIOS o save toca ningún servidor.** No distribuimos ni
enlazamos contenido con copyright de ninguna forma.

## LEG-01 — Contenido prohibido en este repositorio y en CI
Queda TERMINANTEMENTE prohibido commitear, subir a CI, alojar o enlazar:
- ISOs, discos o volcados de juegos comerciales de PS2.
- BIOS de Sony (SCPH-*) o cualquier firmware propietario.
- Cualquier material con copyright de terceros.

El emulador base (Play!) implementa un **BIOS HLE** propio, por lo que **no se necesita
ningún BIOS de Sony** para funcionar. Esto elimina el problema legal de raíz.

## LEG-02 — Política de fixtures de test
Los únicos binarios permitidos en `tests/fixtures/` son:
- Samples ELF del **ps2sdk** (ps2dev) y homebrew **open-source** con licencia libre.
- Cada fixture DEBE ir acompañado de su fichero de licencia (`LICENSE*`) adyacente.
- `tools/check_fixture_licenses.sh` valida esta regla en CI.

## Juegos comerciales
Las pruebas con juegos comerciales las realiza **únicamente la persona**, en su propia
máquina, con **backups de juegos que posee legalmente**, fuera de este repositorio. Los
resultados se transcriben como texto a `docs/COMPAT.md`.

## Contribuciones
Toda contribución debe respetar LEG-01/LEG-02. Los PRs que incluyan material con
copyright serán rechazados. Los cambios sobre el core se mantienen limpios y rebasables
sobre upstream `jpd002/Play-` (ver UPSTREAM.lock).
