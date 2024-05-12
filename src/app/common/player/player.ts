import { GameState } from "../opengoal/game-state";
import { PlayerState } from "./player-state";
import { UserBase } from "../user/user";
import { DbPlayer } from "../firestore/db-player";
import { PlayerType } from "./player-type";
import { PlayerBase } from "./player-base";

export class Player extends PlayerBase {
    cellsCollected: number = 0;
    currentLevel: string = "";
    gameState: GameState = new GameState();
    state: PlayerState = PlayerState.Neutral;

    constructor(user: UserBase, type: PlayerType) {
        super(user, type);
    }

    static fromDbPlayer(dbPlayer: DbPlayer): Player {
        let player: Player = new Player(dbPlayer.user, PlayerType.User);
        player.cellsCollected = dbPlayer.cellsCollected;
        return player;
    }


}