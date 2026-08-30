import {Observable, BehaviorSubject, timer} from "rxjs";
import {concatMap, filter, distinctUntilChanged, multicast, refCount, mergeWith} from "rxjs/operators";

import {currentBranchName, GitDirectoryPath, repositoryState, RepositoryState} from "../utils/Git";
import {services} from "./index";

const INTERVAL = 5000;

async function getState(directory: string): Promise<GitState> {
    const state = await repositoryState(directory);

    if (state === RepositoryState.NotRepository) {
        return {kind: "not-repository"};
    } else {
        return {
            kind: "repository",
            branch: await currentBranchName(<GitDirectoryPath>directory),
            status: state,
        };
    }
}

function createObservable(directory: string) {
    return timer(0, INTERVAL).pipe(
        mergeWith(services.jobs.onFinish.pipe(filter(job => job.session.directory === directory))),
        concatMap(() => getState(directory)),
        distinctUntilChanged((x, y) => JSON.stringify(x) === JSON.stringify(y)),
        multicast(() => new BehaviorSubject<GitState>({kind: "not-repository"})),
        refCount(),
    ) as unknown as Observable<GitState>;
}

export class GitService {
    private observables: Map<string, Observable<GitState>> = new Map();

    observableFor(directory: string): Observable<GitState> {
        if (!this.observables.has(directory)) {
            this.observables.set(directory, createObservable(directory));
        }

        return this.observables.get(directory)!;
    }
}
