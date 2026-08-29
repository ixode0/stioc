# STIOC — Share Terminal In One Click

> **Upterm Next** — Modern revival of [railsware/upterm](https://github.com/railsware/upterm) (19.1k stars, archived 2019)

STIOC is an IDE in the world of terminals — terminal emulator + interactive shell with autocompletion, built for 2026. One click to share your terminal session.

**Original project:** https://github.com/railsware/upterm — deprecated after maintainer Vlad Shatskyi passed away ([issue #1301](https://github.com/railsware/upterm/issues/1301)). This is a community revival.

[![Build](https://github.com/ixode0/stioc/actions/workflows/build.yml/badge.svg)](https://github.com/ixode0/stioc/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933)](https://nodejs.org)
[![Electron](https://img.shields.io/badge/electron-34.2-blue)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)](https://www.typescriptlang.org)
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

### From releases
Download latest `STIOC-*.AppImage` / `STIOC-*.dmg` / `STIOC-*.exe` from [Releases](https://github.com/ixode0/stioc/releases)

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

## Development
```bash
pnpm install --ignore-scripts
npx tsc --noEmit --skipLibCheck # should be EXIT 0
pnpm run lint
```

## Credits
Original author Vlad Shatskyi (Railsware) and 60 contributors. Revived by community — see [railsware/upterm#1301](https://github.com/railsware/upterm/issues/1301).

License MIT.
