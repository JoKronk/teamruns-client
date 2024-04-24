import { CrateType } from "../opengoal/crate-type";
import { InteractionType } from "../opengoal/interaction-type";
import { RecordingPositionData } from "../recording/recording-position-data";
import { UserPositionData } from "./position-data";

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

    static isFromOrbCollection(interaction: InteractionData): boolean {
        return interaction.interType === InteractionType.money && ((interaction.interName === "money" || interaction.interName === "") && interaction.interParent !== undefined);
    }

    //orb collection interactions are never equal, thus areIdentical()
    static areIdentical(interaction1: InteractionData, interaction2: InteractionData): boolean {
        return interaction1.interType === interaction2.interType
        && interaction1.interName === interaction2.interName
        && interaction1.interAmount === interaction2.interAmount
        && interaction1.interStatus === interaction2.interStatus
        && interaction1.interParent === interaction2.interParent;
        //&& interaction1.interLevel === interaction2.interLevel;

        //level check removed as cleanup interaction will trigger for the cleanup player already in the level they are entering from, giving a false level origin in comparison to the original interaction once sent back to the client
        //example: p1 kills pelican in beach, p2 on beach load will have the pelican killed while in village1, sending a pelican killed interaction for him from village1 instead of beach
    }

    public static isBuzzerCrate(interaction: InteractionData) {
        return interaction.interType === InteractionType.crate && interaction.interStatus === CrateType.crateIron;
    }

    public static isOrbsCrate(interaction: InteractionData) {
        return interaction.interType === InteractionType.crate && interaction.interStatus === CrateType.crateSteel;
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