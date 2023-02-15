import { Player } from "../player/player";
import { Task } from "./task";


export class Team {
    name: string;
    players: Player[];
    tasks: Task[];
    owner: string;

    constructor(name: string) {
        this.name = name;
        this.players = [ ];
        this.tasks = [ ];
        this.owner = "";
    }
}