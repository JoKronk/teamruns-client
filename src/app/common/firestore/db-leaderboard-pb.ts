import { Timer } from "../run/timer";
import { DbPb } from "./db-pb";
import { DbTask } from "./db-task";
import { DbUsersCollection } from "./db-users-collection";

export class DbLeaderboardPb {
    version: string;
    date: number;
    userIds: string[];
    tasks: DbTask[];
    endTimeMs: number;
    playbackAvailable: boolean;

    id?: string;
    dateFrontend?: Date;
    endTimeFrontend?: string;

    constructor() {
    }

    static convertToFromPb(run: DbPb): DbLeaderboardPb {
        let pb = new DbLeaderboardPb();

        pb.id = run.id;
        pb.version = run.version;
        pb.date = run.date;
        if (run.userIds instanceof Map)
            pb.userIds = Array.from(run.userIds.keys());
        else {
            pb.userIds = Array.from(new Map(Object.entries(run.userIds)).keys());
        }

        pb.tasks = run.tasks;
        pb.endTimeMs = run.endTimeMs;
        pb.playbackAvailable = run.playbackAvailable;
        return pb;
    }

    fillFrontendValues(usersCollection: DbUsersCollection) {
            
        this.endTimeFrontend = this.endTimeMs === 0 ? "DNF" : Timer.msToTimeFormat(this.endTimeMs, true, true);
        
        if (this.date)
            this.dateFrontend = new Date(this.date);
        
        this.userIds.forEach((id, index) => {
            this.userIds[index] = usersCollection?.users.find(x => x.id === id)?.name ?? "Unknown";
        });

        return this;
    }
}