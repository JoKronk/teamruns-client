import { GameState } from "./game-state";
import { PlayerState } from "./player-state";
import { Task } from "../run/task";

export class Player {
    name: string;
    gameState: GameState;
    state: PlayerState;

    constructor(name: string) {
        this.name = name;
        this.state = PlayerState.Neutral;
        this.gameState = new GameState();
    }


}