import { PlayerBase } from "../player/player-base";

export class LobbyUser extends PlayerBase {
    isRunner: boolean;

    constructor(player: PlayerBase, runner: boolean = false) {
        super(player.user, player.type);
        this.isRunner = runner;
    }
}