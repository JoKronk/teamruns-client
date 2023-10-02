import { Player } from "../player/player";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";
import { RunStateMapper as RunStateMapper } from "../level/run-state-mapper";


export class Team {
    id: number;
    name: string;
    players: Player[] = [];
    tasks: Task[];
    endTimeMs: number = 0;
    
    runState: RunStateMapper;

    hasUsedDebugMode: boolean = false;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.resetForRun();
    }

    resetForRun() {
        this.tasks = [];
        this.runState = new RunStateMapper();

        if (this.players.length === 0) return;
        this.players.forEach(player => {
            player.state = PlayerState.Neutral;
            player.cellsCollected = 0;
        })
    }
    
    addTask(task: Task) {
        if (task.isCell) {
            const player = this.players.find(x => x.user.id === task.obtainedById);
            if (player) player.cellsCollected++;
        }
            
        this.tasks.unshift(task);
    }

    hasTask(task: string): boolean {
        return this.tasks.some(x => x.gameTask === task) ?? false;
    }
}