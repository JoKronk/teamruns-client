import { InteractionType } from "../opengoal/interaction-type";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { UserBase } from "../user/user";
import { CurrentPositionData } from "./current-position-data";
import { InteractionData } from "./interaction-data";
import { PositionData } from "./position-data";

export class CurrentPlayerData {
    private positionDataFull: CurrentPositionData; // this always has the last values
    positionData: CurrentPositionData; // has the current values sent over socket, values are set to undefiend on repeat to not send duplicated data 

    userId: string;
    interactionBufferRateLimit: boolean = false;
    interactionBuffer: InteractionData[] = []; // updates gets pushed from top of list first
    recordingDataIndex: number | undefined; // only used by recordings

    constructor(user: UserBase, state: MultiplayerState) {
        this.positionData = new CurrentPositionData(user, state);
        this.positionDataFull = new CurrentPositionData(user, state);
        this.positionDataFull.username = undefined;
        this.userId = user.id;
        this.interactionBuffer = [];
    }

    hasInteractionUpdate(): boolean {
        return this.positionData.interaction !== undefined && this.positionData.interaction.interType !== InteractionType.none;
    }

    // returns if has updated
    updateCurrentPosition(positionData: PositionData, username: string, isLocalUser: boolean, recordingDataIndex: number | undefined = undefined) : boolean {
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

        if (positionData.quatW !== undefined && (this.positionDataFull.quatW === undefined || this.positionDataFull.quatW !== positionData.quatW)) {
            this.positionData.quatW = positionData.quatW;
            this.positionDataFull.quatW = positionData.quatW;
        } else this.positionData.quatW = undefined;
        
        if (positionData.quatX !== undefined && (this.positionDataFull.quatX === undefined || this.positionDataFull.quatX !== positionData.quatX)) {
            this.positionData.quatX = positionData.quatX;
            this.positionDataFull.quatX = positionData.quatX;
        } else this.positionData.quatX = undefined;
        
        if (positionData.quatY !== undefined && (this.positionDataFull.quatY === undefined || this.positionDataFull.quatY !== positionData.quatY)) {
            this.positionData.quatY = positionData.quatY;
            this.positionDataFull.quatY = positionData.quatY;
        } else this.positionData.quatY = undefined;
        
        if (positionData.quatZ !== undefined && (this.positionDataFull.quatZ === undefined || this.positionDataFull.quatZ !== positionData.quatZ)) {
            this.positionData.quatZ = positionData.quatZ;
            this.positionDataFull.quatZ = positionData.quatZ;
        } else this.positionData.quatZ = undefined;
        
        if (positionData.transX !== undefined && (this.positionDataFull.transX === undefined || this.positionDataFull.transX !== positionData.transX)) {
            this.positionData.transX = positionData.transX;
            this.positionDataFull.transX = positionData.transX;
        } else this.positionData.transX = undefined;
        
        if (positionData.transY !== undefined && (this.positionDataFull.transY === undefined || this.positionDataFull.transY !== positionData.transY)) {
            this.positionData.transY = positionData.transY;
            this.positionDataFull.transY = positionData.transY;
        } else this.positionData.transY = undefined;
        
        if (positionData.transZ !== undefined && (this.positionDataFull.transZ === undefined || this.positionDataFull.transZ !== positionData.transZ)) {
            this.positionData.transZ = positionData.transZ;
            this.positionDataFull.transZ = positionData.transZ;
        } else this.positionData.transZ = undefined;
        
        if (positionData.rotY !== undefined && (this.positionDataFull.rotY === undefined || this.positionDataFull.rotY !== positionData.rotY)) {
            this.positionData.rotY = positionData.rotY;
            this.positionDataFull.rotY = positionData.rotY;
        } else this.positionData.rotY = undefined;
        
        if (positionData.tgtState !== undefined && (this.positionDataFull.tgtState === undefined || this.positionDataFull.tgtState !== positionData.tgtState)) {
            this.positionData.tgtState = positionData.tgtState;
            this.positionDataFull.tgtState = positionData.tgtState;
        } else this.positionData.tgtState = undefined;
        
        if (positionData.currentLevel !== undefined && (this.positionDataFull.currentLevel === undefined || this.positionDataFull.currentLevel !== positionData.currentLevel)) {
            this.positionData.currentLevel = positionData.currentLevel;
            this.positionDataFull.currentLevel = positionData.currentLevel;
        } else this.positionData.currentLevel = undefined;
        
        this.checkUpdateUsername(username);

        return true;
    }

    checkUpdateUsername(username: string) {
        if (this.positionDataFull.username === undefined || this.positionDataFull.username !== username) {
            this.positionData.username = username;
            this.positionDataFull.username = username;
        } else this.positionData.username = undefined;
    }

    getCurrentUsername(): string {
        return this.positionDataFull.username ?? "";
    }

    resetLastPlayerInfo() {
        this.positionDataFull.currentLevel = undefined;
        this.positionDataFull.username = undefined;
    }

    isInLevel(levelSymbol: number | undefined): boolean {
        if (levelSymbol) {
        }
        return levelSymbol !== undefined && this.positionDataFull.currentLevel === levelSymbol || this.positionData.currentLevel === levelSymbol; 
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