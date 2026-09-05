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

type State = { readOnly: boolean };

export class TabHeaderComponent extends React.Component<Props, State> {
    state: State = { readOnly: true };
    private share?: {url:string, publicUrl?:string, token:string, expiresAt:number};
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
                (window as any).alert?.("Share stopped — token revoked");
                this.forceUpdate();
                return;
            }
            // M3: explicit read-only toggle (checkbox) instead of hidden Alt-only.
            // Alt+click still forces read-write as a shortcut.
            const readOnly = e.altKey ? false : this.state.readOnly;
            const res: {url:string, publicUrl?:string, token:string, expiresAt:number} = await api.shareStart({readOnly});
            this.share = res;
            try { this.props.onShareChange?.(res.token); } catch {}
            const showUrl = res.publicUrl || res.url;
            const isFileUrl = showUrl.startsWith("file://");
            try {
                if (!isFileUrl) await navigator.clipboard.writeText(showUrl);
                else (window as any).alert?.("Share URL is file:// — copy it manually, clipboard is unreliable for file URLs.");
            } catch {}
            const ro = readOnly ? " (read-only)" : " (READ-WRITE — everything typed runs here!)";
            const tunnelMsg = (res as any).publicUrl ? `\nPublic tunnel: ${res.publicUrl}` : `\n(Local only — tunnel offline, use ${res.url})`;
            // Visible TTL info + clamp warning instead of silence (main clamps 1min..12h, default 1h).
            const ttlNote = `\nLink lives 1h, expires ${new Date(res.expiresAt).toLocaleTimeString()} (server clamps custom TTL to 1min..12h).`;
            (window as any).alert?.(`Share started${ro}: ${showUrl}${tunnelMsg}${ttlNote}\nToken ${res.token.slice(0,8)}… — link contains ?token=, keep it secret.\nCopied! Each tab own link, token required.`);
            this.forceUpdate();
        } catch (err: any) {
            (window as any).alert?.("Share failed: " + (err?.message||err));
        }
    };
    render() {
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
                <span onClick={this.handleShare} title={this.share ? `Stop ${this.share.url}` : "Share per-tab (click = read-only; Alt+click or checkbox = read-write)"} style={{marginLeft:6, cursor:"pointer", fontSize:12, opacity:0.8}}>
                    {this.share ? "● Share" : "○ Share"}
                </span>
                {!this.share && (
                    <label title="Share mode: checked = read-only (safe default), unchecked = read-write" style={{marginLeft:4, cursor:"pointer", fontSize:11, opacity:0.8}} onClick={(ev) => ev.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={this.state.readOnly}
                            onChange={() => this.setState({readOnly: !this.state.readOnly})}
                            onClick={(ev) => ev.stopPropagation()}
                            style={{verticalAlign:"middle", marginRight:2}}
                        />
                        RO
                    </label>
                )}
            </li>
        );
    }
}
