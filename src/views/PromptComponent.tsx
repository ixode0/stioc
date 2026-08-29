import * as monaco from "monaco-editor";
import * as _ from "lodash";
import * as React from "react";
import {Prompt} from "../shell/Prompt";
import {scan} from "../shell/Scanner";
import {Session} from "../shell/Session";
import {services} from "../services/index";

interface Props {
    session: Session;
    isFocused: boolean;
}

enum Mode {
    Normal = "normal",
    HistorySearch = "history-search",
}

interface State {
    displayedHistoryRecordID: number | undefined;
    mode: Mode;
}

export class PromptComponent extends React.Component<Props, State> {
    private prompt: Prompt;
    private editor!: monaco.editor.IStandaloneCodeEditor;
    private model = monaco.editor.createModel("", "shell", monaco.Uri.parse(`shell://${this.props.session.id}`));
    private historyModel = monaco.editor.createModel("", "shell-history", monaco.Uri.parse(`shell-history://${this.props.session.id}`));
    private promptContentRef = React.createRef<HTMLDivElement>();

    /* tslint:disable:member-ordering */
    constructor(props: Props) {
        super(props);
        this.prompt = new Prompt(this.props.session);

        this.state = {
            displayedHistoryRecordID: undefined,
            mode: Mode.Normal,
        };
    }

    // Paste normalization: \r\n -> \n, strip single trailing \n, keep multiline
    private normalizePasteText(text: string): string {
        let normalized = text.replace(/\r\n/g, "\n");
        // Also handle lone \r (old Mac) -> \n for safety, minimal change
        normalized = normalized.replace(/\r/g, "\n");
        if (normalized.endsWith("\n") && !normalized.slice(0, -1).includes("\n")) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    private debouncedTriggerSuggest = _.debounce(() => {
        const value = this.editor.getValue();
        // #1220: long paste should not trigger autocomplete that empties bar
        if (value.length > 1000) {
            return;
        }
        this.editor.trigger(value, "editor.action.triggerSuggest", {});
    }, 50);

    componentDidMount() {
        this.editor = monaco.editor.create(this.promptContentNode, {
            theme: "upterm-prompt-theme",
            model: this.model,
            lineNumbers: "off",
            fontSize: services.font.size + 2,
            fontFamily: services.font.family,
            fontLigatures: (services.font as any).fontLigatures ?? true,
            suggestFontSize: services.font.size,
            minimap: {enabled: false},
            scrollbar: {
                vertical: "hidden",
                horizontal: "hidden",
            },
            overviewRulerLanes: 0,
            quickSuggestions: true,
            quickSuggestionsDelay: 0,
            parameterHints: { enabled: true },
            wordBasedSuggestions: "off",
            wordWrap: "on",
            wrappingStrategy: "advanced",
            wordWrapColumn: 80,
            scrollBeyondLastLine: false,
            // @ts-ignore automaticLayout is valid but types may be outdated
            automaticLayout: true,
        });
        // #1132 multiline broken layout: ensure wordWrap/minimap/scrollBeyondLastLine and overlay not broken
        this.editor.updateOptions({
            wordWrap: "on",
            wrappingStrategy: "advanced",
            wordWrapColumn: 80,
            minimap: {enabled: false},
            scrollBeyondLastLine: false,
            lineNumbers: "off",
            fontLigatures: (services.font as any).fontLigatures ?? true,
            scrollbar: {vertical: "hidden", horizontal: "hidden"},
        } as any);

        services.font.onChange.subscribe(() => {
            this.editor.updateOptions({
                fontSize: services.font.size * 1.2,
                fontFamily: services.font.family,
                fontLigatures: (services.font as any).fontLigatures ?? true,
                suggestFontSize: services.font.size,
            });
            this.editor.layout();
        });

        this.editor.addCommand(
            monaco.KeyCode.UpArrow,
            () => this.setPreviousHistoryItem(),
            "!suggestWidgetVisible",
        );
        this.editor.addCommand(
            monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyP,
            () => this.setPreviousHistoryItem(),
            "!suggestWidgetVisible",
        );
        this.editor.addCommand(
            monaco.KeyCode.DownArrow,
            () => this.setNextHistoryItem(),
            "!suggestWidgetVisible",
        );
        this.editor.addCommand(
            monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyN,
            () => this.setNextHistoryItem(),
            "!suggestWidgetVisible",
        );
        this.addShortcut(
            monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyB,
            "cursorLeft",
        );
        this.addShortcut(
            monaco.KeyMod.Alt | monaco.KeyCode.KeyB,
            "cursorWordStartLeft",
        );
        this.addShortcut(
            monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyF,
            "cursorRight",
        );
        this.addShortcut(
            monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
            "cursorWordEndRight",
        );
        this.addShortcut(
            monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyW,
            "deleteWordLeft",
        );
        this.addShortcut(
            monaco.KeyMod.Alt | monaco.KeyCode.KeyD,
            "deleteWordRight",
        );
        this.addShortcut(
            monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyD,
            "deleteRight",
        );

        this.unbindDefaultAction("editor.action.outdentLines");
        this.unbindDefaultAction("editor.action.indentLines");
        this.unbindDefaultAction("actions.find");
        this.unbindDefaultAction("editor.action.gotoLine");

        // #1026 middle mouse paste: button 1 -> clipboard read -> insert
        this.promptContentNode.addEventListener("mousedown", async (e: MouseEvent) => {
            if ((e as any).button === 1) {
                e.preventDefault();
                try {
                    // @ts-ignore navigator.clipboard may need permissions
                    const text = await (navigator as any).clipboard?.readText?.();
                    if (typeof text === "string" && text.length) {
                        const sanitized = this.normalizePasteText(text);
                        this.insertValueInPlace(sanitized);
                    }
                } catch {
                    // fallback: let default middle paste (X11 primary) handle if clipboard API fails
                }
            }
        });

        // Also intercept paste to normalize \r\n and handle single trailing \n
        this.promptContentNode.addEventListener("paste", (e: ClipboardEvent) => {
            const raw = e.clipboardData?.getData("text/plain");
            if (typeof raw === "string" && raw.length) {
                const sanitized = this.normalizePasteText(raw);
                if (sanitized !== raw) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.insertValueInPlace(sanitized);
                }
            }
        });

        this.focus();
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!prevProps.isFocused && this.props.isFocused) {
            this.focus();
        }

