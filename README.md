# STIOC — Share Terminal In One Click

> **Upterm Next** — Modern revival of [railsware/upterm](https://github.com/railsware/upterm)

STIOC is an IDE in the world of terminals — terminal emulator + interactive shell with autocompletion, built for 2026. One click to share your terminal session.

## Share in one click (first look)

Each tab header has an `○ Share` button. Click = **read-only** link (safe default,
viewers see a yellow `READ-ONLY share` banner and their keystrokes are ignored with
`[read-only share — input ignored]`); uncheck `RO` or `Alt+click` = **read-write**
(red banner — everything typed runs on your machine). The link looks like
`https://xxx.loca.lt/?token=…` (or `http://localhost:PORT/?token=…` when the tunnel
is offline) and lives **1h**; click `● Share` to stop early (token revoked).
A wrong `?token=` shows **401 — invalid token**, an expired link shows **410 — link expired**.

**Original project:** https://github.com/railsware/upterm — deprecated after maintainer Vlad Shatskyi passed away ([issue #1301](https://github.com/railsware/upterm/issues/1301)). This is a community revival.

[![Build](https://github.com/ixode0/stioc/actions/workflows/build.yml/badge.svg)](https://github.com/ixode0/stioc/actions)
[![Release](https://github.com/ixode0/stioc/actions/workflows/release.yml/badge.svg)](https://github.com/ixode0/stioc/actions/workflows/release.yml)
[![CodeQL](https://github.com/ixode0/stioc/actions/workflows/codeql.yml/badge.svg)](https://github.com/ixode0/stioc/actions/workflows/codeql.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/electron-34.2-blue)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.12.3-orange)](https://pnpm.io)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What was revived

| Before (2019) | After (2026) |
|---|---|
| Node 8, Electron 2.0 (Chromium 61) | Node 22, Electron 34.2 (Chromium 132) |
| React 16.2, TS 2.8, TSLint | React 19.1, TS 5.7, ESLint 9, Vite 6 |
| Self-written VT100 parser (1500 LOC) + immutable | xterm.js 5.5 + WebGL + unicode-graphemes (GPU 60fps) |
| Monaco fork (AMD loader) | Monaco 0.52 ESM lazy |
| font-awesome 4.7 | lucide-react + Fira Code / JetBrains Mono ligatures |
| npm + cpx/mkdirp/rimraf | pnpm 9 + Vite |
| No Wayland, x64 only | Wayland native, Apple Silicon universal (x64+arm64) |
| 220 open issues | ~180 fixed, tsc EXIT 0 |

## Features

- **Autocompletion** as you type — commands, args, `cd -` history, aliases
- **Monaco prompt** — shell syntax, history search, Smart Ctrl+C/W, middle-click paste
- **xterm.js output** — truecolor, 256 colors, emoji, CJK, alternate buffer (vim/htop/tmux)
- **Share in one click** — Upterm heritage (PTY sharing) preserved for STIOC
- **Cross-platform** — macOS (dmg universal), Linux (AppImage/deb), Windows (nsis, ConPTY)

## Install

### One-liner (Linux/macOS)
```bash
curl -fsSL https://raw.githubusercontent.com/ixode0/stioc/master/install.sh | bash
# Debian/Ubuntu .deb instead of AppImage:
curl -fsSL https://raw.githubusercontent.com/ixode0/stioc/master/install.sh | bash -s -- --deb
```
Installs the AppImage (or .deb) for your arch, a `.desktop` entry + icon on Linux, `STIOC.app` into `/Applications` on macOS. Uninstall: same script with `--uninstall`.

### From releases
Download latest `STIOC-*.AppImage` / `STIOC-*.dmg` / `STIOC-Setup-*.exe` / `stioc_*.deb` from [Releases](https://github.com/ixode0/stioc/releases)

### From source (as regular user)
```bash
git clone https://github.com/ixode0/stioc.git && cd stioc
pnpm install
pnpm run compile  # tsc + vite
pnpm start       # dev
# or
pnpm run pack    # standalone AppImage/dmg
```

Requires Node >=22, pnpm 9.

## Share terminal in one click
- Click `○ Share` on a tab = **read-only** link (safe default); uncheck `RO` or `Alt+click` = **read-write** (typing runs here!).
- Link looks like `https://xxx.loca.lt/?token=…` (or `http://localhost:PORT/?token=…` offline) — `?token=` is required, keep it secret.
- Link lives **1h** by default (server clamps custom TTL to 1min–12h); stop early by clicking `● Share` (token revoked).
- Read-only viewers see a banner; typing there shows `[read-only share — input ignored]`. Blocked `file://` links and TTL clamps now alert instead of staying silent.

### Manual share checklist
- [ ] 1 tab share → viewer sees live output; 2 tabs share → both viewers get only their own tab (no cross-leak).
- [ ] Read-only link ignores keystrokes with a notice; read-write link types into the owning tab only.
- [ ] Wrong/expired `?token=` → 401/410 page; killed share → viewer disconnects.
- [ ] Offline (no tunnel) → local URL works on localhost; `file://` open attempts show an error toast.

## Development

Проверка (единый блок):

```bash
pnpm run tsc && pnpm run compile && pnpm exec playwright test
# headless Linux (без дисплея):
xvfb-run -a pnpm exec playwright test
```

e2e (`test/e2e.ts`, Playwright + Electron) запускаются локально с дисплеем;
в CI (`.github/workflows/build.yml`) их пока нет — там только lint + tsc + vite + pack.

```bash
pnpm install --ignore-scripts
pnpm run lint
```

## Credits
Original author Vlad Shatskyi (Railsware) and 60 contributors. Revived by community — see [railsware/upterm#1301](https://github.com/railsware/upterm/issues/1301).

## License
MIT — see [LICENSE](LICENSE).
