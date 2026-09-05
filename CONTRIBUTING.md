# Contributing to STIOC

## Quick start (pnpm, Node 22)

```bash
git clone https://github.com/ixode0/stioc.git && cd stioc
pnpm install --frozen-lockfile
pnpm run compile   # tsc + vite
pnpm run lint      # eslint 9
pnpm start         # dev: tsc --watch + electron
```

Requires Node >=22, pnpm 9.12.3 (`corepack enable`).

## Tests

Проверка (единый блок):

```bash
pnpm run tsc && pnpm run compile && pnpm exec playwright test
# headless Linux (без дисплея):
xvfb-run -a pnpm exec playwright test
```

- `pnpm run tsc` — typecheck (`tsc --noEmit`)
- `pnpm run compile` — `tsc + vite build`
- `pnpm exec playwright test` — e2e (`test/e2e.ts`, Playwright + Electron)
- `pnpm run unit-tests` — electron-mocha (legacy Output)

e2e запускаются локально с дисплеем; в CI (`.github/workflows/build.yml`)
их пока нет — там только lint + tsc + vite + pack.

## Pull requests

1. Fork + branch (`fix/…` / `feat/…`)
2. `pnpm run compile && pnpm run lint` must be green (CI: ubuntu/mac/windows)
3. Describe issue number + before/after
4. Keep `pnpm-lock.yaml` frozen, no `package-lock.json`

## Reporting bugs

Check [issues](https://github.com/ixode0/stioc/issues) first, then open with:
- `pnpm -v`, `node -v`, OS + `pnpm run compile` log
- Steps to reproduce + screenshot
- DevTools Console export (View → Toggle Developer Tools)

## Release

Tag `v*` triggers `.github/workflows/release.yml` (`electron-builder --publish always`).

## Security

See `SECURITY.md`. Do not open public issues for `shell injection` / `openExternal` bypass.