        if (prevState.mode !== this.state.mode) {
            if (this.isInHistorySearchMode) {
                this.editor.setModel(this.historyModel);
                this.setValue(this.model.getValue());
                this.triggerSuggest();
            } else {
                this.editor.setModel(this.model);
                this.setValue(this.historyModel.getValue());
            }
        }
    }

    render() {
        return (
            <div className="prompt" data-mode={this.state.mode}>
                <div className="prompt-content" ref={this.promptContentRef}/>
            </div>
        );
    }

    setHistorySearchMode() {
        this.setState({mode: Mode.HistorySearch});
    }

    setNormalMode() {
        this.setState({mode: Mode.Normal});
    }

    acceptSelectedSuggestion() {
        this.editor.trigger("", "acceptSelectedSuggestion", {});

        if (this.isInHistorySearchMode) {
            this.setNormalMode();
        } else {
            this.triggerSuggest();
        }
    }

    get isInHistorySearchMode(): boolean {
        return this.state.mode === Mode.HistorySearch;
    }

    focus(): void {
        this.editor.focus();
    }

    clear(): void {
        this.setValue("");
    }

    onReturnKeyPress(): void {
        if (this.isInHistorySearchMode) {
            this.acceptSelectedSuggestion();
        } else {
            this.execute();
        }
    }

    async appendLastLArgumentOfPreviousCommand(): Promise<void> {
        const latestHistoryRecord = services.history.latest;

        if (latestHistoryRecord) {
            this.setValue(this.prompt.value + _.last(scan(latestHistoryRecord.command))!.value);
        }
    }

    setValue(value: string): void {
        const sanitized = this.normalizePasteText(value);
        this.editor.setValue(sanitized);
        this.editor.setPosition({lineNumber: 1, column: sanitized.length + 1});
        this.prompt.setValue(sanitized);
        this.focus();
        // #1220 debounce already handled in triggerSuggest; no immediate call here
    }

    insertValueInPlace(value: string): void {
        const sanitized = this.normalizePasteText(value);
        this.editor.trigger("keyboard", "type", {text: sanitized});
        this.focus();
    }

    private async execute(): Promise<void> {
        let promptText = this.editor.getValue();
        this.prompt.setValue(promptText);

        if (!this.isEmpty()) {
            this.props.session.createJob(this.prompt);
            this.editor.setValue("");
            this.setState({
                displayedHistoryRecordID: undefined,
            });
        }
    }

    private setPreviousHistoryItem(): void {
        const currentID = this.state.displayedHistoryRecordID;
        if (currentID) {
            const currentRecord = services.history.get(currentID);
            const previousRecord = _.findLast(
                services.history.all,
                record => record.id < currentID && record.command !== currentRecord.command,
            );

            if (previousRecord) {
                this.setValue(previousRecord.command);
                this.setState({displayedHistoryRecordID: previousRecord.id});
            }
        } else {
            const previousRecord = services.history.latest;
            if (previousRecord) {
                this.setValue(previousRecord.command);
                this.setState({displayedHistoryRecordID: previousRecord.id});
            }
        }
    }

    private setNextHistoryItem(): void {
        const currentID = this.state.displayedHistoryRecordID;
        if (currentID) {
            const currentRecord = services.history.get(currentID);
            const nextRecord = _.find(
                services.history.all,
                record => record.id > currentID && record.command !== currentRecord.command,
            );
            if (nextRecord) {
                this.setValue(nextRecord.command);
                this.setState({displayedHistoryRecordID: nextRecord.id});
            } else {
                this.setValue("");
                this.setState({displayedHistoryRecordID: undefined});
            }
        }
    }

    private get promptContentNode(): HTMLDivElement {
        return this.promptContentRef.current as HTMLDivElement;
    }

    private isEmpty(): boolean {
        return this.prompt.value.replace(/\s/g, "").length === 0;
    }

    private triggerSuggest() {
        this.debouncedTriggerSuggest();
    }

    private addShortcut(keybinding: number, handlerId: string) {
        this.editor.addCommand(
            keybinding,
            () => this.editor.trigger("", handlerId, {}),
            "",
        );
    }

    private unbindDefaultAction(handlerId: string) {
        (this.editor as any)._standaloneKeybindingService.addDynamicKeybinding(`-${handlerId}`);
    }
}
