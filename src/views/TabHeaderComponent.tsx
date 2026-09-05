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
            // RO checkbox is the single explicit share-mode control (safe default:
            // checked = read-only). Alt+click stays as an advanced one-shot
            // shortcut (documented only in tooltip/README), not the main path.
            const readOnly = e.altKey ? false : this.state.readOnly;
            const res: {url:string, publicUrl?:string, token:string, expiresAt:number} = await api.shareStart({readOnly});
            this.share = res;
            try { this.props.onShareChange?.(res.token); } catch {}
            const showUrl = res.publicUrl || res.url;
            const isFileUrl = showUrl.startsWith("file://");
            let copied = false;
            try {
                if (!isFileUrl) { await navigator.clipboard.writeText(showUrl); copied = true; }
                else (window as any).alert?.("Share URL is file:// — copy it manually, clipboard is unreliable for file URLs.");
            } catch {}
            // Alert shows only link + expiry + copied state. Token is NOT shown
            // separately — it already lives inside ?token=, keep the link secret.
            const ro = readOnly ? " (read-only)" : " (READ-WRITE — everything typed runs here!)";
            const expiry = new Date(res.expiresAt).toLocaleTimeString();
            (window as any).alert?.(`Share started${ro}:\n${showUrl}\nExpires ${expiry} (link lives 1h).${copied ? "\nCopied to clipboard!" : ""}`);
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
                <span onClick={this.handleShare} title={this.share ? `Stop ${this.share.url}` : "Share this tab (RO checked = read-only, uncheck = read-write). Advanced: Alt+click = read-write once"} style={{marginLeft:6, cursor:"pointer", fontSize:12, opacity:0.8}}>
                    {this.share ? "● Share" : "○ Share"}
                </span>
                {!this.share && (
                    <label title="Read-only share (safe default). Uncheck for read-write — everything typed runs here" style={{marginLeft:6, cursor:"pointer", fontSize:14, opacity:1}} onClick={(ev) => ev.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={this.state.readOnly}
                            onChange={() => this.setState({readOnly: !this.state.readOnly})}
                            onClick={(ev) => ev.stopPropagation()}
                            style={{verticalAlign:"middle", marginRight:4, width:16, height:16}}
                        />
                        RO
                    </label>
                )}
            </li>
        );
    }
}
