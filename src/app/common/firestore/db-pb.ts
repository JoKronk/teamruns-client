import { CategoryOption } from "../run/category";
import { DbLeaderboardPb } from "./db-leaderboard-pb";
import { DbPlayer } from "./db-player";
import { DbRun } from "./db-run";
import { DbTeam } from "./db-team";

export class DbPb extends DbLeaderboardPb {
    runId: string;
    category: CategoryOption;
    sameLevel: boolean;
    override userIds: Map<string, boolean> | any = new Map(); //this bool structure is required to be able to query users from firestore db
    cellCount: number;
    playerCount: number;
    players: DbPlayer[] = [];
    wasRace: boolean;
    wasWr: boolean;


    static convertToFromRun(run: DbRun, team: DbTeam, isWr: boolean): DbPb {
        let pb = new DbPb();

        pb.version = run.data.buildVersion;
        pb.date = run.date;
        pb.tasks = team.tasks;
        pb.endTimeMs = team.endTimeMs;
        pb.playbackAvailable = true;

        pb.id = crypto.randomUUID(); //id can't be same as runId since there might be multiple teams pbing which would create duplicates
        pb.runId = run.id ?? "";
        pb.category = run.data.category;
        pb.sameLevel = run.data.requireSameLevel;
        team.players.forEach(x => {
            pb.userIds.set(x.user.id, true);
        });
        pb.playerCount = team.players.length;
        pb.cellCount = team.cellCount;
        pb.players = team.players;
        pb.wasRace = run.teams.length !== 0;
        pb.wasWr = isWr;
        return pb;
    }

    override clearFrontendValues(): void {
        this.id = undefined;
        this.dateFrontend = undefined;
        this.endTimeFrontend = undefined;
        this.userDisplayContent = undefined;
        this.hasLocalUser = undefined;
    }

}