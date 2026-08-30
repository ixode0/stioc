process.env.PATH = "/usr/local/bin:" + process.env.PATH;
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.LANG = process.env.LANG || "en_US.UTF-8";
process.env.COLORTERM = "truecolor";
process.env.TERM = "xterm-256color";

import {handleUserEvent} from "./keyevents/Keybindings";
import {handleMouseEvent} from "./mouseevents/MouseEvents";
import {loadAliasesFromConfig} from "../shell/Aliases";
import * as React from "react";
import { createRoot } from "react-dom/client";
import {ApplicationComponent} from "./ApplicationComponent";
import {loadAllPlugins} from "../PluginManager";
import {loadEnvironment} from "../shell/Environment";
import {UserEvent, MouseEvent} from "../Interfaces";

declare global {
    interface Window {
        electronAPI: {
            quit: () => Promise<void>;
            getVersion: () => Promise<string>;
            openExternal: (url: string) => Promise<void>;
            // #420 Window title propagation
            setTitle?: (title: string) => Promise<void>;
            setWindowTitle?: (title: string) => Promise<void>;
            windowControls: {
                minimize: () => Promise<void>;
                maximize: () => Promise<void>;
                close: () => Promise<void>;
                toggleFullScreen: () => Promise<void>;
                toggleDevTools: () => Promise<void>;
                isMaximized: () => Promise<boolean>;
            };
            onChangeWorkingDirectory: (callback: (directory: string) => void) => void;
        };
        search: any;
    }
}

document.addEventListener(
    "dragover",
    function(event) {
        event.preventDefault();
        return false;
    },
    false,
);

async function main() {
    // Should be required before mounting Application.
    require("../monaco/PromptTheme");
    require("../monaco/ShellLanguage");
    require("../monaco/ShellHistoryLanguage");

    // FIXME: Remove loadAllPlugins after switching to Webpack (because all the files will be loaded at start anyway).
    await Promise.all([loadAllPlugins(), loadEnvironment(), loadAliasesFromConfig()]);
    const container = document.getElementById("react-entry-point");
    if (!container) {
        throw new Error("react-entry-point not found");
    }
    const appRef = React.createRef<ApplicationComponent>();
    createRoot(container).render(<ApplicationComponent ref={appRef} />);

    // Application instance available via ref after mount; wait a tick for React 19 async mount
    // Fallback to ref callback sync if already mounted
    const getApplication = () => appRef.current as ApplicationComponent;

    const userEventHandler = (event: UserEvent) => handleUserEvent(
        getApplication(),
        window.search,
        event,
    );

    const mouseEventHandler = (event: MouseEvent) => handleMouseEvent(
        getApplication(),
        event,
    );

    document.body.addEventListener("keydown", userEventHandler, true);
    document.body.addEventListener("paste", userEventHandler, true);
    document.body.addEventListener("drop", mouseEventHandler, true);
    // #1026 middle mouse paste support
    document.body.addEventListener("mousedown", mouseEventHandler as any, true);

    require("../plugins/JobFinishedNotifications");
    require("../plugins/UpdateLastPresentWorkingDirectory");
    require("../plugins/SaveHistory");
    require("../plugins/SaveWindowBounds");
    require("../plugins/AliasSuggestions");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, false);
} else {
    main();
}
