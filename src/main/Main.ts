import {app, ipcMain, nativeImage, BrowserWindow, screen, shell} from "electron";
import * as path from "path";
import {readFileSync} from "fs";
import {windowBoundsFilePath} from "../utils/Common";
import {shareServer} from "./ShareServer";

app.commandLine.appendSwitch("ozone-platform-hint", "auto");
app.commandLine.appendSwitch("enable-features", "UseOzonePlatform");

// #409/#1010 white-screen: GPU process crash leaves window blank on Linux/Wayland and macOS
// electron 34: 'gpu-process-crashed' deprecated -> use 'child-process-gone'
app.on("child-process-gone" as any, (_event: any, details: any) => {
    if (details && (details.type === "GPU" || details.reason === "crashed")) {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => {
            try {
                if (!w.isDestroyed() && w.webContents && !w.webContents.isDestroyed()) w.reload();
            } catch {}
        });
    }
});

// B1: DevTools allowed only in dev (unpackaged, --dev flag or STIOC_DEV=1).
// Packaged builds deny renderer-initiated DevTools toggle (XSS -> DevTools -> isolation bypass).
const allowDevTools = !app.isPackaged || process.argv.includes("--dev") || process.env.STIOC_DEV === "1";

function windowBounds(): Electron.Rectangle {
    try {
        return JSON.parse(readFileSync(windowBoundsFilePath).toString());
    } catch (error) {
        const workAreaSize = screen.getPrimaryDisplay().workAreaSize;

        return {
            width: workAreaSize.width,
            height: workAreaSize.height,
            x: 0,
            y: 0,
        };
    }
}

function createWindow(): BrowserWindow {
    const bounds = windowBounds();

    const options: Electron.BrowserWindowConstructorOptions = {
        webPreferences: {
            contextIsolation: true,
            // TODO migrate remote->electronAPI: renderer still imports os/electron,
            // fs (MouseEvents), Node (Session/PTY/History/Updates) and uses
            // require() in Main.tsx — full migration needed before sandbox:true.
            // Reverted to sandbox:false so the renderer keeps working.
            sandbox: false,
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
        },
        // #420 Window title: initial title, updated via window-set-title IPC (session.title)
        title: "STIOC",
        // #1305 Native window controls macOS: hidden titleBarStyle with traffic lights inset; reversed class handles drag region
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
        // #341 Toggle Menubar: allow Alt to toggle menu bar on Linux/Win
        autoHideMenuBar: false,
        resizable: true,
        minWidth: 500,
        minHeight: 300,
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        show: false,
    };

    const browserWindow = new BrowserWindow(options);

    if (app.dock) {
        app.dock.setIcon(nativeImage.createFromPath("build/icon.png"));
    } else {
        browserWindow.setIcon(nativeImage.createFromPath("build/icon.png"));
    }

    browserWindow.loadURL("file://" + path.join(__dirname, "..", "views", "index.html"));

    // B1: block popups / navigations away from the app (OSC-8 links, Markdown preview, window.open).
    browserWindow.webContents.setWindowOpenHandler(() => ({action: "deny"}));
    browserWindow.webContents.on("will-navigate", (event, url) => {
        if (!url.startsWith("file://")) event.preventDefault();
    });
    (browserWindow.webContents as any).on("will-attach-webview", (event: any) => event.preventDefault());

    browserWindow.webContents.on("did-finish-load", () => {
        browserWindow.show();
        browserWindow.focus();
    });

    // #409/#1010: recover from renderer crash that manifests as white-screen
    (browserWindow.webContents as any).on("render-process-gone", (_event: any, details: any) => {
        if (details && (details.reason === "crashed" || details.reason === "killed")) {
            try {
                if (!browserWindow.isDestroyed()) browserWindow.reload();
            } catch {}
        }
    });

    return browserWindow;
}

