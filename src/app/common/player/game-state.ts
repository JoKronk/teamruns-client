export class GameState {
    debugModeActive: boolean = false;
    currentLevel: string = "";
    currentCheckpoint: string = "";
    onZoomer: boolean = false;
    justSpawned: boolean = false;
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
        || this.onZoomer != state.onZoomer
        || this.justSpawned != state.justSpawned
        || this.debugModeActive != state.debugModeActive;
    }

    hasDied(state: GameState): boolean {
        return this.deathCount != state.deathCount && state.justSpawned;
    }

    hasSignificantPlayerStateChange(state: GameState): boolean {
        return this.currentLevel != state.currentLevel 
        || (this.currentCheckpoint != state.currentCheckpoint && state.currentCheckpoint === "citadel-elevator")
        || this.onZoomer != state.onZoomer
        || this.debugModeActive != state.debugModeActive;
    }
}