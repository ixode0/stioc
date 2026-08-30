import * as i from "../Interfaces";
import * as React from "react";
import {Session} from "./Session";
import {Prompt} from "./Prompt";
import {XtermOutput} from "../xterm/XtermOutput";
import {CommandExecutor, NonZeroExitCodeError} from "./CommandExecutor";
import {PTY} from "../PTY";
import {PluginManager} from "../PluginManager";
import {EmitterWithUniqueID} from "../EmitterWithUniqueID";
import {Status} from "../Enums";
import {Environment} from "./Environment";
import {normalizeProcessInput} from "../utils/Common";
import {TerminalLikeDevice} from "../Interfaces";

export class Job extends EmitterWithUniqueID implements TerminalLikeDevice {
    public status: Status = Status.InProgress;
    readonly startTime = Date.now();
    private readonly _output: XtermOutput;
    private pty: PTY | undefined;

    constructor(private _session: Session, private _prompt: Prompt) {
        super();
        this._output = new XtermOutput(this._session.dimensions);
        // xterm buffer — без throttle, прямой проброс события data
        this._output.on("data", () => this.emit("data"));
    }

    async execute(): Promise<void> {
        try {
            await CommandExecutor.execute(this);
            this.pty = undefined;
            if (this.status === Status.InProgress) {
                this.setStatus(Status.Success);
            }
        } catch (exception) {
            this.handleError(exception);
            return;
        } finally {
            if (this.status !== Status.InProgress) {
                this.emit("end");
            }
        }
    }

    handleError(message: unknown): void {
        this.setStatus(Status.Failed);
        if (message) {
            if (message instanceof NonZeroExitCodeError) {
                // Do nothing.
            } else {
                this._output.write(message as string);
            }
        }
    }

    isRunningPty(): boolean {
        return this.pty !== undefined;
    }

    setPty(pty: PTY) {
        this.pty = pty;
    }

    // Writes to the process' STDIN.
    write(input: string | KeyboardEvent) {
        this.pty!.write(normalizeProcessInput(input, this.output.isCursorKeysModeSet));
    }

    get session(): Session {
        return this._session;
    }

    hasOutput(): boolean {
        return !this._output.isEmpty();
    }

    interrupt(): void {
        if (this.pty && this.status === Status.InProgress) {
            this.pty.kill("SIGINT");
            this.setStatus(Status.Failed);
            // emit("end") will happen via PTY exit -> CommandExecutor reject -> execute() catch -> finally
            // avoid double emit that races Session "job-finished" listener
        }
    }

    resize(): void {
        // Always sync xterm dimensions so split/ window resize is visible even after PTY exit
        this.output.dimensions = this.session.dimensions;
        if (this.pty && this.status === Status.InProgress) {
            this.pty.resize(this.session.dimensions);
        }
    }

    canBePrettified(): boolean {
        return this.status !== Status.InProgress && !!this.firstApplicablePrettyfier;
    }

    prettify(): React.ReactElement<any> {
        if (this.firstApplicablePrettyfier) {
            return this.firstApplicablePrettyfier.prettify(this);
        } else {
            throw "No applicable prettyfier found.";
        }
    }

    get environment(): Environment {
        return this.session.environment;
    }

    private get firstApplicablePrettyfier(): i.Prettyfier | undefined {
        return PluginManager.prettyfiers.find(prettyfier => prettyfier.isApplicable(this));
    }

    get output(): XtermOutput {
        return this._output;
    }

    get prompt(): Prompt {
        return this._prompt;
    }

    setStatus(status: Status): void {
        this.status = status;
        this.emit("status", status);
    }
}
