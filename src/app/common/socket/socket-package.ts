import { InteractionType } from "../opengoal/interaction-type";
import { CurrentPositionData } from "./current-position-data";
import { GameSettings } from "./game-settings";
import { InteractionData } from "./interaction-data";
import { OgCommand } from "./og-command";
import { RemotePlayerInfo } from "./remote-player-info";

export class SocketPackage {
    command: OgCommand | undefined;
    gameSettings: GameSettings | undefined;
    selfInfo: RemotePlayerInfo | undefined;
    selfInteraction: InteractionData | undefined;
    controllerPort: number | undefined;
    username: string | undefined;
    players: CurrentPositionData[] | undefined;

    constructor() {
        this.command = undefined;
        this.gameSettings = undefined;
        this.selfInfo = undefined;
        this.selfInteraction = undefined;
        this.controllerPort = undefined;
        this.username = undefined;
        this.players = undefined;
    }

    checkSetSelfInteraction(interaction: InteractionData | undefined) { //currently only orb dupe interactions should be sent for local player
        if (!interaction) return;

        if (interaction.interType === InteractionType.money && interaction.interAmount < 0)
            this.selfInteraction = interaction;
    }

    resetOneTimeValues() {
        this.command = undefined;
        this.gameSettings = undefined;
        this.selfInfo = undefined;
        this.selfInteraction = undefined;
        this.controllerPort = undefined;
    }
}