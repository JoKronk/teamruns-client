import { GameState } from "./game-state";
import { PlayerState } from "./player-state";
import { Task } from "../opengoal/task";

export class Player {
    name: string;
    twitchName: string | null;
    gameState: GameState;
    state: PlayerState;

    constructor(name: string, twitchName: string | null) {
        this.name = name;
        this.twitchName = twitchName;
        this.state = PlayerState.Neutral;
        this.gameState = new GameState();
    }


}