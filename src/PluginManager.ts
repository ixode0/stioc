import {Prettyfier, EnvironmentObserverPlugin, AutocompletionProvider} from "./Interfaces";
import * as Path from "path";
import {io} from "./utils/Common";
import { defaultAutocompletionProvider } from "./plugins/completion_utils/Common";

// FIXME: Technical debt: register all the plugin types via single method.
export class PluginManager {
    private static _prettyfiers: Prettyfier[] = [];
    private static _environmentObservers: EnvironmentObserverPlugin[] = [];
    private static _autocompletionProviders: Dictionary<AutocompletionProvider> = {};

    static registerPrettyfier(prettyfier: Prettyfier): void {
        this._prettyfiers.push(prettyfier);
    }

    static get prettyfiers(): Prettyfier[] {
        return this._prettyfiers;
    }

    static registerEnvironmentObserver(plugin: EnvironmentObserverPlugin): void {
        this._environmentObservers.push(plugin);
    }

    static get environmentObservers(): EnvironmentObserverPlugin[] {
        return this._environmentObservers;
    }

    static registerAutocompletionProvider(commandName: string, provider: AutocompletionProvider): void {
        this._autocompletionProviders[commandName] = provider;
    }

    static autocompletionProviderFor(commandName: string): AutocompletionProvider {
        return this._autocompletionProviders[commandName] || defaultAutocompletionProvider;
    }
}


export async function loadAllPlugins(): Promise<void> {
    // Renderer bundle (Vite/ESM) has no __dirname/require and no plugin dir:
    // skip silently instead of crashing the UI.
    try {
        const dir = typeof __dirname !== "undefined" ? __dirname : "";
        if (!dir || typeof window !== "undefined") return;
        const pluginsDirectory = Path.join(dir, "plugins");
        const filePaths = await io.recursiveFilesIn(pluginsDirectory);
        await Promise.all(filePaths.map(async (p) => {
            const mod = await import(/* @vite-ignore */ p);
            return mod.default;
        }));
    } catch {
        // No plugins dir in packaged renderer — not fatal.
    }
}
