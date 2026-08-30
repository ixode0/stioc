import {Job} from "./Job";
import {existsSync, statSync} from "fs";
import {error, homeDirectory, pluralize, resolveDirectory, resolveFile, mapObject} from "../utils/Common";
import {readFileSync} from "fs";
import {EOL} from "os";
import {Session} from "./Session";
import {OrderedSet} from "../utils/OrderedSet";
import {parseAlias} from "./Aliases";
import {stringLiteralValue} from "./Scanner";

const executors: Dictionary<(i: Job, a: string[]) => void> = {
    // #462 cd does not work, #1191 Can't change directory, #1290 trailing slash
    cd: (job: Job, args: string[]): void => {
        let fullPath: string;

        if (!args.length) {
            // cd without args -> homeDirectory (#462)
            fullPath = homeDirectory;
        } else {
            const enteredPath = args[0];

            if (isHistoricalDirectory(enteredPath)) {
                // cd - / cd -N -> previous dirs via historicalPresentDirectoriesStack
                fullPath = expandHistoricalDirectory(enteredPath, job.session.historicalPresentDirectoriesStack);
            } else {
                // cdpath resolution with error logging if resolveDirectory fails
                const candidates: string[] = [];
                for (const base of job.environment.cdpath) {
                    try {
                        const resolved = resolveDirectory(base, enteredPath);
                        candidates.push(resolved);
                    } catch (e) {
                        error(`cd: failed to resolve "${enteredPath}" against CDPATH "${base}":`, e);
                    }
                }
                fullPath = candidates
                    .filter(resolved => existsSync(resolved))
                    .filter(resolved => {
                        try {
                            return statSync(resolved).isDirectory();
                        } catch (e) {
                            error(`cd: stat failed for "${resolved}":`, e);
                            return false;
                        }
                    })[0];

                if (!fullPath) {
                    error(`cd: directory "${enteredPath}" not found in CDPATH`, job.environment.cdpath);
                    throw new Error(`The directory "${enteredPath}" doesn't exist.`);
                }
            }
        }

        job.session.directory = fullPath;
    },
    clear: (job: Job, _args: string[]): void => {
        setTimeout(() => job.session.clearJobs(), 0);
    },
    exit: (job: Job, _args: string[]): void => {
        job.session.close();
    },
    // #597 Export PATH – ensure quoted values are unwrapped and env updated for io.executablesInPaths
    export: (job: Job, args: string[]): void => {
        if (args.length === 0) {
            job.output.write(job.environment.map((key, value) => `${key}=${value}`).join("\r\n"));
        } else {
            args.forEach(argument => {
                try {
                    const firstEqualIndex = argument.indexOf("=");
                    // `export VAR` without value – no-op, keep existing env (#597)
                    if (firstEqualIndex === -1) {
                        return;
                    }
                    const key = argument.slice(0, firstEqualIndex).trim();
                    const rawValue = argument.slice(firstEqualIndex + 1);
                    if (!key) {
                        error(`export: invalid argument "${argument}"`);
                        return;
                    }
                    // Try to unwrap quotes via stringLiteralValue, fallback to raw (handles $VAR, colons)
                    let value: string;
                    try {
                        const parsed = stringLiteralValue(rawValue);
                        value = parsed !== undefined ? parsed : rawValue;
                    } catch {
                        value = rawValue;
                    }
                    // Strip surrounding quotes if stringLiteralValue returned undefined for $ expansions
                    if (value === rawValue) {
                        // Non-greedy + handle escaped inner quotes
                        const m = /^(['"])(.*)\1$/.exec(value);
                        if (m) {
                            value = m[2];
                        }
                    }
                    job.session.environment.set(key, value);
                } catch (e) {
                    error(`export: failed to set "${argument}":`, e);
                }
            });
        }
    },
    // #1215 source breaks, #94 virtualenv – robust source with per-line error skipping
    source: (job: Job, args: string[]): void => {
        if (!args[0]) {
            throw new Error("source: missing file argument");
        }
        sourceFile(job.session, args[0]);
    },
    alias: (job: Job, args: string[]): void => {
        if (args.length === 0) {
            job.output.write(mapObject(job.session.aliases.toObject(), (key, value) => `${key}=${value}`).join("\r\n"));
        } else if (args.length === 1) {
            const parsed = parseAlias(args[0]);
            job.session.aliases.add(parsed.name, parsed.value);
        } else {
            throw `Don't know what to do with ${args.length} arguments.`;
        }
    },
    unalias: (job: Job, args: string[]): void => {
        if (args.length === 1) {
            const name = args[0];

            if (job.session.aliases.has(name)) {
                job.session.aliases.remove(args[0]);
            } else {
                throw `There is such alias: ${name}.`;
            }
        } else {
            throw `Don't know what to do with ${args.length} arguments.`;
        }
    },
    show: (job: Job, args: string[]): void => {
        const imgs = args.map(argument => resolveFile(job.environment.pwd, argument));
        job.output.write(imgs.join(EOL));
    },
};

export function sourceFile(session: Session, fileName: string): void {
    let resolved: string;
    try {
        resolved = resolveFile(session.directory, fileName);
    } catch (e) {
        error(`source: failed to resolve "${fileName}" against "${session.directory}":`, e);
        throw new Error(`Cannot resolve file "${fileName}": ${e instanceof Error ? e.message : String(e)}`);
    }

    let content: string;
    try {
        content = readFileSync(resolved).toString();
    } catch (e) {
        error(`source: failed to read "${resolved}":`, e);
        throw new Error(`Cannot read file "${resolved}": ${e instanceof Error ? e.message : String(e)}`);
    }

    // Use /\r?\n/ instead of EOL to handle files with mixed LF/CRLF (e.g. ~/.zshrc) – #1215
    content.split(/\r?\n/).forEach(rawLine => {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            return;
        }
        try {
            // 1) export VAR=val  (also `export VAR` without value)
            if (line.startsWith("export ")) {
                const exportBody = line.slice("export ".length).trim();
                if (!exportBody) {
                    return;
                }
                const eqIdx = exportBody.indexOf("=");
                if (eqIdx === -1) {
                    // `export VAR` form – keep existing env value, do not clear (#1215)
                    return;
                }
                const variableName = exportBody.slice(0, eqIdx).trim();
                const variableValueLiteral = exportBody.slice(eqIdx + 1).trim();
                if (!variableName) {
                    return;
                }
                let variableValue: string | undefined;
                try {
                    variableValue = stringLiteralValue(variableValueLiteral);
                } catch {
                    variableValue = undefined;
                }
                if (variableValue === undefined) {
                    const m = /^(['"])(.*)\1$/.exec(variableValueLiteral);
                    variableValue = m ? m[2] : variableValueLiteral;
                }
                session.environment.set(variableName, variableValue);
                return;
            }

            // 2) alias definitions inside sourced files (e.g. venv activate may define pydoc)
            if (line.startsWith("alias ")) {
                try {
                    const parsed = parseAlias(line);
                    session.aliases.add(parsed.name, parsed.value);
                } catch (e) {
                    error(`source: failed to parse alias line "${rawLine}":`, e);
                }
                return;
            }

            // 3) bare assignment VAR=val (virtualenv activate does VIRTUAL_ENV="..." then export)
            if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(line)) {
                const eqIdx = line.indexOf("=");
                const variableName = line.slice(0, eqIdx).trim();
                const rawVal = line.slice(eqIdx + 1).trim();
                if (!variableName) {
                    return;
                }
                let value: string | undefined;
                try {
                    value = stringLiteralValue(rawVal);
                } catch {
                    value = undefined;
                }
                if (value === undefined) {
                    const m = /^(['"])(.*)\1$/.exec(rawVal);
                    value = m ? m[2] : rawVal;
                }
                session.environment.set(variableName, value);
                return;
            }

            // 4) Fallback: try alias parse for lines like `alias ll='ls -la'` without prefix handling
            // Silent skip on failure – per-line errors must not break whole file (#1215)
            try {
                const parsed = parseAlias(line);
                // Heuristic: only add if parseAlias succeeded and line contains '='
                if (line.includes("=")) {
                    session.aliases.add(parsed.name, parsed.value);
                }
            } catch {
                // Ignore non-alias / non-export lines (functions, conditions, etc.)
            }
        } catch (e) {
            // Per-line try/catch – skip erroneous lines with log instead of breaking (#1215)
            error(`source: failed to parse line "${rawLine}":`, e);
        }
    });
}

// A class representing built in commands
export class Command {
    static allCommandNames = Object.keys(executors);

    static executor(command: string): (i: Job, args: string[]) => void {
        return executors[command];
    }

    static isBuiltIn(command: string): boolean {
        return this.allCommandNames.includes(command);
    }
}

export function expandHistoricalDirectory(alias: string, historicalDirectories: OrderedSet<string>): string {
    if (alias === "-") {
        alias = "-1";
    }
    const index = historicalDirectories.size + parseInt(alias, 10);

    if (index < 0) {
        throw new Error(`Error: you only have ${historicalDirectories.size} ${pluralize("directory", historicalDirectories.size)} in the stack.`);
    } else {
        const directory = historicalDirectories.at(index);

        if (directory) {
            return directory;
        } else {
            throw `No directory with index ${index}`;
        }
    }
}

export function isHistoricalDirectory(directory: string): boolean {
    return /^-\d*$/.test(directory);
}
