import {Subject} from "rxjs";
import {Job} from "../shell/Job";


export class JobsService {
    readonly onStart = new Subject<Job>();
    readonly onFinish = new Subject<Job>();
}
