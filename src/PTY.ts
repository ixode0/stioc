import * as ChildProcess from "child_process";
import * as OS from "os";
import * as _ from "lodash";
import * as pty from "node-pty";
import {loginShell} from "./utils/Shell";
import {homeDirectory, info} from "./utils/Common";

interface ITerminal {
    write(data: string): void;
    resize(cols: number, rows: number): void;
    kill(signal?: string): void;
    on(type: string, listener: (...args: any[]) => any): void;
    // node-pty >=1.1 strongly typed events (IEvent)
    onData?: (listener: (data: string) => void) => { dispose(): void };
    onExit?: (listener: (e: { exitCode: number; signal?: number }) => void) => { dispose(): void };
}

export class PTY {
    private terminal: ITerminal;

    // TODO: write proper signatures.
    // TODO: use generators.
    // TODO: terminate. https://github.com/atom/atom/blob/v1.0.15/src/task.coffee#L151
    constructor(words: EscapedShellWord[], env: ProcessEnvironment, dimensions: Dimensions, dataHandler: (d: string) => void, exitHandler: (c: number) => void) {
        const shellArguments = [...loginShell.noConfigSwitches, ...loginShell.interactiveCommandSwitches, words.join(" ")];

        info(`PTY: ${loginShell.executableName} ${JSON.stringify(shellArguments)}`);
        info(`Dimensions: ${JSON.stringify(dimensions)}}`);

        // node-pty 1.0: fork -> spawn, add ConPTY check for Windows
        const useConpty = process.platform === "win32";
        this.terminal = (pty as any).spawn(loginShell.executableName, shellArguments, {
            cols: dimensions.columns,
            rows: dimensions.rows,
            cwd: env.PWD,
            env: env as unknown as {[key: string]: string},
            name: "xterm-256color",
            useConpty: useConpty ? true : undefined,
            // Fallback for older node-pty 1.0 conpty flag
            ...(useConpty ? { experimentalUseConpty: true } as any : {}),
        });

        // node-pty >=1.1 exposes typed onData/onExit (IEvent). Prefer them, fallback to legacy .on()
        // Fixes white-screen race and ensures #305 hang can be observed via typed exit.
        const tAny = this.terminal as any;
        const hasTypedData = tAny.onData && typeof tAny.onData === "function";
        const hasTypedExit = tAny.onExit && typeof tAny.onExit === "function";
        if (hasTypedData && hasTypedExit) {
            try {
                tAny.onData((data: string) => dataHandler(data));
                tAny.onExit((e: { exitCode: number; signal?: number }) => exitHandler(e.exitCode));
            } catch {
                this.terminal.on("data", (data: string) => dataHandler(data));
                this.terminal.on("exit", (code: number) => exitHandler(code));
            }
        } else {
            this.terminal.on("data", (data: string) => dataHandler(data));
            this.terminal.on("exit", (code: number) => exitHandler(code));
        }

        // #305: hang when PWD was deleted – exit may never fire, caller can kill(SIGHUP) to terminate.
    }

    write(data: string): void {
        this.terminal.write(data);
    }

    resize(dimensions: Dimensions) {
        this.terminal.resize(dimensions.columns, dimensions.rows);
    }

    kill(signal: string): void {
        /**
         *  The if branch is necessary because pty.js doesn't handle SIGINT correctly.
         *  You can test whether it works by executing
         *     ruby -e "loop { puts 'yes'; sleep 1 }"
         *  and trying to kill it with SIGINT.
         *
         *  {@link https://github.com/chjj/pty.js/issues/58}
         *  #305: hang in deleted directory requires explicit SIGHUP to terminate
         */
        try {
            if (signal === "SIGINT") {
                this.terminal.kill("SIGTERM");
            } else if (signal === "SIGHUP") {
                // Explicitly support SIGHUP for #305; Windows throws if signal provided
                this.terminal.kill("SIGHUP");
            } else {
                this.terminal.kill(signal);
            }
        } catch {
            // Windows: kill(signal) throws when signal is given; fallback to default kill (=SIGHUP on unix)
            try {
                (this.terminal as any).kill();
            } catch {}
        }
    }
}

export function executeCommand(
    command: string,
    args: string[] = [],
    directory: string,
    execOptions?: any,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            ...execOptions,
            env: _.extend({PWD: directory, SHLVL: 1}, process.env),
            cwd: directory,
            shell: loginShell.commandExecutorPath,
        };

        ChildProcess.exec(`${command} ${args.join(" ")}`, options, (error, output) => {
            if (error) {
                reject(error);
            } else {
                resolve(output.toString());
            }
        });
    });
}

export async function linedOutputOf(command: string, args: string[], directory: string): Promise<string[]> {
    let output = await executeCommand(command, args, directory);
    return output.split("\\" + OS.EOL).join(" ").split(OS.EOL).filter(path => path.length > 0);
}

export async function executeCommandWithShellConfig(command: string): Promise<string[]> {
    const sourceCommands = (await loginShell.existingConfigFiles()).map(fileName => `source ${fileName} &> /dev/null`);

    return await linedOutputOf(loginShell.executableName, [...loginShell.executeCommandSwitches, loginShell.combineCommands([...sourceCommands, command])], homeDirectory);
}
