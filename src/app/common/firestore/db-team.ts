import { Task } from "../opengoal/task";
import { Team } from "../run/team";
import { DbPlayer } from "./db-player";


export class DbTeam {
    id: number;
    name: string;
    endTime: string;
    players: DbPlayer[] = [];
    tasks: Task[];
    cellCount: number;

    constructor(team: Team) {
        this.id = team.id;
        this.name = team.name;
        this.endTime = team.endTime;
        this.tasks = team.tasks;
        this.cellCount = team.cellCount;
        team.players.forEach(player => {
            this.players.push(new DbPlayer(player));
        });
        this.players = this.players.sort((x, y) => y.cellsCollected - x.cellsCollected);
    }
}