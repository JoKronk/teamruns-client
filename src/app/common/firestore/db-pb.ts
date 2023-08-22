import { CategoryOption } from "../run/category";
import { DbLeaderboardPb } from "./db-leaderboard-pb";
import { DbPlayer } from "./db-player";
import { DbRun } from "./db-run";
import { DbTeam } from "./db-team";

export class DbPb extends DbLeaderboardPb {
    category: CategoryOption;
    sameLevel: boolean;
    override userIds: Map<string, boolean> | any = new Map();
    cellCount: number;
    playerCount: number;
    players: DbPlayer[] = [];
    wasRace: boolean;
    wasWr: boolean;
    playback: any;

    runId?: string;

    static convertToFromRun(run: DbRun, team: DbTeam, isWr: boolean): DbPb {
        let pb = new DbPb();

        pb.version = run.data.buildVersion;
        pb.date = run.date;
        pb.tasks = team.tasks;
        pb.endTimeMs = team.endTimeMs;
        pb.playbackAvailable = false;

        pb.id = crypto.randomUUID();
        pb.runId = run.id;
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

}