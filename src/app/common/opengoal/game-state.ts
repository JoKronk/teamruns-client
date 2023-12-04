export class GameState {
    debugModeActive: boolean = false;
    justSpawned: boolean = false;
    cellCount: number = 0;
    buzzerCount: number = 0;
    orbCount: number = 0;
    deathCount: number = 0;

    constructor() {
        
    }

    
    //!NOTE: None static functions shouldn't be created as new updates replaces state without using Object.assign() making them uncallable

    public static hasSignificantPlayerStateChange(oldState: GameState, newState: GameState): boolean {
        return oldState.debugModeActive != newState.debugModeActive;
    }
}