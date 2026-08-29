import * as React from "react";
import {Search} from "lucide-react";
import {fontAwesome} from "./css/FontAwesome";
// TODO: migrate remote -> electronAPI

export class SearchComponent extends React.Component<{}, {}> {
    private inputRef = React.createRef<HTMLInputElement>();
    private webContents: any = {
        findInPage: (_text: string) => {},
        stopFindInPage: (_action: string) => {},
        on: (_event: string, _cb: Function) => {},
    };

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
        this.webContents.stopFindInPage("clearSelection");
        this.input.value = "";
    }

    blur() {
        this.input.blur();
    }

    private handleInput(event: React.KeyboardEvent<HTMLInputElement>) {
        const text = (event.target as HTMLInputElement).value;

        if (text) {
            this.webContents.findInPage(text);
            this.webContents.on("found-in-page", () => this.input.focus());
        } else {
            this.clearSelection();
            setTimeout(() => this.input.select(), 0);
        }
    }

    private get input(): HTMLInputElement {
        return this.inputRef.current as HTMLInputElement;
    }
}
