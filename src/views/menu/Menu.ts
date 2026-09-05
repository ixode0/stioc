import {KeyboardAction} from "../../Enums";
// TODO: migrate remote -> electronAPI
import {getAcceleratorForAction} from "../keyevents/Keybindings";
import {ApplicationComponent} from "../ApplicationComponent";
import {services} from "../../services";

export function buildMenuTemplate(
    app: Electron.App,
    browserWindow: Electron.BrowserWindow,
    application: ApplicationComponent,
): Electron.MenuItemConstructorOptions[] {
    return [
        {
            label: "Upterm",
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                {
                    label: "Quit",
                    accelerator: getAcceleratorForAction(KeyboardAction.uptermQuit),
                    click: () => {
                        app.quit();
                    },
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                {
                    label: "Copy",
                    accelerator: getAcceleratorForAction(KeyboardAction.clipboardCopy),
                    role: "copy",
                },
                {
                    label: "Paste",
                    accelerator: getAcceleratorForAction(KeyboardAction.clipboardPaste),
                    role: "paste",
                },
                {
                    label: "Find",
                    accelerator: getAcceleratorForAction(KeyboardAction.editFind),
                    click: () => {
                        (document.querySelector("input[type=search]") as HTMLInputElement).select();
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: "Increase Font Size",
                    accelerator: getAcceleratorForAction(KeyboardAction.increaseFontSize),
                    click: () => {
                        services.font.increaseSize();
                    },
                },
                {
                    label: "Decrease Font Size",
                    accelerator: getAcceleratorForAction(KeyboardAction.decreaseFontSize),
                    click: () => {
                        services.font.decreaseSize();
                    },
                },
                {
                    label: "Reset Font Size",
                    accelerator: getAcceleratorForAction(KeyboardAction.resetFontSize),
                    click: () => {
                        services.font.resetSize();
                    },
                },
            ],
        },
        {
            label: "View",
            submenu: [
                {
                    label: "Toggle Full Screen",
                    accelerator: getAcceleratorForAction(KeyboardAction.viewToggleFullScreen),
                    click: () => {
                        browserWindow.setFullScreen(!browserWindow.isFullScreen());
                    },
                },
                {
                    label: "Toggle Developer Tools",
                    accelerator: getAcceleratorForAction(KeyboardAction.toggleDeveloperTools),
                    // B1: DevTools menu only in dev. Packaged state comes from main
                    // via electronAPI.isPackaged() (async) — never from a sync
                    // app.isPackaged prop (unreliable in the renderer). Default hidden;
                    // refreshMenuDevToolsVisibility() below flips it once resolved.
                    // Main also denies window-toggle-devtools IPC in packaged builds.
                    visible: false,
                    click: () => {
                        (window as any).electronAPI?.windowControls?.toggleDevTools?.()?.catch?.(() => {
                            browserWindow.webContents.toggleDevTools();
                        });
                    },
                },
                { type: "separator" },
                // #341 Toggle Menubar (Linux): Alt toggles menu bar visibility. Visible only on Linux, but accelerator Alt works cross-platform.
                {
                    label: "Toggle Menu Bar",
                    accelerator: "Alt",
                    // On macOS menu bar is always visible; on Linux/Win allow toggle. Keep visible for Linux per issue #341.
                    visible: process.platform === "linux",
                    click: () => {
                        const isVisible = browserWindow.isMenuBarVisible();
                        browserWindow.setAutoHideMenuBar(!isVisible);
                        browserWindow.setMenuBarVisibility(!isVisible);
                    },
                },
            ],
        },
        {
            label: "Session",
            submenu: [
                {
                    label: "Other Session",
                    accelerator: getAcceleratorForAction(KeyboardAction.otherSession),
                    click: () => {
                        application.otherSession();
                    },
                },
                {
                    label: "Close Current Session",
                    accelerator: getAcceleratorForAction(KeyboardAction.sessionClose),
                    click: () => {
                        application.closeFocusedSession();
                    },
                },
            ],
        },
        {
            label: "Tab",
            submenu: [
                {
                    label: "New Tab",
                    accelerator: getAcceleratorForAction(KeyboardAction.tabNew),
                    click: () => {
                        application.addTab();
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: "Previous Tab",
                    accelerator: getAcceleratorForAction(KeyboardAction.tabPrevious),
                    click: () => {
                        application.focusPreviousTab();
                    },
                },
                {
                    label: "Next Tab",
                    accelerator: getAcceleratorForAction(KeyboardAction.tabNext),
                    click: () => {
                        application.focusNextTab();
                    },
                },
                {
                    type: "separator",
                },
                {
                    label: "Close Current Tab",
                    click: () => {
                        application.closeFocusedTab();
                    },
                },
            ],
        },
        {
            role: "window",
            submenu: [
                { role: "minimize" },
                { role: "close" },
            ],
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "GitHub Repository",
                    click: () => {
                        /* tslint:disable:no-unused-expression */
                        (window as any).electronAPI?.openExternal("https://github.com/ixode0/stioc")
                            ?.catch?.(() => {});
                    },
                },
                {
                    label: "Leave Feedback",
                    click: () => {
                        /* tslint:disable:no-unused-expression */
                        (window as any).electronAPI?.openExternal("https://github.com/ixode0/stioc/issues")
                            ?.catch?.(() => {});
                    },
                },
            ],
        },
    ];
}

// DevTools menu visibility is resolved async via electronAPI.isPackaged().
// Call after building the menu (e.g. in Main.tsx) to unhide in dev only.
export async function refreshMenuDevToolsVisibility(
    menu: Electron.Menu,
    isPackaged?: boolean,
): Promise<void> {
    try {
        let packaged = isPackaged;
        if (packaged === undefined) {
            packaged = await (window as any).electronAPI?.isPackaged?.();
        }
        if (packaged === false) {
            // find "Toggle Developer Tools" item and show it
            const walk = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
                for (const it of items) {
                    if (it.label === "Toggle Developer Tools") return it;
                    const sub = (it as any)?.submenu?.items as Electron.MenuItem[] | undefined;
                    if (sub) { const found = walk(sub); if (found) return found; }
                }
                return undefined;
            };
            const item = walk(menu.items);
            if (item) (item as any).visible = true;
        }
    } catch {}
}
