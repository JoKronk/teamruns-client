import { CurrentPositionData } from "./current-position-data";
import { GameSettings } from "./game-settings";
import { InteractionData } from "./interaction-data";
import { NotificationPackage } from "./notification-package";
import { OgCommand } from "./og-command";
import { RemotePlayerInfo } from "./remote-player-info";
import { TimerPackage } from "./timer-package";

export class SocketPackage {
    command: OgCommand | undefined;
    gameSettings: GameSettings | undefined;
    selfInfo: RemotePlayerInfo | undefined;
    selfInteraction: InteractionData | undefined;
    forceContinue: string | undefined;
    controllerPort: number | undefined;
    username: string | undefined;
    version: string | undefined;
    players: CurrentPositionData[] | undefined;
    timer: TimerPackage | undefined;
    notification: NotificationPackage | undefined;

    constructor() {
        this.command = undefined;
        this.gameSettings = undefined;
        this.selfInfo = undefined;
        this.selfInteraction = undefined;
        this.forceContinue = undefined;
        this.controllerPort = undefined;
        this.username = undefined;
        this.version = undefined;
        this.players = undefined;
        this.timer = undefined;
        this.notification = undefined;
    }

    resetOneTimeValues() {
        this.command = undefined;
        this.gameSettings = undefined;
        this.selfInfo = undefined;
        this.selfInteraction = undefined;
        this.forceContinue = undefined;
        this.controllerPort = undefined;
        this.version = undefined;
        this.username = undefined;
        this.timer?.resetSplitData();
        this.notification = undefined;
    }
}