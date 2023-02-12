export class Timer {
    startDate: Date | null;
    startDateMs: number | null;
    countdownSeconds: number;
    time: string;
    timeMs: string;

    timerHasStarted: boolean;
    runHasStarted: boolean;

    private resetEverything: boolean = false; //used to flag a reset to the update cycle

    constructor(countdownSeconds: number) {
        this.countdownSeconds = countdownSeconds;
        this.resetTimer();
    }

    reset() {
        this.resetEverything = true;
    }

    private resetTimer() {
        this.startDate = null;
        this.startDateMs = null;
        this.runHasStarted = false;
        this.timerHasStarted = false;
        this.time = "-0:00:" + ("0" + this.countdownSeconds).slice(-2);
        this.timeMs = ".0";
        this.resetEverything = false;
    }

    startTimer(startDate: Date) {
        this.startDate = startDate;
        this.startDate.setSeconds(this.startDate.getSeconds() + this.countdownSeconds);
        this.startDateMs = startDate.getTime();
        this.timerHasStarted = true;
        this.runHasStarted = false;
        this.updateTimer();
    }



    private updateTimer() {
        setTimeout(() => {
            var currentTimeMs = new Date().getTime();

            //start run check
            if (!this.runHasStarted && this.startDateMs! <= currentTimeMs)
                this.startRun();


            var difference = currentTimeMs - this.startDateMs!;

                this.time = this.runHasStarted 
                ? (this.getHour(difference) + ":" + this.getMinutes(difference) + ":" + this.getSecond(difference))
                : ("-0:00:" + this.getSecond(difference));

            this.timeMs = "." + this.getMs(difference);
            
            if (!this.resetEverything)
                this.updateTimer();
            else
                this.resetTimer();
        }, 100);
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
        return this.runHasStarted ? Math.trunc(Math.floor((difference % 1000)) / 100) : Math.trunc(Math.abs(Math.floor((difference % 1000)) / 100));
    }

    private startRun() {
        this.runHasStarted = true;
        (window as any).electron.send('og-start-run');
    }
}