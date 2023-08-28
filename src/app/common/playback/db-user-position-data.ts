import { PositionDataTimestamp } from "./position-data";

export class DbUserPositionData {
    userId: string;
    playback: PositionDataTimestamp[];

    constructor(userId: string) {
        this.userId = userId;
    }
}