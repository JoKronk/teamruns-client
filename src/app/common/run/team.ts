import { Player } from "../player/player";
import { Task } from "../opengoal/task";
import { PlayerState } from "../player/player-state";


export class Team {
    name: string;
    players: Player[];
    tasks: Task[];
    cellCount: number;
    owner: string;

    constructor(name: string) {
        this.name = name;
        this.players = [];
        this.owner = "";
        this.resetForRun();
    }

    resetForRun() {
        this.tasks = [ ];
        this.cellCount = 0;

        if (this.players.length === 0) return;
        this.players.forEach(player => {
            player.state = PlayerState.Neutral;
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
}