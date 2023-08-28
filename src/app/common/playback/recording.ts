
import { Timer } from "../run/timer";
import { PositionData, PositionDataTimestamp } from "./position-data";

export class Recording {
    timer: Timer;
    playback: PositionDataTimestamp[];
    private userId;

    positionListener: any;

    constructor(userId: string) {
        this.userId = userId;

        this.positionListener = (window as any).electron.receive("og-position-update", (target: PositionData) => {
            if (this.timer.totalMs === 0) return;

            this.playback.push(new PositionDataTimestamp(target, this.timer.totalMs));
        });
    }

    destroy() {
        this.positionListener();
    }
}