import { State } from "./state";
import { Task } from "../run/task";

export class Player {
    name: string;
    state: State;
    ready: boolean;
    wantsToReset: boolean;

    constructor(name: string) {
        this.name = name;
        this.ready = false;
        this.wantsToReset = false;
        this.state = new State();
    }


}