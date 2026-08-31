import * as React from "react";
import {Search} from "lucide-react";
import {fontAwesome} from "./css/FontAwesome";

export class SearchComponent extends React.Component<{}, {}> {
    private inputRef = React.createRef<HTMLInputElement>();

    constructor(props: any) {
        super(props);
        // FIXME: find a better design.
        window.search = this;
    }

    render() {
        return (
            <div className="search">
                <span className="search-icon">
                    <Search size={14} style={{verticalAlign: "middle"}} />
                    <span style={{display: "none"}}>{fontAwesome.search}</span>
                </span>
                <input
                    ref={this.inputRef}
                    className="search-input"
                    onInput={(event: any) => this.handleInput(event)}
                    type="search"/>
            </div>
        );
    }

    get isFocused(): boolean {
        return document.activeElement === this.input;
    }

    clearSelection(): void {
        // Search via xterm SearchAddon is wired in OutputComponent; here clear input + clear search highlight
        this.input.value = "";
        try {
            const sel = window.getSelection();
            sel?.removeAllRanges();
        } catch {}
    }

    blur() {
        this.input.blur();
    }

    private handleInput(event: React.KeyboardEvent<HTMLInputElement>) {
        const text = (event.target as HTMLInputElement).value;

        if (text) {
            try {
                (window as any).find?.(text);
            } catch {}
        } else {
            this.clearSelection();
            setTimeout(() => this.input.select(), 0);
        }
    }

    private get input(): HTMLInputElement {
        return this.inputRef.current as HTMLInputElement;
    }
}
