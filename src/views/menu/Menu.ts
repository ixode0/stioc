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
                    // B1: DevTools menu only in dev. app.isPackaged comes from main;
                    // process.env is unreliable in the packaged renderer.
                    visible: (app as any)?.isPackaged === false,
                    click: () => {
                        browserWindow.webContents.toggleDevTools();
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
                            ?.catch?.((err: any) => (window as any).alert?.("Can't open link: " + (err?.message || err)));
                    },
                },
                {
                    label: "Leave Feedback",
                    click: () => {
                        /* tslint:disable:no-unused-expression */
                        (window as any).electronAPI?.openExternal("https://github.com/ixode0/stioc/issues")
                            ?.catch?.((err: any) => (window as any).alert?.("Can't open link: " + (err?.message || err)));
                    },
                },
            ],
        },
    ];
}
