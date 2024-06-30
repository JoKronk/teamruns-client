import { Player } from "../player/player";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";
import { RunStateHandler } from "../level/run-state-handler";
import { DbTeam } from "../firestore/db-team";
import { GameState } from "../opengoal/game-state";


export class Team {
    id: number;
    name: string;
    players: Player[] = [];
    splits: Task[] = [];
    endTimeMs: number = 0;
    
    runState: RunStateHandler;

    hasFinished: boolean = false
    runIsValid: boolean = true;
    runInvalidReason: string = "";

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
        this.runIsValid = true;
        this.hasFinished = false;


        if (!resetPlayers) return;
        for (let player of this.players) {
            player.state = PlayerState.Neutral;
            player.cellsCollected = 0;
            player.gameState = new GameState();
        }
    }

    everyoneOnSameVersion(): boolean {
        if (this.players.length === 0) 
            return true;

        const gameVersion = this.players[0].gameState.gameVersion;
        return this.players.every(x => x.gameState.gameVersion === gameVersion);
    }

    checkMarkRunInvalid(valid: boolean, reason: string) {
        if (valid) return;

        this.runIsValid = valid;
        this.runInvalidReason = reason;
    }
    
    addSplit(split: Task): boolean {
        //if existing split
        if (this.splits.find(x => x.gameTask === split.gameTask && x.obtainedById === split.obtainedById) !== undefined)
            return false;

        if (split.isCollectedCell) {
            const player = this.players.find(x => x.user.id === split.obtainedById);
            if (player) player.cellsCollected++;
        }
            
        this.splits.unshift(split);
        return true;
    }

    hasSplit(taskName: string): boolean {
        return this.splits.some(x => x.gameTask === taskName) ?? false;
    }
}