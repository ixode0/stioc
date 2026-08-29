declare module "xterm" {
    export class Terminal {
        constructor(options?: any);
        cols: number;
        rows: number;
        buffer: {
            active: {
                length: number;
                cursorX: number;
                cursorY: number;
                baseY: number;
                getLine(index: number): { translateToString(trimRight?: boolean): string } | undefined;
            };
        };
        unicode: {
            activeVersion: string;
            versions: string[];
        };
        write(data: string, callback?: () => void): void;
        writeln(data: string): void;
        resize(cols: number, rows: number): void;
        clear(): void;
        getSelection(): string;
        onData(callback: (data: string) => void): { dispose: () => void };
        onResize(callback: (e: { cols: number; rows: number }) => void): { dispose: () => void };
        onTitleChange(callback: (title: string) => void): { dispose: () => void };
        loadAddon(addon: any): void;
        open(element: HTMLElement): void;
        dispose(): void;
        focus(): void;
        blur(): void;
        selectAll(): void;
        clearSelection(): void;
    }
}

declare module "@xterm/addon-webgl" {
    export class WebglAddon {
        constructor();
        dispose(): void;
        onContextLoss(callback: () => void): void;
    }
}

declare module "@xterm/addon-canvas" {
    export class CanvasAddon {
        constructor();
        dispose(): void;
    }
}

declare module "@xterm/addon-unicode-graphemes" {
    export class UnicodeGraphemesAddon {
        constructor();
        dispose(): void;
        activate(terminal: any): void;
    }
}

declare module "@xterm/addon-search" {
    export class SearchAddon {
        constructor(options?: any);
        dispose(): void;
        findNext(term: string, options?: any): boolean;
        findPrevious(term: string, options?: any): boolean;
        clearDecorations(): void;
        activate(terminal: any): void;
    }
}
