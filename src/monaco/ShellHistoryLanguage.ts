import * as monaco from "monaco-editor";
import {services} from "../services/index";
import * as _ from "lodash";

monaco.languages.setMonarchTokensProvider("shell-history", {
    tokenizer: {
        root: [
            {
                regex: /.+/,
                action: {token: "history-item"},
            },
        ],
    },
    defaultToken: "invalid",
    tokenPostfix: ".shell-history",
});

monaco.languages.register({
    id: "shell-history",
});

monaco.languages.registerCompletionItemProvider("shell-history", {
    triggerCharacters: [" ", "/"],
    provideCompletionItems: (
        model: monaco.editor.ITextModel,
        position: monaco.Position,
        context: monaco.languages.CompletionContext,
        token: monaco.CancellationToken,
    ): monaco.languages.CompletionList => {
        void model;
        void position;
        void context;
        void token;
        return {
            incomplete: false,
            suggestions: _.uniqBy(services.history.all, record => record.command).map(record => ({
                label: record.command,
                kind: monaco.languages.CompletionItemKind.Text,
                insertText: record.command,
                range: {
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: 1,
                    endColumn: 1,
                },
            })),
        };
    },
});

monaco.languages.setLanguageConfiguration("shell-history", {
    wordPattern: /.*/g,
});
