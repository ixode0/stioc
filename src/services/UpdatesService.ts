// Renderer-safe update status: version via electronAPI.getVersion(), update
// trigger via electronAPI.checkForUpdates() (autoUpdater lives in main only).
// Never import node:https or electron-updater here — both crash the renderer.

export class UpdatesService {
    isAvailable = false;
    private currentVersion = "v0.0.0";
    // B3: version is resolved async via electronAPI.getVersion(); don't compare
    // against the "v0.0.0" placeholder before it resolves (false "update available").
    private versionResolved = false;
    private INTERVAL = 1000 * 60 * 60 * 12;

    constructor() {
        if (process.env.NODE_ENV === "test") {
            return;
        }
        // B3: update checks are prod-only (dev/test builds must not hit the API
        // nor trigger electron-updater).
        if (process.env.NODE_ENV !== "production") {
            return;
        }

        if (typeof window !== "undefined" && (window as any).electronAPI?.getVersion) {
            (window as any).electronAPI.getVersion().then((v: string) => {
                if (typeof v === "string" && v.trim()) {
                    this.currentVersion = "v" + v.trim();
                }
                this.versionResolved = true;
                this.checkUpdate();
            }).catch(() => {
                // keep placeholder version but allow future checks once resolved elsewhere
                this.versionResolved = false;
            });
        } else if (typeof window === "undefined") {
            // Main process only: lazy electron-updater import (never in renderer).
            // Main should prefer the "check-for-updates" IPC handler in Main.ts.
            this.versionResolved = true;
            this.checkUpdate();
        } else {
            this.versionResolved = true;
            this.checkUpdate();
        }
        setInterval(() => this.checkUpdate(), this.INTERVAL);
    }

    checkForUpdatesAndNotify(): void {
        // Renderer delegates to main via IPC; main runs autoUpdater.
        if (process.env.NODE_ENV !== "production") {
            return;
        }
        try {
            const api: any = (typeof window !== "undefined") ? (window as any).electronAPI : undefined;
            if (api?.checkForUpdates) {
                api.checkForUpdates().catch(() => {});
                return;
            }
            if (typeof window === "undefined") {
                // Main-process fallback: dynamic import only, never static.
                (new Function("return import('electron-updater')")() as Promise<any>)
                    .then((mod) => mod.autoUpdater.checkForUpdatesAndNotify())
                    .catch(() => {});
            }
        } catch {
            // ignore in renderer or test environment
        }
    }

    private checkUpdate() {
        // B3: wait for the real version; never compare against the placeholder.
        if (this.isAvailable || !this.versionResolved) {
            return;
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
            return;
        }

        // Renderer-safe: fetch() instead of node:https (which crashes sandbox).
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => { try { ctrl.abort(); } catch {} }, 15000);
            fetch("https://api.github.com/repos/ixode0/stioc/releases/latest", {
                headers: {"User-Agent": "STIOC", "Accept": "application/vnd.github+json"},
                signal: ctrl.signal,
            }).then(async (res) => {
                clearTimeout(t);
                // B3: non-200 (rate-limit HTML page etc.) must not reach JSON.parse.
                if (!res.ok) return;
                let text = "";
                try { text = (await res.text()).slice(0, 65536); } catch { return; }
                // B3: malformed/rate-limited bodies must not crash the renderer.
                try {
                    const parsed = JSON.parse(text);
                    if (parsed && typeof parsed.tag_name === "string") {
                        this.isAvailable = parsed.tag_name !== this.currentVersion;
                    }
                } catch {
                    // ignore: transient network/API error, retry on next interval
                }
            }).catch(() => {
                clearTimeout(t);
                // ignore transient network/DNS errors
            });
        } catch {
            return;
        }
    }
}
