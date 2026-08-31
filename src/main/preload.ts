import {contextBridge, ipcRenderer} from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    quit: (): Promise<void> => ipcRenderer.invoke("quit"),
    getVersion: (): Promise<string> => ipcRenderer.invoke("get-version"),
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
    shareStart: (): Promise<string> => ipcRenderer.invoke("share-start"),
    sharePush: (data: string): Promise<void> => ipcRenderer.invoke("share-push", data),
    shareStop: (): Promise<void> => ipcRenderer.invoke("share-stop"),
    shareStatus: (): Promise<{running:boolean,url?:string}> => ipcRenderer.invoke("share-status"),
    onShareInput: (cb: (data:string)=>void) => ipcRenderer.on("share-input", (_e, d:string)=>cb(d)),
    beep: (): Promise<void> => ipcRenderer.invoke("beep"),
    getWindowBounds: (): Promise<Electron.Rectangle> => ipcRenderer.invoke("get-window-bounds"),
    onWindowBoundsChanged: (cb:(b:Electron.Rectangle)=>void)=> ipcRenderer.on("window-bounds-changed", (_e,b)=>cb(b)),
});
