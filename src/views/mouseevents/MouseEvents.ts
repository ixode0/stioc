import {ApplicationComponent} from "../ApplicationComponent";
import {MouseEvent} from "../../Interfaces";
import * as fs from "fs";
import {userFriendlyPath, escapeFilePath, normalizeDirectory} from "../../utils/Common";
import {Status} from "../../Enums";

function isDirectory(path: string): boolean {
    return fs.lstatSync(path).isDirectory();
}

function normalizePasteText(text: string): string {
    let normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (normalized.endsWith("\n") && !normalized.slice(0, -1).includes("\n")) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}

export function handleMouseEvent(application: ApplicationComponent, event: MouseEvent) {
    const sessionComponent = application.focusedTabComponent.focusedSessionComponent;
    if (!sessionComponent) {
        return;
    }

    const isJobRunning = sessionComponent.status === Status.InProgress;
    const promptComponent = sessionComponent.promptComponent;

    // #1026 middle mouse paste: button 1 (middle) -> clipboard.readText -> insert
    if ((event as any).button === 1 && event.type === "mousedown") {
        event.preventDefault();
        // @ts-ignore navigator.clipboard
        const clipboard = (navigator as any).clipboard;
        if (clipboard?.readText) {
            clipboard.readText().then((text: string) => {
                if (typeof text === "string" && text.length) {
                    const sanitized = normalizePasteText(text);
                    if (!isJobRunning) {
                        promptComponent.insertValueInPlace(sanitized);
                    } else {
                        application.focusedSession.lastJob!.write(sanitized);
                    }
                }
            }).catch(() => {
                // fallback: X11 primary selection via getSelection may already have pasted
            });
        } else {
            // fallback for environments without async clipboard: try getSelection string
            const sel = (window as any).getSelection?.()?.toString();
            if (sel) {
                const sanitized = normalizePasteText(sel);
                if (!isJobRunning) {
                    promptComponent.insertValueInPlace(sanitized);
                } else {
                    application.focusedSession.lastJob!.write(sanitized);
                }
            }
        }
        return;
    }

    if (event instanceof DragEvent) {
        const path = event.dataTransfer!.files[0].path;
        let formattedPath = userFriendlyPath(escapeFilePath(path));

        if (isDirectory(path)) {
            formattedPath = normalizeDirectory(formattedPath);
        }

        if (!isJobRunning) {
            promptComponent.insertValueInPlace(formattedPath);
        }

        event.preventDefault();
        return;
    }
}
