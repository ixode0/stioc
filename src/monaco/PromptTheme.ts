import * as monaco from "monaco-editor";
import {backgroundColor, colors, textColor} from "../views/css/colors";

/**
 * CSS vars mirrored in JS:
 * --background-color, --text-color, --black-color, etc are defined in src/views/css/styles.ts: application()
 * Monaco themes below use the same JS constants so editor colors stay in sync with CSS vars.
 * MarkerSeverity is `monaco.MarkerSeverity.Error` (not deprecated monaco.editor.MarkerSeverity).
 */

const rules: monaco.editor.ITokenThemeRule[] = [
    {token: "string", foreground: colors.green.slice(1)},
    {token: "string.invalid", foreground: colors.red.slice(1)},
    {token: "variable-name", foreground: colors.yellow.slice(1)},
    {token: "variable-value", foreground: textColor.slice(1)},
    {token: "command-name", foreground: colors.blue.slice(1), fontStyle: "bold"},
    {token: "argument", foreground: textColor.slice(1)},
    {token: "redirect-path", foreground: colors.yellow.slice(1)},
    {token: "pipe", foreground: colors.yellow.slice(1)},
    {token: "semicolon", foreground: colors.yellow.slice(1)},
    {token: "and", foreground: colors.yellow.slice(1)},
    {token: "or", foreground: colors.yellow.slice(1)},
    {token: "appending-output-redirection-symbol", foreground: colors.yellow.slice(1)},
    {token: "input-redirection-symbol", foreground: colors.yellow.slice(1)},
    {token: "output-redirection-symbol", foreground: colors.yellow.slice(1)},
];

const darkColors: monaco.editor.IStandaloneThemeData["colors"] = {
    "editor.foreground": textColor,
    "editor.background": backgroundColor,
    "editor.lineHighlightBackground": backgroundColor,
    "editorSuggestWidget.background": backgroundColor,
    "editorSuggestWidget.highlightForeground": colors.blue,
    "editorCursor.foreground": textColor,
    "editorLineNumber.foreground": colors.white,
};

// Light theme variant – uses vs base but keeps upterm palette tweaked for light bg
const lightBackground = "#FAFAFA";
const lightForeground = "#333333";
const lightColors: monaco.editor.IStandaloneThemeData["colors"] = {
    "editor.foreground": lightForeground,
    "editor.background": lightBackground,
    "editor.lineHighlightBackground": lightBackground,
    "editorSuggestWidget.background": lightBackground,
    "editorSuggestWidget.highlightForeground": colors.blue,
    "editorCursor.foreground": lightForeground,
    "editorLineNumber.foreground": colors.black,
};

// Legacy name – kept for backward compat (alias to dark)
monaco.editor.defineTheme("upterm-prompt-theme", {
    base: "vs-dark",
    inherit: true,
    rules,
    colors: darkColors,
});

monaco.editor.defineTheme("upterm-prompt-theme-dark", {
    base: "vs-dark",
    inherit: true,
    rules,
    colors: darkColors,
});

monaco.editor.defineTheme("upterm-prompt-theme-light", {
    base: "vs",
    inherit: true,
    rules,
    colors: lightColors,
});

export function getPreferredPromptTheme(): string {
    try {
        if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
            return "upterm-prompt-theme-light";
        }
    } catch {
        // ignore
    }
    return "upterm-prompt-theme-dark";
}

// Synchronize CSS vars for theme – optional helper used by ApplicationComponent
export function applyThemeCssVars(isDark: boolean): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const bg = isDark ? backgroundColor : lightBackground;
    const fg = isDark ? textColor : lightForeground;
    root.style.setProperty("--background-color", bg);
    root.style.setProperty("--text-color", fg);
    root.style.setProperty("--editor-background", bg);
    root.style.setProperty("--editor-foreground", fg);
}
