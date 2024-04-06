import { Color } from "../opengoal/color";
import { MultiplayerState } from "../opengoal/multiplayer-state";
import { UserBase } from "../user/user";
import { InteractionData } from "./interaction-data";
import { RemotePlayerInfo } from "./remote-player-info";

export class CurrentPositionData {
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
    
    interaction: InteractionData | undefined;
    playerInfo: RemotePlayerInfo | undefined;

    userId: string;
    private username: string | undefined;
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

    updateUsername(username: string) {
        this.username = username;
    }

    cleanupOneTimeData() {
        this.resetPositionDataUsername();
        this.resetCurrentInteraction();
        this.resetCurrentInfo();
    }
    
    resetPositionDataUsername() {
        this.username = undefined;
    }

    resetCurrentInteraction() {
        this.interaction = undefined;
    }

    resetCurrentInfo() {
        this.playerInfo = undefined;
    }
}
