import { GameTask } from "../opengoal/game-task";
import { BuzzerBase } from "./buzzer";
import { CrateBase } from "./crate";
import { OrbBase } from "./orb";

export class LevelCollectables {
    
    levelName: string;
    taskUpdates: GameTask[] = [];
    buzzerUpdates: BuzzerBase[] = [];
    orbUpdates: OrbBase[] = [];
    crateUpdates: CrateBase[] = [];
    enemyUpdates: string[] = [];
    periscopeUpdates: string[] = [];
    snowBumberUpdates: string[] = [];
    darkCrystalUpdates: string[] = [];

    constructor(levelName: string) {
        this.levelName = levelName;
    }
}