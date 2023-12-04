import { GameState } from "../opengoal/game-state";
import { PlayerState } from "./player-state";
import { UserBase } from "../user/user";

export class Player {
    user: UserBase;
    cellsCollected: number = 0;
    currentLevel: string = "";
    gameState: GameState = new GameState();
    state: PlayerState = PlayerState.Neutral;

    constructor(user: UserBase) {
        this.user = user;
    }


}