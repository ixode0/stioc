/* tslint:disable:no-unused-variable */
import * as React from "react";
import {X} from "lucide-react";
import {fontAwesome} from "./css/FontAwesome";

export interface Props {
    isFocused: boolean;
    activate: () => void;
    position: number;
    closeHandler: React.EventHandler<React.MouseEvent<HTMLSpanElement>>;
}

export class TabHeaderComponent extends React.Component<Props, {}> {
    private share?: {url:string, token:string, expiresAt:number};
    private handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const api: any = (window as any).electronAPI;
        if (!api?.shareStart) return;
        try {
            if (this.share) {
                await api.shareStop(this.share.token);
                this.share = undefined;
                (window as any).alert?.("Share stopped — token revoked");
                this.forceUpdate();
                return;
            }
            const readOnly = e.shiftKey; // Shift+click = read-only
            const res: {url:string, token:string, expiresAt:number} = await api.shareStart({readOnly});
            this.share = res;
            try { await navigator.clipboard.writeText(res.url); } catch {}
            const ro = readOnly ? " (read-only, Shift)" : "";
            (window as any).alert?.(`Share started${ro}: ${res.url}\nToken ${res.token.slice(0,8)}… expires ${new Date(res.expiresAt).toLocaleTimeString()}\nCopied! Each tab has own link.`);
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
                <span onClick={this.handleShare} title={this.share ? `Stop ${this.share.url}` : "Share per-tab (Shift=read-only)"} style={{marginLeft:6, cursor:"pointer", fontSize:12, opacity:0.8}}>
                    {this.share ? "● Share" : "○ Share"}
                </span>
            </li>
        );
    }
}
