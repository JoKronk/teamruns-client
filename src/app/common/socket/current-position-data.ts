import { Color } from "../opengoal/color";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { UserBase } from "../user/user";
import { InteractionData } from "./interaction-data";
import { RemotePlayerInfo } from "./remote-player-info";

export class CurrentPositionData {
    transX: number | undefined;
    transY: number | undefined;
    transZ: number | undefined;
    quatX: number | undefined;
    quatY: number | undefined;
    quatZ: number | undefined;
    quatW: number | undefined;
    rotY: number | undefined;
    tgtState: number | undefined; //symbol number
    currentLevel: number | undefined; //symbol number
    
    interaction: InteractionData | undefined;
    playerInfo: RemotePlayerInfo | undefined;

    userId: string;
    username: string | undefined;
    color: Color | undefined;
    mpState: MultiplayerState | undefined;

    constructor(user: UserBase, state: MultiplayerState | undefined) {
        this.username = user.name;
        this.userId = user.id;
        this.mpState = state;
        this.color = Color.normal;
    }

    updateCurrentInteraction(interactionData: InteractionData) {
        this.interaction = InteractionData.getInteractionValues(interactionData);
    }

    resetData() {
        this.transX = undefined;
        this.transY = undefined;
        this.transZ = undefined;
        this.quatX = undefined;
        this.quatY = undefined;
        this.quatZ = undefined;
        this.quatW = undefined;
        this.rotY = undefined;
        this.tgtState = undefined;
        this.currentLevel = undefined;
        this.username = undefined;
        this.color = undefined;
        this.mpState = undefined;
        this.cleanupOneTimeData();
    }

    fillFromCopy(positionData: CurrentPositionData) {
        if (this.transX === undefined) this.transX = positionData.transX;
        if (this.transY === undefined) this.transY = positionData.transY;
        if (this.transZ === undefined) this.transZ = positionData.transZ;
        if (this.quatW === undefined) this.quatW = positionData.quatW;
        if (this.quatX === undefined) this.quatX = positionData.quatX;
        if (this.quatY === undefined) this.quatY = positionData.quatY;
        if (this.quatZ === undefined) this.quatZ = positionData.quatZ;
        if (this.rotY === undefined) this.rotY = positionData.rotY;
        if (this.tgtState === undefined) this.tgtState = positionData.tgtState;
        if (this.currentLevel === undefined) this.currentLevel = positionData.currentLevel;
        if (this.userId === undefined) this.userId = positionData.userId;
        if (this.username === undefined) this.username = positionData.username;
        if (this.color === undefined) this.color = positionData.color;
        if (this.mpState === undefined) this.mpState = positionData.mpState;

        if (!this.interaction && positionData.interaction)
            this.interaction = InteractionData.getInteractionValues(positionData.interaction);
    }

    cleanupOneTimeData() {
        this.resetCurrentInteraction();
        this.resetCurrentInfo();
    }

    resetCurrentInteraction() {
        this.interaction = undefined;
    }

    resetCurrentInfo() {
        this.playerInfo = undefined;
    }
}
