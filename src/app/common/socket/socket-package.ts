import { CurrentPositionData } from "./current-position-data";
import { GameSettings } from "./game-settings";
import { OgCommand } from "./og-command";
import { RemotePlayerInfo } from "./remote-player-info";

export class SocketPackage {
    command: OgCommand | undefined;
    gameSettings: GameSettings | undefined;
    selfInfo: RemotePlayerInfo | undefined;
    username: string | undefined;
    controllerPort: number | undefined;
    players: CurrentPositionData[] | undefined;

    constructor() {
        this.command = undefined;
        this.gameSettings = undefined;
        this.selfInfo = undefined;
        this.username = undefined;
        this.controllerPort = undefined;
        this.players = undefined;
    }
}