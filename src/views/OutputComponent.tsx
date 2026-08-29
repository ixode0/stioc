import * as React from "react";
import { Job } from "../shell/Job";
import { WebglAddon } from "@xterm/addon-webgl";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { SearchAddon } from "@xterm/addon-search";

interface Props {
    job: Job;
}

/**
 * Xterm.js-backed OutputComponent.
 * Заменяет ручной React span рендер (Char + groupWhen + List<Char>).
 * Использует div ref для монтирования xterm Terminal, WebGL с fallback на canvas,
 * unicode-graphemes и SearchAddon. Проброс Job.output -> XtermOutput.write
 * осуществляется напрямую через Job.output.terminal.write (в CommandExecutor).
 */
export const OutputComponent: React.FC<Props> = ({ job }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const webglAddonRef = React.useRef<any>(null);

    React.useEffect(() => {
        const xtermOutput = job.output;
        const terminal: any = (xtermOutput as any).terminal;

        if (!terminal) {
            return;
        }

        // Unicode graphemes — корректная ширина эмодзи, CJK, combining characters
        try {
            const unicodeAddon = new UnicodeGraphemesAddon();
            terminal.loadAddon(unicodeAddon);
            // xterm 5.x proposed API
            if (terminal.unicode) {
                terminal.unicode.activeVersion = "11";
            }
        } catch (e) {
            console.warn("Failed to load UnicodeGraphemesAddon", e);
        }

        // Search addon — для будущего Cmd+F, не мешает основному рендеру
        try {
            const searchAddon = new SearchAddon();
            terminal.loadAddon(searchAddon);
        } catch (e) {
            console.warn("Failed to load SearchAddon", e);
        }

        // WebGL renderer с fallback на Canvas / DOM
        try {
            const webglAddon = new WebglAddon();
            webglAddon.onContextLoss(() => {
                try { webglAddon.dispose(); } catch {}
            });
            terminal.loadAddon(webglAddon);
            webglAddonRef.current = webglAddon;
        } catch (e) {
            console.warn("WebGL addon failed, fallback to canvas renderer", e);
            try {
                // @xterm/addon-canvas не в package.json — пробуем динамически,
                // если отсутствует — остаёмся на дефолтном DOM renderer
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const canvasModule: any = require("@xterm/addon-canvas");
                const CanvasAddon = canvasModule.CanvasAddon || canvasModule.default;
                if (CanvasAddon) {
                    const canvasAddon = new CanvasAddon();
                    terminal.loadAddon(canvasAddon);
                }
            } catch {
                // fallback — default renderer (DOM)
            }
        }

        // Монтирование в DOM
        if (containerRef.current) {
            // xterm требует, чтобы элемент был в документе перед open
            try {
                terminal.open(containerRef.current);
            } catch (e) {
                console.error("Failed to open xterm terminal", e);
            }
        }

        // Проброс Job.output -> XtermOutput.write уже происходит через PTY dataHandler
        // Здесь дополнительно слушаем job "data" для возможного скролла или ресайза
        // но сам write идёт напрямую в terminal.buffer.

        // Resize observer — если контейнер меняет размеры, синхронизируем с Job.dimensions
        // (Job.resize вызывается из Session.dimensions сеттера)
        const handleResize = () => {
            // Ничего не делаем — Session управляет размерами через PTY
        };

        return () => {
            // Не dispose терминал — он принадлежит Job (XtermOutput) и живёт до уничтожения Job
            // Только отцепляем addon если нужно
            try {
                if (webglAddonRef.current) {
                    webglAddonRef.current.dispose();
                    webglAddonRef.current = null;
                }
            } catch {}
            // Не вызываем terminal.dispose() здесь
        };
    }, [job]);

    return (
        <div
            ref={containerRef}
            className="output xterm-output"
            data-job-id={String((job as any).id)}
            // #385 Graphical glitch split: contain:layout isolates xterm paint, prevents overlap when data-side-by-side; wordWrap handled via xterm wrapper + CSS overflow hidden
            style={{ width: "100%", height: "100%", contain: "layout" as any, overflow: "hidden", wordWrap: "break-word" as any }}
        />
    );
};

// Для совместимости с предыдущим классовым импортом `import { OutputComponent }` сохраняем именованный экспорт класса-заглушки
// Заменяем класс на функциональный, но оставляем возможность `new OutputComponent` не используется.
// Экспортируем также RowComponent заглушки если где-то импортируется (не используется после миграции)
export const RowComponent: React.FC<any> = () => null;
