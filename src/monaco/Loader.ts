import * as monaco from "monaco-editor";
import "monaco-editor/esm/vs/editor/editor.api";

export function requireMonaco(callback: () => void): void {
    // Monaco is now loaded via ESM imports above; no AMD loader needed.
    // Keep the callback API for backwards compatibility.
    if (typeof callback === "function") {
        callback();
    }
    // Ensure monaco is referenced so imports are not tree-shaken away
    void monaco;
}
