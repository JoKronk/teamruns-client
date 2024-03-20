import { Task } from "../opengoal/task";

export class DbTask {
    gameTask: string;
    isCell: boolean;
    obtainedByName: string;
    obtainedById: string;
    obtainedAt: string;

    constructor(task: Task) {
        this.gameTask = task.gameTask;
        this.isCell = task.isCollectedCell ?? Task.resultsInCell(task.gameTask);
        this.obtainedByName = task.obtainedByName;
        this.obtainedById = task.obtainedById;
        this.obtainedAt = task.obtainedAt;
    }
}