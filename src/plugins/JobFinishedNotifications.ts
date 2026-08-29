import {services} from "../services/index";
import {Status} from "../Enums";
// TODO: migrate remote -> electronAPI

services.jobs.onFinish.subscribe(job => {
    const title = job.status === Status.Success ? "Completed" : "Failed";
    /* tslint:disable:no-unused-expression */
    new Notification(title, {body: job.prompt.value});
});
