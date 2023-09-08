import { OG } from "../opengoal/og";
import { RunState } from "./run-state";

export class Timer {
    constructor() {
        
    }

    public static getHour(ms: number): number {
        return Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    }
    public static getMinutes(ms: number): string {
        return ("0" + Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))).slice(-2);
    }

    public static getSecond(ms: number): string {
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

    public static msToTimeTextFormat(ms: number) {
        let hour = Timer.getHour(ms);
        let time = "";
        if (hour)
            time += hour + "h ";
        time +=  + Timer.getMinutes(ms) + "m " + Timer.getSecond(ms) + "s";
        return time;
    }

    public static timeToMs(time: string): number {
        if (time === "DNF")
            return 0;
        let timeArray: number[] = time.replace(".", ":").split(":").map(x => +x).reverse();
        return (timeArray[0] * 100) + (timeArray[1] * 1000) + (!timeArray[2] ? 0 : timeArray[2] * 60000) + (!timeArray[3] ? 0 : timeArray[3] * 3600000);
    }
}