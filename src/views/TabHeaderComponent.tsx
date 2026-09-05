/* tslint:disable:no-unused-variable */
import * as React from "react";
import {X} from "lucide-react";
import {fontAwesome} from "./css/FontAwesome";

export interface Props {
    isFocused: boolean;
    activate: () => void;
    position: number;
    closeHandler: React.EventHandler<React.MouseEvent<HTMLSpanElement>>;
    // Reports per-tab share token lifecycle to ApplicationComponent for
    // token->session routing (M1) and per-token output fan-out (C3).
    onShareChange?: (token: string | undefined, prevToken?: string) => void;
}

type Modal =
    | {kind: "started"; url: string; copied: boolean; readOnly: boolean; expiresAt: number; offline: boolean}
    | {kind: "confirm"}
    | {kind: "failed"; message: string}
    | {kind: "stopped"};

type State = { readOnly: boolean; modal: Modal | null; now: number };

const OVERLAY: React.CSSProperties = {
    position: "fixed", left: 0, top: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.55)", zIndex: 9999,
    display: "flex", alignItems: "center", justifyContent: "center",
};
const BOX: React.CSSProperties = {
    background: "#1a1d24", color: "#eee", border: "1px solid #3a4050",
    borderRadius: 8, padding: 16, width: 460, maxWidth: "90vw",
    fontFamily: "monospace", fontSize: 13,
};
const INPUT: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "6px 8px",
    background: "#0f1115", color: "#9fd6ff", border: "1px solid #3a4050",
    borderRadius: 4, fontFamily: "monospace", fontSize: 12,
};
const BTN: React.CSSProperties = {
    padding: "6px 14px", marginRight: 8, cursor: "pointer",
    background: "#2a2f3a", color: "#eee", border: "1px solid #4a5265",
    borderRadius: 4, fontFamily: "monospace", fontSize: 13,
};
const BTN_PRIMARY: React.CSSProperties = {...BTN, background: "#1f6feb", borderColor: "#1f6feb"};

function minsLeft(expiresAt: number, now: number): number {
    return Math.max(0, Math.ceil((expiresAt - now) / 60000));
}

export class TabHeaderComponent extends React.Component<Props, State> {
    state: State = { readOnly: true, modal: null, now: Date.now() };
    private share?: {url:string, publicUrl?:string, token:string, expiresAt:number};
    private timer?: any;

    componentDidMount() {
        // Ticking countdown (15s). Auto-resets ●->○ when the link expires.
        this.timer = setInterval(() => {
            const now = Date.now();
            if (this.share && now > this.share.expiresAt) {
                const prev = this.share.token;
                this.share = undefined;
                try { this.props.onShareChange?.(undefined, prev); } catch {}
                this.setState({now, modal: {kind: "stopped"}});
                return;
            }
            this.setState({now});
        }, 15000);
    }
    componentWillUnmount() {
        try { clearInterval(this.timer); } catch {}
    }

