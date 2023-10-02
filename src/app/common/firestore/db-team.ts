import { Task } from "../opengoal/task";
import { Team } from "../run/team";
import { DbPlayer } from "./db-player";


export class DbTeam {
    id: number;
    name: string;
    endTimeMs: number;
    players: DbPlayer[] = [];
    tasks: Task[];
    cellCount: number;
    hasUsedDebugMode: boolean;

    constructor(team: Team) {
        this.id = team.id;
        this.name = team.name;
        this.endTimeMs = team.endTimeMs;
        this.tasks = team.tasks;
        this.cellCount = team.runState.cellCount;
        this.hasUsedDebugMode = team.hasUsedDebugMode;
        team.players.forEach(player => {
            this.players.push(new DbPlayer(player));
        });
        this.players = this.players.sort((x, y) => y.cellsCollected - x.cellsCollected);
    }
}