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
        if (this.runState === RunState.Countdown || this.runState === RunState.Started)
            this.resetEverything = true;
        else
            this.resetTimer();
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
            ? (this.getHour(difference) + ":" + this.getMinutes(difference) + ":" + this.getSecond(difference))
            : ("-0:00:" + this.getSecond(difference));

        this.timeMs = "." + this.getMs(difference);

        await sleep(100);
        
        if (this.resetEverything)
            this.resetTimer();
        else
            this.updateTimer(hasSpawnedPlayer);
    }

    private getHour(difference: number): number {
        return Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    }
    private getMinutes(difference: number): string {
        return ("0" + Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))).slice(-2);
    }

    private getSecond(difference: number): string {
        return ("0" + Math.abs(Math.floor((difference % (1000 * 60)) / 1000))).slice(-2);
    }

    private getMs(difference: number): number {
        return this.runState === RunState.Started ? Math.trunc(Math.floor((difference % 1000)) / 100) : Math.trunc(Math.abs(Math.floor((difference % 1000)) / 100));
    }
}

function sleep(ms: number) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}