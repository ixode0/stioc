import {contextBridge, ipcRenderer} from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    quit: (): Promise<void> => ipcRenderer.invoke("quit"),
    getVersion: (): Promise<string> => ipcRenderer.invoke("get-version"),
    // Updates live in main (autoUpdater); renderer only asks via IPC.
    checkForUpdates: (): Promise<{available:boolean, reason?:string}> => ipcRenderer.invoke("check-for-updates"),
    isPackaged: (): Promise<boolean> => ipcRenderer.invoke("is-packaged"),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke("open-external", url),
    // #420 Window/Tab title: renderer -> main title propagation
    setTitle: (title: string): Promise<void> => ipcRenderer.invoke("window-set-title", title),
    setWindowTitle: (title: string): Promise<void> => ipcRenderer.invoke("window-set-title", title),
    windowControls: {
        minimize: (): Promise<void> => ipcRenderer.invoke("window-minimize"),
        maximize: (): Promise<void> => ipcRenderer.invoke("window-maximize"),
        close: (): Promise<void> => ipcRenderer.invoke("window-close"),
        toggleFullScreen: (): Promise<void> => ipcRenderer.invoke("window-toggle-fullscreen"),
        toggleDevTools: (): Promise<void> => ipcRenderer.invoke("window-toggle-devtools"),
        isMaximized: (): Promise<boolean> => ipcRenderer.invoke("window-is-maximized"),
    },
    onChangeWorkingDirectory: (callback: (directory: string) => void): void => {
        ipcRenderer.on("change-working-directory", (_event: Electron.IpcRendererEvent, directory: string) => callback(directory));
    },
    shareStart: (opts?:{readOnly?:boolean, ttlMs?:number, maxClients?:number}): Promise<{url:string,publicUrl?:string,token:string,expiresAt:number}> => ipcRenderer.invoke("share-start", opts),
    sharePush: (data: string, token?:string): Promise<void> => ipcRenderer.invoke("share-push", data, token),
    shareStop: (token?:string): Promise<void> => ipcRenderer.invoke("share-stop", token),
    shareStatus: (): Promise<{running:boolean,url?:string,list:any[]}> => ipcRenderer.invoke("share-status"),
    shareRevoke: (token:string): Promise<void> => ipcRenderer.invoke("share-revoke", token),
    shareList: (): Promise<any[]> => ipcRenderer.invoke("share-list"),
    // B2: share-input now carries the originating share token for per-share filtering.
    onShareInput: (cb: (data:string, token?:string)=>void) => ipcRenderer.on("share-input", (_e, d:string, t?:string)=>cb(d, t)),
    beep: (): Promise<void> => ipcRenderer.invoke("beep"),
    getWindowBounds: (): Promise<Electron.Rectangle> => ipcRenderer.invoke("get-window-bounds"),
    onWindowBoundsChanged: (cb:(b:Electron.Rectangle)=>void)=> ipcRenderer.on("window-bounds-changed", (_e,b)=>cb(b)),
});
