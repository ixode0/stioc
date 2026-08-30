import * as events from "events";

let _nextId = Date.now();
export class EmitterWithUniqueID extends events.EventEmitter {
    public id: number;

    constructor() {
        super();
        this.id = _nextId++;
    }
}
