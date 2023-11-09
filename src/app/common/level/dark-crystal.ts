import { UserPositionDataTimestamp } from "../playback/position-data";


export class DarkCrystal {
    ename: string;
    level: string;

    constructor(ename: string, level: string) {
        this.ename = ename;
        this.level = level;
    }

    public static fromPositionData(positionData: UserPositionDataTimestamp): DarkCrystal {
        return {
            ename: positionData.interName,
            level: positionData.interLevel
        }
    }
}