import { GameTaskLevelTime } from "../opengoal/game-task";
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

    updateSplit(split: GameTaskLevelTime, timeSave: string | undefined) {
        this.splitName = split.name;
        this.splitTime = split.timerTime;
        this.splitPlayer = split.user.name;
        this.splitTimesave = timeSave;
    }

    resetSplitData() {
        this.splitName = undefined;
        this.splitTime = undefined;
        this.splitPlayer = undefined;
        this.splitTimesave = undefined;
    }

}