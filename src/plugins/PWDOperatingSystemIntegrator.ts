import {Session} from "../shell/Session";
import {PluginManager} from "../PluginManager";
// TODO: migrate remote -> electronAPI

PluginManager.registerEnvironmentObserver({
    presentWorkingDirectoryWillChange: () => { /* do nothing */ },

    presentWorkingDirectoryDidChange: (_session: Session, directory: string) => {
        // remote.app.addRecentDocument(directory) -> migrated to electronAPI
        void directory;
    },
});
