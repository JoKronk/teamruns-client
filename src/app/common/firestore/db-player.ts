import { Player } from "../player/player";
import { PlayerState } from "../player/player-state";
import { UserBase } from "../user/user";

export class DbPlayer {
    user: UserBase;
    cellsCollected: number = 0;
    state: PlayerState = PlayerState.Neutral;

    currentUsernameFrontend: string;

    constructor(player: Player) {
        this.user = player.user;
        this.cellsCollected = player.cellsCollected;
        this.state = player.state;
    }
}