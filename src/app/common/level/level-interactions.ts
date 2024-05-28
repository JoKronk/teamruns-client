import { UserInteractionData } from "../socket/interaction-data";

export class LevelInteractions {
    
    levelName: string;
    orbCount: number = 0;
    interactions: UserInteractionData[] = [];

    constructor(levelName: string) {
        this.levelName = levelName;
    }
}