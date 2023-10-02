export class GameState {
    debugModeActive: boolean = false;
    currentLevel: string = "";
    currentCheckpoint: string = "";
    onZoomer: boolean = false;
    justSpawned: boolean = false;
    cellCount: number = 0;
    buzzerCount: number = 0;
    orbCount: number = 0;
    deathCount: number = 0;

    constructor() {
        
    }

    
    //!NOTE: None static functions shouldn't be created as new updates replaces state without using Object.assign() making them uncallable

    public static hasSignificantPlayerStateChange(oldState: GameState, newState: GameState): boolean {
        return oldState.currentLevel != newState.currentLevel 
        || (oldState.currentCheckpoint != newState.currentCheckpoint && newState.currentCheckpoint === "citadel-elevator")
        || oldState.onZoomer != newState.onZoomer
        || oldState.debugModeActive != newState.debugModeActive;
    }
}