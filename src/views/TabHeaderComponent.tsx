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
    private shareUrl?: string;
    private handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const api: any = (window as any).electronAPI;
        if (!api?.shareStart) return;
        try {
            if (this.shareUrl) {
                await api.shareStop();
                this.shareUrl = undefined;
                (window as any).alert?.("Share stopped");
                this.forceUpdate();
                return;
            }
            const url: string = await api.shareStart();
            this.shareUrl = url;
            try { await navigator.clipboard.writeText(url); } catch {}
            (window as any).alert?.(`Share started: ${url}\n(Copied to clipboard)`);
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
                <span onClick={this.handleShare} title={this.shareUrl ? `Stop share ${this.shareUrl}` : "Share terminal (one click)"} style={{marginLeft:6, cursor:"pointer", fontSize:12, opacity:0.8}}>
                    {this.shareUrl ? "● Share" : "○ Share"}
                </span>
            </li>
        );
    }
}
