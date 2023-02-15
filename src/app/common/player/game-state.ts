export class GameState {
    currentLevel: string;
    onZoomer: boolean;

    constructor() {
        this.currentLevel = "";
        this.onZoomer = false;
    }

    hasChanged(state: GameState): boolean {
        return this.currentLevel != state.currentLevel 
        || this.onZoomer != state.onZoomer;
    }
}