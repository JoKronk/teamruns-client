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
    color: Color;
    mpState: MultiplayerState;

    constructor(user: UserBase, state: MultiplayerState) {
        this.username = user.name;
        this.userId = user.id;
        this.mpState = state;
        this.color = Color.normal;
    }

    updateCurrentInteraction(interactionData: InteractionData) {
        this.interaction = InteractionData.getInteractionValues(interactionData);
    }

    onDisconnectCleanup() {
        this.cleanupOneTimeData();
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
        this.username = "";
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
