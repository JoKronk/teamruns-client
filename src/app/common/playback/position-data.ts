import { Color } from "../opengoal/color";
import { InteractionType } from "../opengoal/interaction-type";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { UserBase } from "../user/user";

export class InteractionData {
    interType: number;
    interAmount: number;
    interName: string;
    interParent: string;
    interLevel: string;

    constructor() {
        
    }

    static fromPositionData(positionData: PositionData) : InteractionData {
        return {
            interType: positionData.interType,
            interAmount: positionData.interAmount,
            interName: positionData.interName,
            interParent: positionData.interParent,
            interLevel: positionData.interLevel
        }
    }
}

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



export class CurrentPositionData extends PositionData {
    userId: string;
    username: string;
    color: Color;
    mpState: MultiplayerState;

    interactionBuffer: InteractionData[] = []; // updates gets pushed from top of list first
    hasFrameUpdate: boolean;
    recordingDataIndex: number | undefined; // only used by recordings

    constructor(user: UserBase, state: MultiplayerState) {
        super();
        this.username = user.name;
        this.userId = user.id;
        this.mpState = state;
        this.color = Color.normal;
        this.hasFrameUpdate = false;
        this.interactionBuffer = [];
    }

    // returns if has updated
    updateCurrentPosition(positionData: PositionData, recordingDataIndex: number | undefined = undefined) : boolean {
        if (recordingDataIndex) {
            if (recordingDataIndex === this.recordingDataIndex)
                return false;
            else
                this.recordingDataIndex = recordingDataIndex;
        }
        
        //check if overwriting unsent position update with interaction
        const bufferInteraction = this.hasFrameUpdate && this.interType !== InteractionType.none;
        if (bufferInteraction)
            this.interactionBuffer.push(InteractionData.fromPositionData(positionData));


        this.quatW = positionData.quatW;
        this.quatX = positionData.quatX;
        this.quatY = positionData.quatY;
        this.quatZ = positionData.quatZ;
        this.rotY = positionData.rotY;
        this.tgtState = positionData.tgtState;
        this.transX = positionData.transX;
        this.transY = positionData.transY;
        this.transZ = positionData.transZ;
        if (!bufferInteraction) 
            this.updateCurrentInteraction(positionData);

        this.hasFrameUpdate = true;

        return true;
    }

    checkUpdateInteractionFromBuffer() {
        if (this.interactionBuffer.length == 0 || this.interType !== InteractionType.none)
            return;

        const interactionData: InteractionData | undefined = this.interactionBuffer.shift();
        if (interactionData) {
            this.updateCurrentInteraction(interactionData);
            this.hasFrameUpdate = true;
        }
    }

    updateCurrentInteraction(interactionData: InteractionData) {
        this.interType = interactionData.interType;
        this.interAmount = interactionData.interAmount;
        this.interName = interactionData.interName;
        this.interParent = interactionData.interParent;
        this.interLevel = interactionData.interLevel;
    }

    resetCurrentInteraction() {
        this.interType = 0;
        this.interAmount = 0;
        this.interName = "";
        this.interParent = "";
        this.interLevel = "";
    }


}



