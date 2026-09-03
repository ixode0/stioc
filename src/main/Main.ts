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
// Only http(s) and mailto are allowed. file:// is intentionally blocked:
// shell.openExternal with file:// opens arbitrary local files in other apps.
const ALLOWED_EXTERNAL = /^(https?:\/\/|mailto:)[^\s]*$/i;
ipcMain.handle("open-external", (_event: Electron.IpcMainInvokeEvent, url: string) => {
    if (typeof url !== "string" || url.length > 2048) throw new Error("Invalid URL");
    const trimmed = url.trim();
    if (!ALLOWED_EXTERNAL.test(trimmed)) throw new Error(`Blocked external URL: ${trimmed.slice(0, 80)}`);
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
ipcMain.handle("window-toggle-devtools", (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools());
ipcMain.handle("window-is-maximized", (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false);
// #420 Window/Tab title: support custom title via session.title -> BrowserWindow title
ipcMain.handle("window-set-title", (event: Electron.IpcMainInvokeEvent, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && typeof title === "string") {
        win.setTitle(title);
    }
});
ipcMain.on("set-title", (event: Electron.IpcMainEvent, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && typeof title === "string") {
        win.setTitle(title);
    }
});

// Share — per-session token + auto tunnel (Upterm heritage, updated 2026)
ipcMain.handle("share-start", async (_e, opts?: {readOnly?:boolean}) => {
    const res = await shareServer.start(
        (listener) => {
            (shareServer as any)._listener = listener;
            return { dispose: () => { (shareServer as any)._listener = undefined; } };
        },
        (data) => {
            for (const w of BrowserWindow.getAllWindows()) w.webContents.send("share-input", data);
        },
        opts,
    );
    return res; // {url, publicUrl, token, expiresAt}
});
ipcMain.handle("share-push", (_e, data: string, token?: string) => {
    try { (shareServer as any)._listener?.(data); } catch {}
    try { shareServer.broadcast(data, token); } catch {}
});
ipcMain.handle("share-stop", async (_e, token?: string) => { await shareServer.stop(token); });
ipcMain.handle("share-status", () => ({ running: shareServer.isRunning(), url: shareServer.getUrl(), list: shareServer.list() }));
ipcMain.handle("share-revoke", async (_e, token:string) => { await shareServer.revoke(token); });
ipcMain.handle("share-list", () => shareServer.list());
// WindowService real resize/bounds via IPC (fix NeverObservable)
ipcMain.handle("get-window-bounds", (e) => BrowserWindow.fromWebContents(e.sender)?.getBounds());
ipcMain.on("window-bounds-changed", (e, bounds: Electron.Rectangle) => {
    for (const w of BrowserWindow.getAllWindows()) if (w.webContents !== e.sender) w.webContents.send("window-bounds-changed", bounds);
});
ipcMain.handle("beep", () => shell.beep());
