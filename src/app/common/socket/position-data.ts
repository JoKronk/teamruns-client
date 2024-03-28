import { UserBase } from "../user/user";
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

export class RecordingPositionData { //these names are shortened to reduce file size
    iT: number | undefined; //interType
    iA: number | undefined; //interAmount
    iS: number | undefined; //interStatus
    iN: string | undefined; //interName
    iP: string | undefined; //interParent
    iL: string | undefined; //interLevel
    iC: boolean | undefined; //interCleanup
    tX: number | undefined; //transX
    tY: number | undefined; //transY
    tZ: number | undefined; //transZ
    qX: number | undefined; //quatX
    qY: number | undefined; //quatY
    qZ: number | undefined; //quatZ
    qW: number | undefined; //quatW
    rY: number | undefined; //rotY
    tS: any | undefined; //tgtState
    cL: string | undefined; //currentLevel
    t: number; //time

    constructor () {

    }
}

export class UserPositionData extends PositionData {
    userId: string;
    username: string;

    constructor(positionData: PositionData, time: number, user: UserBase) {
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
        this.username = user.name;
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


