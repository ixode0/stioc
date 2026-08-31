import {Observable, Subject, fromEvent} from "rxjs";

export class WindowService {
    readonly onResize: Observable<{}>;
    readonly onClose = new Subject<{}>();
    readonly onBoundsChange: Observable<Electron.Rectangle>;

    constructor() {
        this.onResize = fromEvent(window, "resize") as unknown as Observable<{}>;
        // bounds via main IPC
        this.onBoundsChange = new Observable<Electron.Rectangle>((sub) => {
            const api: any = (window as any).electronAPI;
            api?.onWindowBoundsChanged?.((b: Electron.Rectangle) => sub.next(b));
            const handler = () => api?.getWindowBounds?.().then((b: Electron.Rectangle) => sub.next(b)).catch(()=>{});
            window.addEventListener("resize", handler);
            return () => window.removeEventListener("resize", handler);
        });
        window.onbeforeunload = () => {
            this.onClose.next({} as any);
        };
        window.addEventListener("resize", () => {
            const api: any = (window as any).electronAPI;
            api?.getWindowBounds?.().then((_b: Electron.Rectangle) => {}).catch(()=>{});
        });
    }

    // #420 helper to set BrowserWindow title from renderer (delegates to preload)
    async setTitle(title: string): Promise<void> {
        const api: any = (window as any).electronAPI;
        if (api?.setTitle) {
            await api.setTitle(title);
        } else if (api?.setWindowTitle) {
            await api.setWindowTitle(title);
        }
    }
}
