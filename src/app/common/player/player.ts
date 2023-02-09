import { PlayerData } from "./player-data";
import { State } from "./state";
import { Task } from "./task";

export class Player extends PlayerData {
    state: State;
    tasks: Task[];

    constructor() {
        super();
    }


}