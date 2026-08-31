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

```bash
pnpm run tsc          # typecheck
pnpm run lint
pnpm run unit-tests   # electron-mocha 13 + mocha 11 (legacy Output)
# e2e: spectron removed -> playwright placeholder
pnpm exec playwright test  # when electron playwright tests are added
```

`test/e2e.ts` is skipped until playwright electron fixture is ready.

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
