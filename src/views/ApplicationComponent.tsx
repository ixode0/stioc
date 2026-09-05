import {type as osType} from "os";
import * as React from "react";
// @ts-ignore
import {ipcRenderer} from "electron";
import * as classNamesModule from "classnames";
const classNames: any = (classNamesModule as any).default ?? classNamesModule;
import {TabHeaderComponent, Props} from "./TabHeaderComponent";
import * as css from "./css/styles";
import {SearchComponent} from "./SearchComponent";
import {TabComponent} from "./TabComponent";
import {SessionID} from "../shell/Session";
import {services} from "../services";
import * as _ from "lodash";
import {userFriendlyPath} from "../utils/Common";

type ApplicationState = {
    tabs: Array<{id: number, sessionIDs: SessionID[]; focusedSessionID: SessionID}>;
    focusedTabIndex: number;
};

export class ApplicationComponent extends React.Component<{}, ApplicationState> {
    tabComponents!: TabComponent[];
    // Share routing: token -> tab id owning the share (set via TabHeader onShareChange).
    // Tab id (stable) is used, not tab index (shifts on removeTab). Cleaned in
    // removeTabFromState so closed tabs never receive viewer input/output.
    // Viewer input is routed by token to that tab's focused session; unknown tokens are dropped.
    // PTY output is routed per-job: each job pushes only to its owner tab's token.
    private shareTokens = new Map<string, number>();

    constructor(props: {}) {
        super(props);

        const sessionID = services.sessions.create();
        this.state = {
            tabs: [{
                id: Date.now(),
                sessionIDs: [sessionID],
                focusedSessionID: sessionID,
            }],
            focusedTabIndex: 0,
        };

        services.window.onResize.subscribe(() => this.resizeAllSessions());
        services.window.onClose.subscribe(() => services.sessions.closeAll());
        services.sessions.onClose.subscribe(id => this.removeSessionFromState(id));
        // #372/#385 font change must resize ALL sessions incl. split: resizeAllSessions iterates every TabComponent.sessionComponents
        services.font.onChange.subscribe(() => {
            this.forceUpdate();
            // Verify: resizeAllSessions handles split (2 sessions per tab) correctly – iterates all tabComponents
            this.resizeAllSessions();
        });

        ipcRenderer.on("change-working-directory", (_event: any, directory: string) =>
            this.focusedSession.directory = directory,
        );

        // Share: WS input -> owning tab's session PTY (routed by token, M1).
        // Unknown token => drop + warn (never leak into the focused session).
        // Token-less (legacy single-share) => focused session as before.
        const api: any = (window as any).electronAPI;
        api?.onShareInput?.((data: string, token?: string) => {
            try {
                if (token) {
                    const tabId = this.shareTokens.get(token);
                    if (tabId === undefined) { try { console.warn(`[share] input with unknown token dropped (${String(token).slice(0,8)}…)`); } catch {} return; }
                    const tab = this.state.tabs.find(t => t.id === tabId);
                    if (!tab) { try { console.warn(`[share] input for dead tab dropped`); } catch {} return; }
                    const session = services.sessions.get(tab.focusedSessionID);
                    session?.lastJob?.write(data);
                    return;
                }
                this.focusedSession.lastJob?.write(data);
            } catch {}
        });
        // Share: route each job's PTY output only to its owner tab's token (C3).
        // Broadcasting every job into every token leaked tab A's output to tab B's
        // viewers. With no shares registered we send one legacy token-less push
        // (ShareServer delivers it only when exactly one share exists).
        const tokenForTab = (tabId: number): string | undefined => {
            for (const [tok, id] of this.shareTokens.entries()) {
                if (id === tabId) return tok;
            }
            return undefined;
        };
        const pushJobOutput = (job: {session?: {id?: unknown}}, d: string) => {
            try {
                if (this.shareTokens.size === 0) { api?.sharePush?.(d).catch(()=>{}); return; }
                const sessionId = (job as any)?.session?.id;
                const tab = this.state.tabs.find(t => t.sessionIDs.includes(sessionId));
                if (!tab) return;
                const token = tokenForTab(tab.id);
                if (!token) return; // this tab is not shared — don't leak into other tabs' shares
                api?.sharePush?.(d, token).catch(()=>{});
            } catch {}
        };
        services.jobs.onStart.subscribe((job) => {
            const out: any = (job as any).output;
            if (out?.on) out.on("data", (d: string) => pushJobOutput(job, d));
            // also job-level data
            job.on("data", () => {
                try { const txt = out?.toString?.()?.slice(-4000); if (txt) pushJobOutput(job, txt); } catch {}
            });
        });

        // #420 Window title sync: sync on mount and when focused session/title/directory changes
        this.syncWindowTitle = this.syncWindowTitle.bind(this);
    }

