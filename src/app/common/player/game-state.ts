export class GameState {
    currentLevel: string;
    currentCheckpoint: string;
    onZoomer: boolean;
    cellCount: number;
    deathCount: number;
    sharedTasks: any;

    constructor() {
        this.currentLevel = "";
        this.currentCheckpoint = "";
        this.onZoomer = false;
        this.cellCount = 0;
        this.deathCount = 0;
        this.sharedTasks = null;
    }

    hasSharedTaskChange(state: GameState): boolean {
        return JSON.stringify(state.sharedTasks) !== JSON.stringify(this.sharedTasks);
    }

    hasPlayerStateChange(state: GameState): boolean {
        return this.currentLevel != state.currentLevel 
        || this.currentCheckpoint != state.currentCheckpoint
        || this.hasDied(state)
        || this.onZoomer != state.onZoomer;
    }

    hasDied(state: GameState): boolean {
        return this.deathCount != state.deathCount;
    }

    hasSignificantPlayerStateChange(state: GameState): boolean {
        return this.currentLevel != state.currentLevel 
        || (this.currentCheckpoint != state.currentCheckpoint && state.currentCheckpoint === "citadel-elevator")
        || this.onZoomer != state.onZoomer;
    }
}