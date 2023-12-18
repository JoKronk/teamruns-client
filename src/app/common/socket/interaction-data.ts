import { InteractionType } from "../opengoal/interaction-type";
import { RecordingPositionData, UserPositionData } from "./position-data";

export class InteractionData {
    interType: number;
    interAmount: number;
    interStatus: number;
    interName: string;
    interParent: string;
    interLevel: string;
    interCleanup: boolean = false;
    time: number;

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
            interCleanup: interactionData.interCleanup,
            time: interactionData.time
        }
    }

    static getRecordingInteractionValues(recData: RecordingPositionData) : InteractionData {
        return {
            interType: recData.iT ?? InteractionType.none,
            interAmount: recData.iA ?? 0,
            interStatus: recData.iS ?? 0,
            interName: recData.iN ?? "",
            interParent: recData.iP ?? "",
            interLevel: recData.iL ?? "",
            interCleanup: recData.iC ?? false,
            time: recData.t
        }
    }

    public static isBuzzerCrate(type: InteractionType) {
        return type === InteractionType.crateIron;
    }

    public static isOrbsCrate(type: InteractionType) {
        return type === InteractionType.crateSteel;
    }
}

export class UserInteractionData extends InteractionData {
    userId: string;

    constructor(positionData: InteractionData, userId: string) {
        super();

        this.interType = positionData.interType;
        this.interAmount = positionData.interAmount;
        this.interStatus = positionData.interStatus;
        this.interName = positionData.interName;
        this.interParent = positionData.interParent;
        this.interLevel = positionData.interLevel;
        this.interCleanup = positionData.interCleanup;
        this.userId = userId;
    }

    static fromUserPositionData(positionData: UserPositionData) : UserInteractionData {
        return {
            interType: positionData.interType,
            interAmount: positionData.interAmount,
            interStatus: positionData.interStatus,
            interName: positionData.interName,
            interParent: positionData.interParent,
            interLevel: positionData.interLevel,
            interCleanup: positionData.interCleanup,
            time: positionData.time,
            userId: positionData.userId
        }
    }

    static fromInteractionData(interaction: InteractionData, userId: string) : UserInteractionData {
        return {
            interType: interaction.interType,
            interAmount: interaction.interAmount,
            interStatus: interaction.interStatus,
            interName: interaction.interName,
            interParent: interaction.interParent,
            interLevel: interaction.interLevel,
            interCleanup: interaction.interCleanup,
            time: interaction.time,
            userId: userId
        }
    }
}