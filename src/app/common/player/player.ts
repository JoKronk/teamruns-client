import { GameState } from "../opengoal/game-state";
import { PlayerState } from "./player-state";
import { UserBase } from "../user/user";
import { DbPlayer } from "../firestore/db-player";

export class Player {
    user: UserBase;
    cellsCollected: number = 0;
    currentLevel: string = "";
    gameState: GameState = new GameState();
    state: PlayerState = PlayerState.Neutral;

    constructor(user: UserBase) {
        this.user = user;
    }

    static fromDbPlayer(dbPlayer: DbPlayer): Player {
        let player: Player = new Player(dbPlayer.user);
        player.cellsCollected = dbPlayer.cellsCollected;
        return player;
    }


}