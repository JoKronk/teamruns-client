export class GameState {
    currentLevel: string;
    onZoomer: boolean;
    cellCount: number;

    constructor() {
        this.currentLevel = "";
        this.onZoomer = false;
        this.cellCount = 0;
    }

    hasChanged(state: GameState): boolean {
        return this.currentLevel != state.currentLevel 
        || this.onZoomer != state.onZoomer 
        || this.cellCount != state.cellCount;
    }
}