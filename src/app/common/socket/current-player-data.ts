import { InteractionType } from "../opengoal/interaction-type";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { UserBase } from "../user/user";
import { CurrentPositionData } from "./current-position-data";
import { InteractionData } from "./interaction-data";
import { PositionData } from "./position-data";

export class CurrentPlayerData {
    positionData: CurrentPositionData;

    interactionBufferRateLimit: boolean = false;
    interactionBuffer: InteractionData[] = []; // updates gets pushed from top of list first
    recordingDataIndex: number | undefined; // only used by recordings

    constructor(user: UserBase, state: MultiplayerState) {
        this.positionData = new CurrentPositionData(user, state);
        this.interactionBuffer = [];
    }

    hasInteractionUpdate(): boolean {
        return this.positionData.interaction !== undefined && this.positionData.interaction.interType !== InteractionType.none;
    }

    hasInfoUpdate(): boolean {
        return this.positionData.playerInfo != undefined;
    }

    // returns if has updated
    updateCurrentPosition(positionData: PositionData, isLocalUser: boolean, recordingDataIndex: number | undefined = undefined) : boolean {
        if (recordingDataIndex) {
            if (recordingDataIndex === this.recordingDataIndex)
                return false;
            else
                this.recordingDataIndex = recordingDataIndex;
        }

        //handle interaction data
        if (positionData.interType !== InteractionType.none) {
            if (this.hasInteractionUpdate() && !isLocalUser)
                this.interactionBuffer.push(InteractionData.getInteractionValues(positionData));
            else
                this.positionData.updateCurrentInteraction(positionData);
        }

        this.positionData.quatW = positionData.quatW;
        this.positionData.quatX = positionData.quatX;
        this.positionData.quatY = positionData.quatY;
        this.positionData.quatZ = positionData.quatZ;
        this.positionData.rotY = positionData.rotY;
        this.positionData.tgtState = positionData.tgtState;
        this.positionData.currentLevel = positionData.currentLevel;
        this.positionData.transX = positionData.transX;
        this.positionData.transY = positionData.transY;
        this.positionData.transZ = positionData.transZ;

        return true;
    }

    checkUpdateInteractionFromBuffer() {
        if (this.hasInteractionUpdate() || this.interactionBuffer.length == 0)
            return;

        if (this.interactionBuffer.length >= 3) {
            this.interactionBufferRateLimit = !this.interactionBufferRateLimit;
            if (this.interactionBufferRateLimit)
                return;
        }

        const interactionData: InteractionData | undefined = this.interactionBuffer.shift();
        if (interactionData)
            this.positionData.updateCurrentInteraction(interactionData);
    }
}