    componentDidMount() {
        this.syncWindowTitle();
        // Subscribe to title-changed of current focused session; re-subscribe on focus change in componentDidUpdate
        this.subscribeTitleChanges();
    }

    componentDidUpdate(_prevProps: {}, prevState: ApplicationState) {
        if (prevState.focusedTabIndex !== this.state.focusedTabIndex ||
            prevState.tabs[prevState.focusedTabIndex]?.focusedSessionID !== this.state.tabs[this.state.focusedTabIndex]?.focusedSessionID) {
            this.subscribeTitleChanges();
        }
        this.syncWindowTitle();
    }

    componentWillUnmount() {
        this.unsubscribeTitleChanges();
    }

    private titleChangeListener?: () => void;
    private subscribedSessionID?: SessionID;

    private subscribeTitleChanges() {
        this.unsubscribeTitleChanges();
        try {
            const session = this.focusedSession;
            if (!session) return;
            this.subscribedSessionID = session.id;
            const handler = () => this.syncWindowTitle();
            (session as any).on("title-changed", handler);
            this.titleChangeListener = () => (session as any).removeListener("title-changed", handler);
        } catch {}
    }

    private unsubscribeTitleChanges() {
        try {
            if (this.titleChangeListener) {
                this.titleChangeListener();
                this.titleChangeListener = undefined;
            }
        } catch {}
    }

    private syncWindowTitle() {
        try {
            const session = this.focusedSession;
            if (!session) return;
            // #420 custom title via session.title, fallback to directory
            const rawTitle: string = (session as any).title ?? (session as any).directory ?? "Upterm";
            const displayTitle = rawTitle && rawTitle.trim() ? rawTitle : userFriendlyPath((session as any).directory ?? "") || "Upterm";
            // Update document.title for in-window title and for BrowserWindow via IPC
            if (typeof document !== "undefined") {
                document.title = displayTitle;
            }
            // Propagate to BrowserWindow title via preload bridge
            const api: any = (window as any).electronAPI;
            if (api?.setTitle) {
                api.setTitle(displayTitle).catch(() => {});
            } else if (api?.setWindowTitle) {
                api.setWindowTitle(displayTitle).catch(() => {});
            } else {
                // Fallback via ipcRenderer if contextIsolation disabled in tests
                try { ipcRenderer.send("set-title", displayTitle); } catch {}
            }
        } catch {}
    }

    render() {
        let tabs: React.ReactElement<Props>[] | undefined;

        if (this.state.tabs.length > 1) {
            tabs = this.state.tabs.map((tab, index: number) =>
                <TabHeaderComponent
                    isFocused={index === this.state.focusedTabIndex}
                    key={tab.id}
                    position={index + 1}
                    activate={() => this.setState({focusedTabIndex: index})}
                    onShareChange={(token, prevToken) => this.handleShareChange(tab.id, token, prevToken)}
                    closeHandler={(event: React.MouseEvent<HTMLSpanElement>) => {
                        services.sessions.close(this.state.tabs[index].sessionIDs);
                        event.stopPropagation();
                        event.preventDefault();
                    }}
                />,
            );
        }

        this.tabComponents = [];

        return (
            // @ts-ignore
            <div className="application" style={css.application() as any}>
                <div className={classNames("title-bar", {"reversed": this.isMacOS()})}>
                    <SearchComponent/>
                    <ul className="tabs">{tabs}</ul>
                </div>
                {this.state.tabs.map((tabProps, index) =>
                    // @ts-ignore
                    <TabComponent {...tabProps}
                                  isFocused={index === this.state.focusedTabIndex}
                                  key={tabProps.id}
                                  onSessionFocus={(id: SessionID) => {
                                      const state = this.cloneState();
                                      state.tabs[state.focusedTabIndex].focusedSessionID = id;
                                      this.setState(state);
                                  }}
                                  // @ts-ignore
                                  ref={tabComponent => this.tabComponents[index] = tabComponent! as any}/>)}
            </div>
        );
    }

    /**
     * is Mac OS
     */

    isMacOS() {
      return "Darwin" === osType();
    }

    /**
     * Tab methods.
     */

    get focusedTabComponent() {
        return this.tabComponents[this.state.focusedTabIndex];
    }

    addTab(): void {
        if (this.state.tabs.length < 9) {
            const id = services.sessions.create();

            const state = this.cloneState();
            state.tabs.push({
                id: Date.now(),
                sessionIDs: [id],
                focusedSessionID: id,
            });
            state.focusedTabIndex = state.tabs.length - 1;

            this.setState(state);
        } else {
            (window as any).electronAPI?.beep?.().catch(()=>{});
        }
    }

    focusPreviousTab() {
        if (this.state.focusedTabIndex !== 0) {
            this.focusTab(this.state.focusedTabIndex - 1);
        }
    }

