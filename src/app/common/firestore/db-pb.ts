import { CategoryOption } from "../run/category";
import { RunData } from "../run/run-data";
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
    isCurrentPb: boolean;


    static convertToFromRun(run: DbRun, team: DbTeam, isWr: boolean, hasPlayback: boolean): DbPb {
        let pb = new DbPb();

        pb.version = run.data.buildVersion;
        pb.date = run.date;
        pb.tasks = team.tasks;
        pb.endTimeMs = team.endTimeMs;
        pb.playbackAvailable = hasPlayback;

        pb.id = crypto.randomUUID(); //id can't be same as runId since there might be multiple teams pbing which would create duplicates
        pb.runId = run.id ?? "";
        pb.category = run.data.category;
        pb.sameLevel = run.data.sameLevel;
        pb.userIds = DbPb.convertUserIds(team.players.flatMap(x => x.user.id));
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

    static convertUserIds(userIds: string[]): Map<string, boolean> {
        let userIdsConverted: Map<string, boolean> = new Map();
        for (let id of userIds)
            userIdsConverted.set(id, true);
        return userIdsConverted;
    }

    static belongsToRunners(pb: DbPb | undefined, runData: RunData, playerIds: string[]): boolean {
        if (pb === undefined)
            return false;

        return pb.category === runData.category && pb.sameLevel === runData.sameLevel && DbRun.arraysEqual(playerIds, (pb instanceof Map) ? Array.from(pb.userIds.keys()) : Array.from(new Map(Object.entries(pb.userIds)).keys()));
    }

}