import { Task } from "../opengoal/task";
import { Run } from "../run/run";
import { RunData } from "../run/run-data";
import { DbTeam } from "./db-team";
import { DbUsersCollection } from "./db-users-collection";

export class DbRun {
    data: RunData;
    teams: DbTeam[] = [];
    playerIds: string[] = [];
    date: number | null;
    playback: any;

    id?: string;
    dateFrontend?: Date;
    endTimeFrontend?: string;

    constructor() {

    }

    static convertToFromRun(run: Run): DbRun {
        let dbRun = new DbRun();
        
        dbRun.data = run.data;
        dbRun.date = run.timer.startDateMs;

        //teams
        run.teams.forEach((team, index) => {
            if (team?.tasks && team.tasks.length !== 0) {
                let teamEndTask = team.tasks[0];
                run.teams[index].endTime = teamEndTask.gameTask !== Task.forfeit ? teamEndTask.obtainedAt : "DNF";
            }
            dbRun.teams.push(new DbTeam(team));
        });
        
        return dbRun;
    }



    fillFrontendValues(usersCollection: DbUsersCollection, playerId: string = "") {
        let playerTeam = this.teams.find(team => team.players.some(x => x.user.id === playerId));
        if (playerTeam)
            this.endTimeFrontend = playerTeam.endTime;
        else
            this.endTimeFrontend = this.teams.find(x => x.endTime !== "DNF")?.endTime ?? "DNF";
        
        if (this.date)
            this.dateFrontend = new Date(this.date);
        
        this.teams.forEach((team, index) => {
            team.players.forEach((player, i) => {
                this.teams[index].players[i].currentUsernameFrontend = usersCollection?.users.find(x => x.id === player.user.id)?.name ?? player.user.name;
            });
        });

        return this;
    }

}