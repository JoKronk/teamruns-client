import { Color } from "../opengoal/color";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { UserBase } from "../user/user";

export class PositionData {
    transX: number;
    transY: number;
    transZ: number;
    quatX: number;
    quatY: number;
    quatZ: number;
    quatW: number;
    rotY: number;
    interType: number;
    interAmount: number;
    interName: string;
    interParent: string;
    interLevel: string;
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



export class CurrentPositionData extends PositionData {
    userId: string;
    username: string;
    color: Color;
    mpState: MultiplayerState;

    recordingDataIndex: number | undefined; // only used by recordings

    constructor(user: UserBase, state: MultiplayerState) {
        super();
        this.username = user.name;
        this.userId = user.id;
        this.mpState = state;
        this.color = Color.normal;
    }

    // returns if has updated
    updateCurrentPosition(positionData: PositionData, recordingDataIndex: number | undefined = undefined) : boolean {
        if (recordingDataIndex) {
            if (recordingDataIndex === this.recordingDataIndex)
                return false;
            else
                this.recordingDataIndex = recordingDataIndex;
        }

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

        return true;
    }


}



