import { Team } from "../run/team";
import { DbPlayer } from "./db-player";
import { DbTask } from "./db-task";


export class DbTeam {
    id: number;
    name: string;
    endTimeMs: number;
    players: DbPlayer[] = [];
    tasks: DbTask[] = [];
    cellCount: number;
    hasUsedDebugMode: boolean;

    constructor(team: Team) {
        this.id = team.id;
        this.name = team.name;
        this.endTimeMs = team.endTimeMs;
        this.cellCount = team.runState.cellCount;
        this.hasUsedDebugMode = team.hasUsedDebugMode;
        team.splits.forEach(split => {
            this.tasks.push(new DbTask(split));
        });
        team.players.forEach(player => {
            this.players.push(new DbPlayer(player));
        });
        this.players = this.players.sort((x, y) => y.cellsCollected - x.cellsCollected);
    }
}