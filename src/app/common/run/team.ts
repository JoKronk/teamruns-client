import { Player } from "../player/player";
import { Task } from "./task";

export class Team {
    name: string;
    playerCap: number;
    players: Player[];
    tasks: Task[];
    isPlayersCurrentTeam: boolean;
    owner: string;

    constructor(name: string, cap: number) {
        this.name = name;
        this.playerCap = cap;
        this.isPlayersCurrentTeam = false;
        this.players = [ ];
        this.tasks = [ ];
        this.owner = "";
    }
}