import { InteractionType } from "../opengoal/interaction-type";
import { PositionDataTimestamp } from "../playback/position-data";

export class CrateBase {
    ename: string;
    type: InteractionType;
    pickupAmount: number;

    constructor(ename: string, type: InteractionType, pickupAmount: number) {
        this.ename = ename;
        this.type = type;
        this.pickupAmount = pickupAmount;
    }
}

export class Crate extends CrateBase {
    level: string;

    constructor(base: CrateBase, level: string) {
        super(base.ename, base.type, base.pickupAmount);
        this.level = level;
    }

    public static fromPositionData(positionData: PositionDataTimestamp): Crate {
        return {
            ename: positionData.interName,
            type: positionData.interType,
            pickupAmount: positionData.interAmount,
            level: positionData.interLevel
        }
    }

    public static isBuzzerType(type: InteractionType) {
        return type === InteractionType.crateIron;
    }

    public static isOrbsType(type: InteractionType) {
        return type === InteractionType.crateSteel;
    }
}