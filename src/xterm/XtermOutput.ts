import * as events from "events";
import { Terminal } from "@xterm/xterm";
import { BufferType, ScreenMode } from "../Enums";

/**
 * XtermOutput — обёртка над xterm Terminal.
 * Заменяет самописный VT100 парсер (Output.ts / node-ansiparser + immutable).
 * Issue coverage: scrollback, unicode graphemes, WebGL, search, dimensions.
 */
export class XtermOutput extends events.EventEmitter {
    public terminal: Terminal;
    private _dimensions: Dimensions;

    // Совместимость со старым Output API, используется в Job, Plugins, TerminalLikeDevice
    public isCursorKeysModeSet = false;
    public activeBufferType: BufferType = BufferType.Normal;
    public screenMode: ScreenMode = ScreenMode.Dark;

    constructor(dimensions: Dimensions) {
        super();
        this._dimensions = { ...dimensions };
        this.terminal = new Terminal({
            // @ts-ignore allowProposedApi is proposed in xterm 5.x
            allowProposedApi: true,
            convertEol: true,
            scrollback: 5000,
            fontFamily: "monospace",
            theme: {
                background: "#333",
                foreground: "#eee",
            },
            cols: dimensions.columns,
            rows: dimensions.rows,
        });

        // Intercept DEC private mode 1 (DECCKM) to keep isCursorKeysModeSet in sync
        const origWrite = this.terminal.write.bind(this.terminal);
        (this.terminal as any).write = (data: string, cb?: () => void) => {
            if (data.includes("\x1b[?1h")) this.isCursorKeysModeSet = true;
            if (data.includes("\x1b[?1l")) this.isCursorKeysModeSet = false;
            return origWrite(data, cb);
        };
    }

    setCursorKeysMode(v: boolean) { this.isCursorKeysModeSet = v; }

    /**
     * Запись данных в терминал (вызывается из PTY dataHandler).
     * Использует xterm buffer вместо собственного парсера.
     */
    write(data: string): void {
        this.terminal.write(data, () => {
            this.emit("data", data);
        });
    }

    /**
     * Изменение размера терминала.
     */
    resize(cols: number, rows: number): void {
        this._dimensions = { columns: cols, rows };
        try {
            this.terminal.resize(cols, rows);
        } catch {
            // ignore if terminal not yet opened
        }
        this.emit("resize", this._dimensions);
    }

    /**
     * Очистка буфера.
     */
    clear(): void {
        this.terminal.clear();
        this.emit("data");
    }

    /**
     * Выделенный пользователем текст.
     */
    getSelection(): string {
        return this.terminal.getSelection();
    }

    /**
     * Подписка на ввод пользователя из xterm (onData).
     */
    onData(callback: (data: string) => void): { dispose: () => void } {
        return this.terminal.onData(callback);
    }

    // ——— Совместимость со старым Output ———

    get dimensions(): Dimensions {
        return this._dimensions;
    }

    set dimensions(value: Dimensions) {
        this.resize(value.columns, value.rows);
    }

    isEmpty(): boolean {
        try {
            const lines = this.toLines();
            if (lines.length === 0) return true;
            return lines.every((l) => l.trim() === "");
        } catch {
            return this.terminal.buffer.active.length === 0;
        }
    }

    toLines(): string[] {
        const buffer = this.terminal.buffer.active;
        const lines: string[] = [];
        // buffer.length включает scrollback + viewport.
        // translateToString(true) — trim right.
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
                lines.push(line.translateToString(true));
            } else {
                lines.push("");
            }
        }
        // Убираем хвостовые пустые строки, которые xterm всегда держит для viewport
        // если они не были записаны — поведение близко к старому Output.toLines()
        // Но оставляем как есть для плагинов (Show, GitGrep, JSON) — они ожидают реальные строки.
        return lines;
    }

    toString(): string {
        return this.toLines().join("\n");
    }

    /**
     * Для OutputComponent, которому ранее нужен был activeBuffer:
     * предоставляем прокси с минимальным API, чтобы не ломать типы если кто-то ещё обратится.
     * Новый OutputComponent не использует его.
     * @deprecated
     */
    get activeBuffer(): any {
        return {
            _showCursor: true,
            _blinkCursor: true,
            cursorRowIndex: this.terminal.buffer.active.cursorY,
            cursorColumnIndex: this.terminal.buffer.active.cursorX,
            scrollbackSize: Math.max(0, this.terminal.buffer.active.length - this.terminal.rows),
            // заглушки
            map: (cb: any) => this.toLines().map((line, idx) => cb({ toArray: () => line.split("") } as any, idx)),
        };
    }

    dispose(): void {
        this.terminal.dispose();
        this.removeAllListeners();
    }
}
