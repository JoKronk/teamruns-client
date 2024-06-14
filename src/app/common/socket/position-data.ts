import { UserBase } from "../user/user";
import { InteractionData, UserInteractionData } from "./interaction-data";

export class PositionData extends InteractionData {
    transX: number;
    transY: number;
    transZ: number;
    quatX: number;
    quatY: number;
    quatZ: number;
    quatW: number;
    rotY: number;
    tgtState: number | undefined; //symbol number
    currentLevel: number | undefined; //symbol number

    constructor() {
        super();
    }
}

export class UserPositionData extends PositionData {
    userId: string;
    username: string;

    constructor(positionData: PositionData, time: number, userId: string, username: string) {
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
        this.userId = userId;
        this.username = username;
    }

    static fromUserInteractionData(positionData: UserInteractionData, player: UserBase, forceNoneCleanup: boolean = false) : UserPositionData {
        return {
            quatW: 0,
            quatX: 0,
            quatY: 0,
            quatZ: 0,
            rotY: 0,
            transX: 0,
            transY: 0,
            transZ: 0,
            tgtState: undefined,
            currentLevel: undefined,
            interType: positionData.interType,
            interAmount: positionData.interAmount,
            interStatus: positionData.interStatus,
            interName: positionData.interName,
            interParent: positionData.interParent,
            interLevel: positionData.interLevel,
            interCleanup: forceNoneCleanup ? false : positionData.interCleanup,
            time: positionData.time,
            username: player.name,
            userId: player.id
        }
    }
}


