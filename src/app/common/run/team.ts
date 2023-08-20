import { Player } from "../player/player";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";


export class Team {
    id: number;
    name: string;
    players: Player[] = [];
    tasks: Task[];
    cellCount: number;
    endTimeMs: number = 0;

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
        this.resetForRun();
    }

    resetForRun() {
        this.tasks = [];
        this.cellCount = 0;

        if (this.players.length === 0) return;
        this.players.forEach(player => {
            player.state = PlayerState.Neutral;
            player.cellsCollected = 0;
        })
    }
    
    addTask(task: Task) {
        if (task.isCell) {
            this.cellCount++;
            const player = this.players.find(x => x.user.id === task.obtainedById);
            if (player) player.cellsCollected++;
        }
            
        this.tasks.unshift(task);
    }

    hasTask(task: string): boolean {
        return this.tasks.some(x => x.gameTask === task) ?? false;
    }
}