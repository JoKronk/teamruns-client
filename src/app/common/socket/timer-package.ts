import { GameTaskLevelTime } from "../opengoal/game-task";
import { Task } from "../opengoal/task";
import { TaskSplit } from "../opengoal/task-split";
import { Timer } from "../run/timer";

export class TimerPackage {
    hours: number;
    minutes: number;
    seconds: number;
    milliseconds: number;
    splitTime: string | undefined; 
    splitName: string | undefined;
    splitPlayer: string | undefined;
    splitTimesave: string | undefined;

    constructor() {

    }

    updateTime(totalMs: number) {
        this.hours = Timer.getHour(totalMs);
        this.minutes = Timer.getMinutesSimple(totalMs);
        this.seconds = Timer.getSecondSimple(totalMs);
        this.milliseconds = Timer.getMsSimple(totalMs);
    }

    updateSplit(split: TaskSplit | undefined, task: GameTaskLevelTime, timeSave: string | undefined) {
        if (split && !split.enabled)
            return;

        this.splitName = split?.name ?? Task.defaultSplitName(task.name) ?? task.name;
        this.splitTime = Timer.msToTimeFormat(task.timerTimeMs, true, true);
        this.splitPlayer = task.user.name;
        this.splitTimesave = timeSave ?? "";
    }

    sendResetPackage() {
        this.hours = 0;
        this.minutes = 0;
        this.seconds = 0;
        this.milliseconds = 0;
        this.splitName = "";
        this.splitTime = "";
        this.splitTimesave = "";
    }

    resetSplitData() {
        this.splitName = undefined;
        this.splitTime = undefined;
        this.splitPlayer = undefined;
        this.splitTimesave = undefined;
    }

}