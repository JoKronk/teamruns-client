import { User } from "../user/user";
import { CurrentPositionData } from "./current-position-data";
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
    currentLevel: string;

    constructor() {
        super();
    }
}

export class UserPositionData extends PositionData {
    userId: string;
    username: string;

    constructor(positionData: PositionData, time: number, user: User) {
        super();
        this.quatW = positionData.quatW;
        this.quatX = positionData.quatX;
        this.quatY = positionData.quatY;
        this.quatZ = positionData.quatZ;
        this.rotY = positionData.rotY;
        this.interType = positionData.interType;
        this.interAmount = positionData.interAmount;
        this.interStatus = positionData.interStatus;
        this.interName = positionData.interName;
        this.interParent = positionData.interParent;
        this.interLevel = positionData.interLevel;
        this.interCleanup = positionData.interCleanup;
        this.tgtState = positionData.tgtState;
        this.currentLevel = positionData.currentLevel;
        this.transX = positionData.transX;
        this.transY = positionData.transY;
        this.transZ = positionData.transZ;
        this.time = time;
        this.userId = user.id;
        this.username = user.displayName ?? user.name;
    }
    

    static fromCurrentPositionDataWithoutInteraction(positionData: CurrentPositionData, time: number) : UserPositionData {
        return {
            transX: positionData.transX, 
            transY: positionData.transY, 
            transZ: positionData.transZ, 
            quatX: positionData.quatX, 
            quatY: positionData.quatY, 
            quatZ: positionData.quatZ, 
            quatW: positionData.quatW, 
            rotY: positionData.rotY, 
            tgtState: positionData.tgtState, 
            currentLevel: positionData.currentLevel, 
            interType: 0,
            interAmount: 0,
            interStatus: 0,
            interName: "",
            interParent: "",
            interLevel: "",
            interCleanup: false,
            userId: positionData.userId,
            username: positionData.username,
            time: time
        }
    }
}


