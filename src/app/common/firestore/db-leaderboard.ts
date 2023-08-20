import { CategoryOption } from "../run/category";
import { RunData } from "../run/run-data";
import { DbLeaderboardPb } from "./db-leaderboard-pb";

export class DbLeaderboard {
    category: CategoryOption;
    sameLevel: boolean;
    players: number;
    pbs: DbLeaderboardPb[];

    id?: string;

    constructor(category: CategoryOption, sameLevel: boolean, players: number) {
        this.category = category;
        this.sameLevel = sameLevel;
        this.players = players;
        this.pbs = [];
        this.id = crypto.randomUUID();
    }
}