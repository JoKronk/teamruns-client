import { GameState } from "./game-state";
import { PlayerState } from "./player-state";
import { UserBase } from "../user/user";

export class Player {
    user: UserBase
    gameState: GameState;
    state: PlayerState;

    constructor(user: UserBase) {
        this.user = user;
        this.state = PlayerState.Neutral;
        this.gameState = new GameState();
    }


}