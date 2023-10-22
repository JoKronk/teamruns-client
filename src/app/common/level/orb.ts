import { UserPositionDataTimestamp } from "../playback/position-data";

export class OrbBase {
    ename: string;
    parentEname: string;

    constructor(ename: string, parentEname: string) {
        this.ename = ename;
        this.parentEname = parentEname;
    }
}

export class Orb extends OrbBase {
    level: string;

    constructor(base: OrbBase, level: string) {
        super(base.ename, base.parentEname);
        this.level = level;
    }

    public static fromPositionData(positionData: UserPositionDataTimestamp): Orb {
        return {
            ename: positionData.interName,
            parentEname: positionData.interParent,
            level: positionData.interLevel
        }
    }
}