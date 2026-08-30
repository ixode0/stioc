import * as https from "https";
import {autoUpdater} from "electron-updater";
// TODO: migrate remote -> electronAPI

export class UpdatesService {
    isAvailable = false;
    private currentVersion!: string;
    private INTERVAL = 1000 * 60 * 60 * 12;

    constructor() {
        if (process.env.NODE_ENV === "test") {
            return;
        }

        // TODO: migrate remote -> electronAPI: was "v" + remote.app.getVersion()
        this.currentVersion = "v0.0.0";
        // async fetch via window.electronAPI.getVersion()
        if (typeof window !== "undefined" && (window as any).electronAPI?.getVersion) {
            (window as any).electronAPI.getVersion().then((v: string) => { this.currentVersion = "v" + v; });
        }
        this.checkUpdate();
        setInterval(() => this.checkUpdate(), this.INTERVAL);
    }

    checkForUpdatesAndNotify(): void {
        try {
            autoUpdater.checkForUpdatesAndNotify();
        } catch {
            // ignore in renderer or test environment
        }
    }

    private checkUpdate() {
        if (this.isAvailable || !navigator.onLine) {
            return;
        }

        https.get(
            {
                host: "api.github.com",
                path: "/repos/ixode0/stioc/releases/latest",
                headers: {
                    "User-Agent": "STIOC",
                },
            },
            (response) => {
                let body = "";
                response.on("data", data => body += data);
                response.on("end", () => {
                    const parsed = JSON.parse(body);
                    this.isAvailable = parsed.tag_name !== this.currentVersion;
                });
            },
        );
    }
}
