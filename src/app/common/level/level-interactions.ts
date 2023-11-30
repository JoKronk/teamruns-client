import { GameTask } from "../opengoal/game-task";
import { UserInteractionData } from "../playback/interaction-data";

export class LevelInteractions {
    
    levelName: string;
    interactions: UserInteractionData[] = [];

    constructor(levelName: string) {
        this.levelName = levelName;
    }
}