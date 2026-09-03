#!/usr/bin/env bash
# STIOC installer — Share Terminal In One Click (Linux/macOS)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ixode0/stioc/master/install.sh | bash
#   ... | bash -s -- --version v0.4.11 --dir ~/Applications
#
# Linux: installs AppImage (x64) or .deb (Debian/Ubuntu) + .desktop entry + icon.
# macOS: installs STIOC.app into /Applications from dmg.
# Respects: STIOC_VERSION (default: latest), INSTALL_DIR, NO_DESKTOP=1.
set -euo pipefail

REPO="ixode0/stioc"
VERSION="${STIOC_VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Applications}"
UNINSTALL=0
PKG="appimage"   # appimage|deb (linux only)

log() { printf '[stioc-install] %s\n' "$*"; }
die() { printf '[stioc-install] ERROR: %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?}"; shift 2;;
    --dir) INSTALL_DIR="${2:?}"; shift 2;;
    --deb) PKG="deb"; shift;;
    --appimage) PKG="appimage"; shift;;
    --uninstall) UNINSTALL=1; shift;;
    -h|--help) tail -n +2 "$0" | grep '^#' | cut -c3-; exit 0;;
    *) die "unknown flag $1 (see --help)";;
  esac
done

if command -v curl >/dev/null 2>&1; then
  download() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  download() { wget -q "$1" -O "$2"; }
else
  die "need curl or wget"
fi

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$ARCH" in x86_64|amd64) ARCH=x64;; aarch64|arm64) ARCH=arm64;; *) die "unsupported arch: $ARCH";; esac

if [ "$VERSION" = "latest" ]; then
  log "resolving latest release..."
  TMP_API="$(mktemp)"; trap 'rm -f "$TMP_API"' EXIT
  download "https://api.github.com/repos/$REPO/releases/latest" "$TMP_API"
  VERSION="$(grep -m1 '"tag_name"' "$TMP_API" | cut -d'"' -f4)"
  [ -n "${VERSION:-}" ] || die "cannot resolve latest version (set --version vX.Y.Z)"
fi
VER="${VERSION#v}"
log "installing STIOC $VERSION ($OS/$ARCH)"
BASE="https://github.com/$REPO/releases/download/$VERSION"
mkdir -p "$INSTALL_DIR"

if [ "$UNINSTALL" = 1 ]; then
  rm -f "$INSTALL_DIR"/STIOC*.AppImage "$INSTALL_DIR"/STIOC.app 2>/dev/null || true
  rm -f "$HOME/.local/share/applications/stioc.desktop" "$HOME/.local/share/icons/stioc.png"
  log "removed (deb installs: sudo apt remove stioc)"
  exit 0
fi

install_linux() {
  if [ "$ARCH" != "x64" ]; then
    die "Linux $ARCH has no prebuilt binary — use --deb on x64 or build from source: git clone https://github.com/$REPO.git && pnpm install && pnpm run pack"
  fi
  if [ "$PKG" = "deb" ]; then
    command -v dpkg >/dev/null 2>&1 || die "--deb needs Debian/Ubuntu (dpkg missing)"
    DEB="$INSTALL_DIR/stioc_${VER}_amd64.deb"
    download "$BASE/stioc_${VER}_amd64.deb" "$DEB"
    log "installing .deb (may ask for sudo)..."
    sudo dpkg -i "$DEB" || sudo apt-get install -f -y
    log "done. Run: stioc"
    return 0
  fi
  APP="$INSTALL_DIR/STIOC-${VER}.AppImage"
  download "$BASE/STIOC-${VER}.AppImage" "$APP"
  chmod +x "$APP"
  # FUSE check (AppImage runtime needs it)
  if ! ldconfig -p 2>/dev/null | grep -qi fuse; then
    if command -v apt-get >/dev/null 2>&1; then HINT="sudo apt install libfuse2";
    elif command -v dnf >/dev/null 2>&1; then HINT="sudo dnf install fuse-libs";
    elif command -v pacman >/dev/null 2>&1; then HINT="sudo pacman -S fuse2";
    else HINT="install FUSE for your distro (https://docs.appimage.org)"; fi
    log "WARNING: FUSE not found — AppImage may not start. Fix: $HINT"
  fi
  if [ "${NO_DESKTOP:-0}" != "1" ]; then
    ICON_DIR="$HOME/.local/share/icons"; DESK_DIR="$HOME/.local/share/applications"
    mkdir -p "$ICON_DIR" "$DESK_DIR"
    download "https://raw.githubusercontent.com/$REPO/master/icons/256x256.png" "$ICON_DIR/stioc.png" || log "icon download skipped"
    cat > "$DESK_DIR/stioc.desktop" <<EOF
[Desktop Entry]
Name=STIOC
Comment=Share Terminal In One Click
Exec=$APP %U
Icon=$ICON_DIR/stioc.png
Terminal=false
Type=Application
Categories=Utility;TerminalEmulator;
StartupWMClass=STIOC
EOF
    command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESK_DIR" >/dev/null 2>&1 || true
    command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f "$ICON_DIR" >/dev/null 2>&1 || true
    log "desktop entry installed"
  fi
  log "done. Run: $APP  (or find STIOC in your app menu)"
}

install_mac() {
  DMG_SUFFIX="dmg"; [ "$ARCH" = "arm64" ] && DMG_SUFFIX="arm64.dmg"
  DMG="$(mktemp -d)/STIOC.dmg"; trap 'rm -rf "$(dirname "$DMG")"' EXIT
  download "$BASE/STIOC-${VER}.${DMG_SUFFIX}" "$DMG"
  MNT="$(hdiutil attach -nobrowse -readonly "$DMG" | grep -m1 '/Volumes/' | cut -f3- | sed 's/^ *//')"
  [ -n "${MNT:-}" ] || die "cannot mount dmg"
  APP_SRC="$(find "$MNT" -maxdepth 1 -name '*.app' | head -n1)"
  [ -n "${APP_SRC:-}" ] || { hdiutil detach "$MNT" -quiet; die "no .app in dmg"; }
  ditto "$APP_SRC" "/Applications/STIOC.app"
  hdiutil detach "$MNT" -quiet || true
  log "done. Run: open -a STIOC  (first launch: right-click → Open, to accept the signature)"
}

case "$OS" in
  Linux) install_linux;;
  Darwin) install_mac;;
  *) die "unsupported OS: $OS";;
esac
