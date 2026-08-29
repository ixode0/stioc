// STIOC 2026 - updated typings (original from 2015, refreshed for TS 5.7)
interface PermittedGroups {
    owner: boolean;
    group: boolean;
    others: boolean;
}

interface Permissions {
    read: PermittedGroups;
    write: PermittedGroups;
    execute: PermittedGroups;
}

declare module "mode-to-permissions" {
    function modeToPermissions(mode: number): Permissions;
    namespace modeToPermissions {}
    export = modeToPermissions;
}