    focusNextTab() {
        if (this.state.focusedTabIndex !== this.state.tabs.length - 1) {
            this.focusTab(this.state.focusedTabIndex + 1);
        }
    }

    focusTab(index: number): void {
        if (index === 8) {
            index = this.state.tabs.length - 1;
        }

        if (this.state.tabs.length > index) {
            this.setState({focusedTabIndex: index});
        } else {
            (window as any).electronAPI?.beep?.().catch(()=>{});
        }
    }

    closeFocusedTab() {
        const sessionIDs = this.state.tabs[this.state.focusedTabIndex].sessionIDs;
        services.sessions.close(sessionIDs);
    }

    /**
     * Session methods.
     */

    get focusedSession() {
        return services.sessions.get(this.state.tabs[this.state.focusedTabIndex].focusedSessionID);
    }

    // Called by TabHeaderComponent when its per-tab share starts/stops.
    // Keyed by stable tab id (not index — indices shift on removeTab).
    private handleShareChange = (tabId: number, token: string | undefined, prevToken?: string) => {
        try {
            if (prevToken) this.shareTokens.delete(prevToken);
            // Remove any stale token previously bound to this tab.
            for (const [tok, id] of [...this.shareTokens.entries()]) {
                if (id === tabId && tok !== token) this.shareTokens.delete(tok);
            }
            if (token) this.shareTokens.set(token, tabId);
        } catch {}
    };

    // Drop share routing for a closed tab so its tokens never resolve to a
    // recycled index. Best-effort revoke server-side (tab close = share over).
    private cleanupShareTokensForTab(tabId: number) {
        try {
            const api: any = (window as any).electronAPI;
            for (const [tok, id] of [...this.shareTokens.entries()]) {
                if (id === tabId) {
                    this.shareTokens.delete(tok);
                    try { api?.shareStop?.(tok)?.catch?.(()=>{}); } catch {}
                }
            }
        } catch {}
    }

    closeFocusedSession() {
        services.sessions.close(this.focusedSession.id);
    }

    /**
     * #372 split screen: support up to 2 sessions per tab.
     * data-side-by-side={len===2} in TabComponent handles CSS grid split.
     * - len < 2: create new session and split view, then resize both sessions (resizeTabSessions)
     * - len === 2: toggle focus between the two sessions (no new session).
     * Max 2 keeps layout simple and avoids graphical glitches (#385).
     */
    otherSession(): void {
        const state = this.cloneState();
        const tabState = state.tabs[state.focusedTabIndex];

        if (tabState.sessionIDs.length < 2) {
            const id = services.sessions.create();
            tabState.sessionIDs.push(id);
            tabState.focusedSessionID = id;

            this.setState(state, () => {
                this.resizeTabSessions(state.focusedTabIndex);
                this.syncWindowTitle();
            });
        } else {
            // Already at max split (2) – toggle focused session
            tabState.focusedSessionID = tabState.sessionIDs.find(id => id !== tabState.focusedSessionID)!;
            this.setState(state, () => this.syncWindowTitle());
        }
    }

    private resizeTabSessions(tabIndex: number): void {
        this.tabComponents[tabIndex].sessionComponents.forEach(sessionComponent => sessionComponent.resizeSession());
    }

    // #372/#385 font.onChange must resize all sessions including split panes – iterates every TabComponent.sessionComponents
    private resizeAllSessions() {
        this.tabComponents.forEach(tabComponent => {
            tabComponent.sessionComponents.forEach(sessionComponent => sessionComponent.resizeSession());
        });
    }

    private removeSessionFromState(id: SessionID) {
        const state = this.cloneState();
        const tabIndex = state.tabs.findIndex(tabState => tabState.sessionIDs.includes(id));
        const tabState = state.tabs[tabIndex];

        if (tabState.sessionIDs.length === 1) {
            this.removeTabFromState(tabIndex);
        } else {
            const sessionIndex = tabState.sessionIDs.findIndex(id => id === tabState.focusedSessionID);
            tabState.sessionIDs.splice(sessionIndex, 1);
            tabState.focusedSessionID = tabState.sessionIDs[0];

            this.setState(state, () => this.resizeTabSessions(tabIndex));
        }
    }

    private removeTabFromState(index: number): void {
        const state = this.cloneState();
        const removed = state.tabs[index];
        if (removed) this.cleanupShareTokensForTab(removed.id);

        state.tabs.splice(index, 1);
        state.focusedTabIndex = Math.max(0, index - 1);

        if (state.tabs.length === 0) {
            ipcRenderer.send("quit");
        } else {
            this.setState(state);
        }
    }

    /**
     * Return a deep clone of the state in order not to
     * accidentally mutate it.
     */
    private cloneState(): ApplicationState {
        return _.cloneDeep(this.state);
    }
}
