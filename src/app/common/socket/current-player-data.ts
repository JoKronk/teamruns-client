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
    interactionBufferRateLimit: number = 0;
    interactionBuffer: InteractionData[] = []; // updates gets pushed from top of list first

    isRecording: boolean = false;
    recordingDataIndex: number | undefined; // only used by recordings

    constructor(user: UserBase, state: MultiplayerState, isRecording: boolean) {
        this.positionData = new CurrentPositionData(user, state);
        this.positionDataFull = new CurrentPositionData(user, undefined);
        this.positionDataFull.username = undefined;
        this.userId = user.id;
        this.interactionBuffer = [];
        this.isRecording = isRecording;
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
        if (positionData.interType !== undefined && positionData.interType !== InteractionType.none) {
            if (this.hasInteractionUpdate() && !isLocalUser)
                this.interactionBuffer.push(InteractionData.getInteractionValues(positionData));
            else
                this.positionData.updateCurrentInteraction(positionData);
        }

        if (positionData.quatW !== undefined && (this.positionDataFull.quatW === undefined || this.positionDataFull.quatW !== positionData.quatW)) {
            this.positionData.quatW = positionData.quatW;
            this.positionDataFull.quatW = positionData.quatW;
        }
        
        if (positionData.quatX !== undefined && (this.positionDataFull.quatX === undefined || this.positionDataFull.quatX !== positionData.quatX)) {
            this.positionData.quatX = positionData.quatX;
            this.positionDataFull.quatX = positionData.quatX;
        }
        
        if (positionData.quatY !== undefined && (this.positionDataFull.quatY === undefined || this.positionDataFull.quatY !== positionData.quatY)) {
            this.positionData.quatY = positionData.quatY;
            this.positionDataFull.quatY = positionData.quatY;
        }
        
        if (positionData.quatZ !== undefined && (this.positionDataFull.quatZ === undefined || this.positionDataFull.quatZ !== positionData.quatZ)) {
            this.positionData.quatZ = positionData.quatZ;
            this.positionDataFull.quatZ = positionData.quatZ;
        }
        
        if (positionData.transX !== undefined && (this.positionDataFull.transX === undefined || this.positionDataFull.transX !== positionData.transX)) {
            this.positionData.transX = positionData.transX;
            this.positionDataFull.transX = positionData.transX;
        }
        
        if (positionData.transY !== undefined && (this.positionDataFull.transY === undefined || this.positionDataFull.transY !== positionData.transY)) {
            this.positionData.transY = positionData.transY;
            this.positionDataFull.transY = positionData.transY;
        }
        
        if (positionData.transZ !== undefined && (this.positionDataFull.transZ === undefined || this.positionDataFull.transZ !== positionData.transZ)) {
            this.positionData.transZ = positionData.transZ;
            this.positionDataFull.transZ = positionData.transZ;
        }
        
        if (positionData.rotY !== undefined && (this.positionDataFull.rotY === undefined || this.positionDataFull.rotY !== positionData.rotY)) {
            this.positionData.rotY = positionData.rotY;
            this.positionDataFull.rotY = positionData.rotY;
        }
        
        if (positionData.tgtState !== undefined && (this.positionDataFull.tgtState === undefined || this.positionDataFull.tgtState !== positionData.tgtState)) {
            this.positionData.tgtState = positionData.tgtState;
            this.positionDataFull.tgtState = positionData.tgtState;
        }
        
        if (positionData.currentLevel !== undefined && (this.positionDataFull.currentLevel === undefined || this.positionDataFull.currentLevel !== positionData.currentLevel)) {
            this.positionData.currentLevel = positionData.currentLevel;
            this.positionDataFull.currentLevel = positionData.currentLevel;
        }
        
        this.checkUpdateUsername(username);

        return true;
    }

    checkUpdateUsername(username: string) {
        if (this.positionDataFull.username === undefined || this.positionDataFull.username !== username) {
            this.positionData.username = username;
            this.positionDataFull.username = username;
            
        }
    }

    getCurrentUsername(): string {
        return this.positionDataFull.username ?? "";
    }

    getCurrentLevel(): number | undefined {
        return this.positionDataFull.currentLevel ?? this.positionData.currentLevel;
    }

    addCurrentLevelUpdate() {
        if (this.positionData.currentLevel === undefined)
            this.positionData.currentLevel = this.positionDataFull.currentLevel;
    }

    resetNoneOverwritableValues() {
        this.positionDataFull.currentLevel = undefined;
        this.positionDataFull.username = undefined;
    }

    //if potentially set from outside main draw loop use this
    sideLoadNewMpState(newMpState: MultiplayerState) {
        this.positionData.mpState = newMpState;
        this.positionDataFull.mpState = newMpState;
    }

    resetStoredMpState() {
        this.positionDataFull.mpState = undefined;
    }

    resetStoredValues() {
        this.positionDataFull.resetData();
    }

    fillPositionValues() {
        this.positionData.fillFromCopy(this.positionDataFull);
    }

    transferInternallySetValuesToPositionDataFull() {
        if (this.positionData.mpState !== undefined && this.positionDataFull.mpState !== this.positionData.mpState)
            this.positionDataFull.mpState = this.positionData.mpState;

        if (this.positionData.color !== undefined && this.positionDataFull.color !== this.positionData.color)
            this.positionDataFull.color = this.positionData.color;
    }

    isInLevel(levelSymbol: number | undefined): boolean {
        if (levelSymbol) {
        }
        return levelSymbol !== undefined && this.positionDataFull.currentLevel === levelSymbol || this.positionData.currentLevel === levelSymbol; 
    }

    isInState(state: MultiplayerState, orUndefined: boolean = false) {
        if (orUndefined && this.positionDataFull.mpState === undefined && this.positionData.mpState === undefined)
            return true;

        return this.positionDataFull.mpState === state;
    }

    checkUpdateInteractionFromBuffer() {
        if (this.hasInteractionUpdate() || this.interactionBuffer.length == 0)
            return;

        if (this.interactionBufferRateLimit > 0) {
            this.interactionBufferRateLimit -= 1;
            
            if (this.interactionBufferRateLimit >= 1)
                return;
        }

        if (this.interactionBuffer.length >= 10 && this.interactionBufferRateLimit <= 0)
            this.interactionBufferRateLimit = 3;

        const interactionData: InteractionData | undefined = this.interactionBuffer.shift();
        if (interactionData)
            this.positionData.updateCurrentInteraction(interactionData);
    }
}