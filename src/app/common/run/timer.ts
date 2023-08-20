import { OG } from "../opengoal/og";
import { RunState } from "./run-state";

export class Timer {
    time: string;
    timeMs: string;
    startDateMs: number | null;
    countdownSeconds: number;

    runState: RunState;

    private resetEverything: boolean = false; //used to flag a reset to the update cycle

    constructor(countdownSeconds: number) {
        this.countdownSeconds = countdownSeconds;
        this.resetTimer();
    }

    reset() {
        if (this.runIsOngoing())
            this.resetEverything = true;
        else
            this.resetTimer();
    }

    runIsOngoing() {
        return this.runState === RunState.Countdown || this.runState === RunState.Started;
    }

    private resetTimer() {
        this.startDateMs = null;
        this.runState = RunState.Waiting;
        this.time = "-0:00:" + ("0" + this.countdownSeconds).slice(-2);
        this.timeMs = ".0";
        this.resetEverything = false;
    }

    startTimer(startMs: number) {
        this.startDateMs = startMs;
        this.runState = RunState.Countdown;
        this.updateTimer();
    }



    async updateTimer(hasSpawnedPlayer: boolean = false) { //parameter as we can't store local player data in run model currently
        if (this.runState === RunState.Ended)
            return;

        var currentTimeMs = new Date().getTime();

        //start run check
        if (this.runState === RunState.Countdown) {
            if (!hasSpawnedPlayer && this.startDateMs! <= currentTimeMs + 1400) {
                OG.startRun();
                hasSpawnedPlayer = true;
            }
            if (this.startDateMs! <= currentTimeMs)
            this.runState = RunState.Started;
        }


        var difference = currentTimeMs - this.startDateMs!;

        this.time = this.runState === RunState.Started
            ? (Timer.msToTimeFormat(difference))
            : ("-0:00:" + Timer.getSecond(difference));

        this.timeMs = "." + this.getMs(difference);

        await sleep(100);
        
        if (this.resetEverything)
            this.resetTimer();
        else
            this.updateTimer(hasSpawnedPlayer);
    }

    private getMs(ms: number): number {
        return this.runState === RunState.Started ? Math.trunc(Math.floor((ms % 1000)) / 100) : Math.trunc(Math.abs(Math.floor((ms % 1000)) / 100));
    }

    private static getHour(ms: number): number {
        return Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    }
    private static getMinutes(ms: number): string {
        return ("0" + Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))).slice(-2);
    }

    private static getSecond(ms: number): string {
        return ("0" + Math.abs(Math.floor((ms % (1000 * 60)) / 1000))).slice(-2);
    }

    public static msToTimeFormat(ms: number, includeMs: boolean = false, shortened: boolean = false) {
        let time = Timer.getHour(ms) + ":" + Timer.getMinutes(ms) + ":" + Timer.getSecond(ms);
        
        if (includeMs)
            time += "." + Math.trunc(Math.floor((ms % 1000)) / 100);
        
        if (shortened) {
            for (let i = 0; i < 3 && (time.charAt(0) === "0" || time.charAt(0) === ":"); i++)
            time = time.substring(1);
        }

        return time;
    }

    public static timeToMs(time: string): number {
        if (time === "DNF")
            return 0;
        let timeArray: number[] = time.replace(".", ":").split(":").map(x => +x).reverse();
        return (timeArray[0] * 100) + (timeArray[1] * 1000) + (!timeArray[2] ? 0 : timeArray[2] * 60000) + (!timeArray[3] ? 0 : timeArray[3] * 3600000);
    }
}

function sleep(ms: number) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}