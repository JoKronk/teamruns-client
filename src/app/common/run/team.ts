import { Player } from "../player/player";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";
import { RunStateHandler } from "../level/run-state-handler";
import { DbTeam } from "../firestore/db-team";


export class Team {
    id: number;
    name: string;
    players: Player[] = [];
    splits: Task[] = [];
    endTimeMs: number = 0;
    
    runState: RunStateHandler;

    runIsValid: boolean = true;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.resetForRun();
    }

    static fromDbTeam(dbTeam: DbTeam): Team {
        let team: Team = new Team(dbTeam.id, dbTeam.name);
        dbTeam.players.forEach(player => {
            team.players.push(Player.fromDbPlayer(player));
        });
        dbTeam.tasks.forEach(task => {
            team.splits.push(Task.fromDbTask(task));
        });
        team.endTimeMs = dbTeam.endTimeMs;
        team.runIsValid = dbTeam.runIsValid;
        team.runState.cellCount = dbTeam.cellCount;
        return team;
    }

    resetForRun(resetPlayers: boolean = true) {
        this.splits = [];
        this.runState = new RunStateHandler();
        this.runIsValid = this.everyoneOnSameVersion();


        if (!resetPlayers) return;
        this.players.forEach(player => {
            player.state = PlayerState.Neutral;
            player.cellsCollected = 0;
        })
    }

    everyoneOnSameVersion(): boolean {
        if (this.players.length === 0) 
            return true;

        const gameVersion = this.players[0].gameState.gameVersion;
        return this.players.every(x => x.gameState.gameVersion === gameVersion);
    }
    
    addSplit(split: Task) {
        if (split.isCollectedCell) {
            const player = this.players.find(x => x.user.id === split.obtainedById);
            if (player) player.cellsCollected++;
        }
            
        this.splits.unshift(split);
    }

    hasSplit(taskName: string): boolean {
        return this.splits.some(x => x.gameTask === taskName) ?? false;
    }
}