    // Explicit share entry point — NO Alt+click shortcut. The checkbox below
    // is the single control for read-only vs read-write. Writable mode
    // always asks "Точно дать полный доступ?" first (confirm modal).
    private handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const api: any = (window as any).electronAPI;
        if (!api?.shareStart) return;
        try {
            if (this.share) {
                const prev = this.share.token;
                await api.shareStop(this.share.token);
                this.share = undefined;
                try { this.props.onShareChange?.(undefined, prev); } catch {}
                this.setState({now: Date.now(), modal: {kind: "stopped"}});
                return;
            }
            if (!this.state.readOnly) {
                // Writable = full access to this machine's shell: confirm first.
                this.setState({modal: {kind: "confirm"}});
                return;
            }
            await this.startShare(true);
        } catch (err: any) {
            this.setState({modal: {kind: "failed", message: String(err?.message || err)}});
        }
    };

    private startShare = async (readOnly: boolean) => {
        const api: any = (window as any).electronAPI;
        try {
            const res: {url:string, publicUrl?:string, token:string, expiresAt:number} = await api.shareStart({readOnly});
            this.share = res;
            try { this.props.onShareChange?.(res.token); } catch {}
            const showUrl = res.publicUrl || res.url;
            let copied = false;
            try {
                if (!showUrl.startsWith("file://")) {
                    await navigator.clipboard.writeText(showUrl);
                    copied = true;
                }
            } catch {}
            this.setState({
                now: Date.now(),
                modal: {kind: "started", url: showUrl, copied, readOnly, expiresAt: res.expiresAt, offline: !res.publicUrl},
            });
        } catch (err: any) {
            this.setState({modal: {kind: "failed", message: String(err?.message || err)}});
        }
    };

    private copyLink = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            const m = this.state.modal;
            if (m?.kind === "started") this.setState({modal: {...m, copied: true}});
        } catch {
            const m = this.state.modal;
            if (m?.kind === "started") this.setState({modal: {...m, copied: false}});
        }
    };

    private openLink = (url: string) => {
        const api: any = (window as any).electronAPI;
        try {
            if (api?.openExternal && /^https?:\/\//i.test(url)) api.openExternal(url);
            else window.open(url, "_blank", "noopener");
        } catch {}
    };

    private renderModal() {
        const m = this.state.modal;
        if (!m) return null;
        const close = () => this.setState({modal: null});
        if (m.kind === "confirm") {
            return (
                <div style={OVERLAY} onClick={(e) => {e.stopPropagation(); close();}}>
                    <div style={BOX} onClick={(e) => e.stopPropagation()}>
                        <div style={{fontWeight: "bold", marginBottom: 8}}>Точно дать полный доступ? / Grant full access?</div>
                        <div style={{marginBottom: 12, lineHeight: 1.5}}>
                            Режим «Можно печатать» выполняет всё набранное в этом шелле.
                            Делитесь только с теми, кому доверяете.<br/>
                            <span style={{opacity: 0.8}}>“Can type” mode runs everything typed in this shell. Share only with people you trust.</span>
                        </div>
                        <button style={BTN} onClick={close}>Отмена / Cancel</button>
                        <button style={BTN_PRIMARY} onClick={() => {this.setState({modal: null}); this.startShare(false);}}>Да, поделиться / Yes, share</button>
                    </div>
                </div>
            );
        }
        if (m.kind === "failed") {
            return (
                <div style={OVERLAY} onClick={(e) => {e.stopPropagation(); close();}}>
                    <div style={BOX} onClick={(e) => e.stopPropagation()}>
                        <div style={{fontWeight: "bold", marginBottom: 8}}>Не получилось поделиться / Share failed</div>
                        <div style={{marginBottom: 12, wordBreak: "break-all"}}>{m.message}</div>
                        <button style={BTN_PRIMARY} onClick={close}>Закрыть / Close</button>
                    </div>
                </div>
            );
        }
        if (m.kind === "stopped") {
            return (
                <div style={OVERLAY} onClick={(e) => {e.stopPropagation(); close();}}>
                    <div style={BOX} onClick={(e) => e.stopPropagation()}>
                        <div style={{marginBottom: 12}}>Шаринг остановлен, токен отозван. / Share stopped — token revoked.</div>
                        <button style={BTN_PRIMARY} onClick={close}>Закрыть / Close</button>
                    </div>
                </div>
            );
        }
        // started — honest clipboard state + clickable link + copyable field
        const left = minsLeft(m.expiresAt, this.state.now);
        return (
            <div style={OVERLAY} onClick={(e) => {e.stopPropagation(); close();}}>
                <div style={BOX} onClick={(e) => e.stopPropagation()}>
                    <div style={{fontWeight: "bold", marginBottom: 8}}>
                        {m.readOnly ? "Только просмотр / View-only" : "Можно печатать / Can type ⚠"} — осталось {left} мин / {left} min left
                    </div>
                    <input style={INPUT} readOnly value={m.url} onFocus={(e) => e.target.select()} />
                    <div style={{margin: "8px 0"}}>
                        <button style={BTN_PRIMARY} onClick={() => this.copyLink(m.url)}>Copy</button>
                        <span style={{opacity: 0.85}}>
                            {m.copied ? "скопировано ✓ / copied ✓" : "скопируй руками: выдели ссылку и Ctrl+C / copy manually"}
                        </span>
                    </div>
                    <div style={{marginBottom: 8, wordBreak: "break-all"}}>
                        <a href={m.url} onClick={(e) => {e.preventDefault(); this.openLink(m.url);}} style={{color: "#9fd6ff"}}>{m.url}</a>
                    </div>
                    {m.offline && (
                        <div style={{marginBottom: 8, color: "#ffd666"}}>
                            Только для этого компа, без интернета (localhost). / This PC only, no internet (localhost).
                        </div>
                    )}
                    {!m.readOnly && (
                        <div style={{marginBottom: 8, color: "#ff9d9d"}}>
                            Всё набранное выполняется здесь! / Everything typed runs here!
                        </div>
                    )}
                    <button style={BTN} onClick={close}>Закрыть / Close</button>
                </div>
            </div>
        );
    }

    render() {
        const left = this.share ? minsLeft(this.share.expiresAt, this.state.now) : 0;
        const sharing = !!this.share;
        const modeLabel = "Разрешить печатать (опасно) / Allow typing (dangerous)";
        return (
            <li className="tab-header"
                data-focused={this.props.isFocused}
                onClick={this.props.activate}>

                <span className="close-button"
                      onClick={this.props.closeHandler}>
                    <X size={12} style={{verticalAlign: "middle"}} />
                    <span style={{display: "none"}}>{fontAwesome.times}</span>
                </span>

                <span>⌘{this.props.position}</span>
                <button
                    onClick={this.handleShare}
                    title={sharing ? `Stop sharing (${left} min left / осталось ${left} мин)` : "Share this tab / Поделиться вкладкой"}
                    style={{
                        marginLeft: 6, cursor: "pointer", fontSize: 14, fontWeight: "bold",
                        padding: "6px 14px", borderRadius: 6,
                        border: sharing ? "1px solid #1f6feb" : "1px solid #4a5265",
                        background: sharing ? "#1f6feb" : "#2a2f3a", color: "#fff",
                    }}>
                    {sharing ? `● Share · осталось ${left} мин` : "○ Share"}
                </button>
                {!sharing && (
                    <label title="Не отмечено = только просмотр (безопасно). Отметь «Разрешить печатать» — ввод выполняется здесь / Unchecked = view-only (safe). Check to allow typing — input runs here" style={{marginLeft: 8, cursor: "pointer", fontSize: 13, opacity: 1}} onClick={(ev) => ev.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={!this.state.readOnly}
                            onChange={() => this.setState({readOnly: !this.state.readOnly})}
                            onClick={(ev) => ev.stopPropagation()}
                            style={{verticalAlign: "middle", marginRight: 6, width: 16, height: 16}}
                        />
                        {modeLabel}
                    </label>
                )}
                {this.renderModal()}
            </li>
        );
    }
}
