import { UserBase } from "../user/user";
import { InteractionData } from "./interaction-data";

export class PositionData extends InteractionData {
    transX: number;
    transY: number;
    transZ: number;
    quatX: number;
    quatY: number;
    quatZ: number;
    quatW: number;
    rotY: number;
    tgtState: any;

    constructor() {
        super();
    }
}

export class PositionDataTimestamp extends PositionData {
    time: number;

    constructor(positionData: PositionData, time: number) {
        super();
        this.quatW = positionData.quatW;
        this.quatX = positionData.quatX;
        this.quatY = positionData.quatY;
        this.quatZ = positionData.quatZ;
        this.rotY = positionData.rotY;
        this.interType = positionData.interType;
        this.interAmount = positionData.interAmount;
        this.interName = positionData.interName;
        this.interParent = positionData.interParent;
        this.interLevel = positionData.interLevel;
        this.tgtState = positionData.tgtState;
        this.transX = positionData.transX;
        this.transY = positionData.transY;
        this.transZ = positionData.transZ;
        this.time = time;
    }
}

export class UserPositionDataTimestamp extends PositionDataTimestamp {
    userId: string;
    username: string;

    constructor(positionData: PositionData, time: number, user: UserBase) {
        super(positionData, time);
        this.time = time;
        this.userId = user.id;
        this.username = user.name;
    }
}


