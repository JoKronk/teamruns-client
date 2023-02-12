import { State } from "./state";
import { Task } from "../run/task";

export class Player {
    name: string;
    state: State;
    ready: boolean;

    constructor(name: string) {
        this.name = name;
        this.ready = false;
        this.state = new State();
    }


}