app.whenReady().then(() => {
    const browserWindow = createWindow();

    app.on("open-file", (_event: Electron.Event, file: string) => browserWindow.webContents.send("change-working-directory", file));

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => app.quit());

ipcMain.handle("quit", () => {
    app.quit();
});

ipcMain.handle("get-version", () => app.getVersion());
// Updates: autoUpdater + network checks live in main only (renderer must never
// import electron-updater or node:https — it crashes the sandboxed renderer).
// Renderer calls electronAPI.checkForUpdates() / getVersion() via IPC.
ipcMain.handle("check-for-updates", async () => {
    if (!app.isPackaged) return {available: false, reason: "dev"};
    try {
        const mod: any = await new Function("return import('electron-updater')")();
        const {autoUpdater} = mod;
        await autoUpdater.checkForUpdatesAndNotify();
        return {available: true};
    } catch (e: any) {
        return {available: false, reason: String(e?.message || e)};
    }
});
ipcMain.handle("is-packaged", () => app.isPackaged);
// Only http(s) and mailto are allowed. file:// is intentionally blocked:
// shell.openExternal with file:// opens arbitrary local files in other apps.
const ALLOWED_EXTERNAL = /^(https?:\/\/|mailto:)[^\s]*$/i;
ipcMain.handle("open-external", (_event: Electron.IpcMainInvokeEvent, url: string) => {
    if (typeof url !== "string" || url.length > 2048) throw new Error("Invalid URL");
    const trimmed = url.trim();
    // Visible error instead of silence: file:// and other schemes are rejected
    // with an error the renderer may surface (TabHeader share flow alerts).
    if (/^file:/i.test(trimmed)) throw new Error(`Blocked file:// URL (use http(s)/mailto only): ${trimmed.slice(0, 80)}`);
    if (!ALLOWED_EXTERNAL.test(trimmed)) throw new Error(`Blocked external URL (use http(s)/mailto only): ${trimmed.slice(0, 80)}`);
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "mailto:") {
            throw new Error("Blocked external URL protocol");
        }
    } catch (e) {
        if ((e as Error).message === "Blocked external URL protocol") throw e;
        throw new Error("Invalid URL");
    }
    return shell.openExternal(trimmed);
});
ipcMain.handle("window-minimize", (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)?.minimize());
ipcMain.handle("window-maximize", (event: Electron.IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
        win.unmaximize();
    } else {
        win?.maximize();
    }
});
ipcMain.handle("window-close", (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)?.close());
ipcMain.handle("window-toggle-fullscreen", (event: Electron.IpcMainInvokeEvent) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setFullScreen(!win.isFullScreen());
    }
});
ipcMain.handle("window-toggle-devtools", (event: Electron.IpcMainInvokeEvent) => {
    // B1: deny in packaged builds; DevTools is a dev-only escape hatch.
    if (!allowDevTools) throw new Error("DevTools disabled in production build");
    return BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools();
});
ipcMain.handle("window-is-maximized", (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);
// B5: title-spoofing guard — strip control chars, trim, cap length.
function sanitizeTitle(title: unknown): string | undefined {
    if (typeof title !== "string") return undefined;
    const cleaned = title.replace(/[\x00-\x1F\x7F]/g, "").trim();
    if (!cleaned) return undefined;
    return cleaned.slice(0, 140);
}
// #420 Window/Tab title: support custom title via session.title -> BrowserWindow title
ipcMain.handle("window-set-title", (event: Electron.IpcMainInvokeEvent, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const safe = sanitizeTitle(title);
    if (win && safe !== undefined) {
        win.setTitle(safe);
    }
});
ipcMain.on("set-title", (event: Electron.IpcMainEvent, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const safe = sanitizeTitle(title);
    if (win && safe !== undefined) {
        win.setTitle(safe);
    }
});

// B2: validate renderer-supplied share options (renderer must not set arbitrary TTL/clients).
// Secure defaults: readOnly=true, ttl 1h (clamped 1min..12h), maxClients 5 (clamped 1..20).
function sanitizeShareOpts(opts?: {readOnly?: boolean; ttlMs?: number; maxClients?: number}): {readOnly: boolean; ttlMs: number; maxClients: number} {
    const readOnly = opts?.readOnly === false ? false : true;
    const rawTtl = opts?.ttlMs;
    const ttlMs = (typeof rawTtl === "number" && Number.isFinite(rawTtl))
        ? Math.min(Math.max(Math.floor(rawTtl), 60_000), 12 * 60 * 60 * 1000)
        : 60 * 60 * 1000;
    const rawClients = opts?.maxClients;
    const maxClients = (typeof rawClients === "number" && Number.isFinite(rawClients))
        ? Math.min(Math.max(Math.floor(rawClients), 1), 20)
        : 5;
    return {readOnly, ttlMs, maxClients};
}
// B2: share tokens are 32 hex chars (crypto.randomBytes(16)); reject malformed input.
function sanitizeToken(token: unknown): string | undefined {
    if (typeof token !== "string") return undefined;
    const t = token.trim();
    if (!/^[0-9a-f]{32}$/i.test(t)) return undefined;
    return t;
}

// Share — per-session token + auto tunnel (Upterm heritage, updated 2026)
ipcMain.handle("share-start", async (_e, opts?: {readOnly?: boolean; ttlMs?: number; maxClients?: number}) => {
    const safeOpts = sanitizeShareOpts(opts);
    const res = await shareServer.start(
        (listener) => {
            (shareServer as any)._listener = listener;
            return { dispose: () => { (shareServer as any)._listener = undefined; } };
        },
        // B2: viewer input carries its share token; deliver to the focused window only
        // (broadcast-to-all leaked keystrokes into every window's pty). Token is attached
        // so the renderer can filter per-share in the future.
        (data, token) => {
            const focused = BrowserWindow.getFocusedWindow();
            const targets = focused ? [focused] : BrowserWindow.getAllWindows();
            for (const w of targets) {
                try { w.webContents.send("share-input", data, token); } catch {}
            }
        },
        safeOpts,
    );
    return res; // {url, publicUrl, token, expiresAt}
});
ipcMain.handle("share-push", (_e, data: string, token?: string) => {
    // B2: validate PTY output push; token routes to one share (ShareServer falls back to
    // broadcast only when exactly one share exists, otherwise token-less push is dropped
    // with a warning to avoid cross-session leaks). Renderer fans out per-token
    // (see ApplicationComponent), so multi-share stays working.
    if (typeof data !== "string" || data.length === 0) return;
    const capped = data.length > 65536 ? data.slice(-65536) : data;
    const safeToken = sanitizeToken(token);
    try { shareServer.broadcast(capped, safeToken); } catch {}
});
ipcMain.handle("share-stop", async (_e, token?: string) => {
    // Never allow a missing/malformed token to revoke ALL shares (stop(undefined)
    // tears down every share + server). Require a valid token like share-revoke.
    const safe = sanitizeToken(token);
    if (!safe) throw new Error("Invalid share token");
    await shareServer.stop(safe);
});
ipcMain.handle("share-status", () => ({ running: shareServer.isRunning(), url: shareServer.getUrl(), list: shareServer.list() }));
ipcMain.handle("share-revoke", async (_e, token: string) => {
    const safe = sanitizeToken(token);
    if (!safe) throw new Error("Invalid share token");
    await shareServer.revoke(safe);
});
ipcMain.handle("share-list", () => shareServer.list());
// WindowService real resize/bounds via IPC (fix NeverObservable)
ipcMain.handle("get-window-bounds", (e) => BrowserWindow.fromWebContents(e.sender)?.getBounds());
ipcMain.on("window-bounds-changed", (e, bounds: Electron.Rectangle) => {
    for (const w of BrowserWindow.getAllWindows()) if (w.webContents !== e.sender) w.webContents.send("window-bounds-changed", bounds);
});
ipcMain.handle("beep", () => shell.beep());
