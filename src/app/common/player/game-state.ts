export class GameState {
    currentLevel: string = "";
    currentCheckpoint: string = "";
    onZoomer: boolean = false;
    cellCount: number = 0;
    deathCount: number = 0;
    sharedTasks: any = null;

    constructor() {
        
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