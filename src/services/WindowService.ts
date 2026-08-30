import {Observable, Subject, NEVER} from "rxjs";
// TODO: migrate remote -> electronAPI

export class WindowService {
    readonly onResize: Observable<{}>;
    readonly onClose = new Subject<{}>();
    readonly onBoundsChange: Observable<Electron.Rectangle>;

    constructor() {
        // TODO: migrate remote -> electronAPI - remote.BrowserWindow removed
        // #420 Window title: ApplicationComponent now syncs session.title -> BrowserWindow via electronAPI.setTitle
        // #372 split: resize events must propagate to all sessions; ApplicationComponent.resizeAllSessions handles font+window resize
        this.onResize = NEVER as unknown as Observable<{}>;
        this.onBoundsChange = NEVER as unknown as Observable<Electron.Rectangle>;
        window.onbeforeunload = () => {
            this.onClose.next({} as any);
        };
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
