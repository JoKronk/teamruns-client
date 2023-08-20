import { Run } from "../run/run";
import { RunData } from "../run/run-data";
import { Timer } from "../run/timer";
import { DbTeam } from "./db-team";
import { DbUsersCollection } from "./db-users-collection";

export class DbRun {
    data: RunData;
    teams: DbTeam[] = [];
    userIds: Map<string, boolean> | any = new Map();
    date: number;
    playback: any;

    id?: string;
    dateFrontend?: Date;
    endTimeFrontend?: string;

    constructor() {
        this.id = crypto.randomUUID();
    }

    static convertToFromRun(run: Run): DbRun {
        let dbRun = new DbRun();

        dbRun.data = run.data;
        dbRun.date = run.timer.startDateMs ?? 0;

        //teams
        run.teams.forEach(team => {
            if (team.players.length !== 0) {
                dbRun.teams.push(new DbTeam(team));
                team.players.forEach(player => {
                    dbRun.userIds.set(player.user.id, true);
                });
            }
        });

        return dbRun;
    }


    userIdsToMap() {
        this.userIds = new Map(Object.entries(this.userIds));
    }

    fillFrontendValues(usersCollection: DbUsersCollection) {
        if (this.teams.length == 0) return;

        let lastTeamEndTime = this.teams.sort((a, b) => b.endTimeMs - a.endTimeMs)[0].endTimeMs;
        this.endTimeFrontend = lastTeamEndTime === 0 ? "DNF" : Timer.msToTimeFormat(lastTeamEndTime, true, true);

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