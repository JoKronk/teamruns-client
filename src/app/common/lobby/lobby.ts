import { Run } from "../run/run";
import { RunData } from "../run/run-data";

export class Lobby {
    id: string;
    runData: RunData;
    teams: number;

    constructor(run: Run) {
        this.id = run.id;
        this.runData = run.data;
        this.teams = run.teams.length;
    }
}