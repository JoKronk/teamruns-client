import { UserBase } from "../user/user";

export class PositionData {
    transX: number;
    transY: number;
    transZ: number;
    quatX: number;
    quatY: number;
    quatZ: number;
    quatW: number;
    tgtState: any;

    constructor() {
        
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
        this.tgtState = positionData.tgtState;
        this.transX = positionData.transX;
        this.transY = positionData.transY;
        this.transZ = positionData.transZ;
        this.time = time;
    }
}

export class UserPositionDataTimestamp extends PositionDataTimestamp {
    userId: string;

    constructor(positionData: PositionData, time: number, userId: string) {
        super(positionData, time);
        this.userId = userId;
    }
}



export class CurrentPositionData extends PositionData {
    playerId: number;
    user: UserBase;

    constructor(user: UserBase, playerId: number) {
        super();
        this.user = user;
        this.playerId = playerId;
    }

    updateCurrentPosition(positionData: PositionData) {
        this.quatW = positionData.quatW;
        this.quatX = positionData.quatX;
        this.quatY = positionData.quatY;
        this.quatZ = positionData.quatZ;
        this.tgtState = positionData.tgtState;
        this.transX = positionData.transX;
        this.transY = positionData.transY;
        this.transZ = positionData.transZ;
    }


}



