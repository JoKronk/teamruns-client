import { UserInteractionData } from "../socket/interaction-data";

export class LevelInteractions {
    
    levelName: string;
    interactions: UserInteractionData[] = [];

    constructor(levelName: string) {
        this.levelName = levelName;
    }
}