import { UserPositionDataTimestamp } from "./position-data";

export class InteractionData {
    interType: number;
    interAmount: number;
    interStatus: number = 0;
    interName: string;
    interParent: string;
    interLevel: string;
    interCleanup: boolean = false;

    constructor() {
        
    }

    static getInteractionValues(interactionData: InteractionData) : InteractionData {
        return {
            interType: interactionData.interType,
            interAmount: interactionData.interAmount,
            interStatus: interactionData.interStatus,
            interName: interactionData.interName,
            interParent: interactionData.interParent,
            interLevel: interactionData.interLevel,
            interCleanup: interactionData.interCleanup
        }
    }
}

export class UserInteractionData extends InteractionData {
    userId: string;

    constructor(positionData: InteractionData, userId: string) {
        super();

        this.interType = positionData.interType,
        this.interAmount = positionData.interAmount,
        this.interName = positionData.interName,
        this.interParent = positionData.interParent,
        this.interLevel = positionData.interLevel,
        this.userId = userId;
    }

    static fromUserPositionData(positionData: UserPositionDataTimestamp) : UserInteractionData {
        return {
            interType: positionData.interType,
            interAmount: positionData.interAmount,
            interStatus: positionData.interStatus,
            interName: positionData.interName,
            interParent: positionData.interParent,
            interLevel: positionData.interLevel,
            interCleanup: positionData.interCleanup,
            userId: positionData.userId
        }
    }
}