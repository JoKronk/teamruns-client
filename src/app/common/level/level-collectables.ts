import { GameTask } from "../opengoal/game-task";
import { BuzzerBase } from "./buzzer";
import { CrateBase } from "./crate";
import { EnemyBase } from "./enemy";
import { OrbBase } from "./orb";

export class LevelCollectables {
    
    levelName: string;
    taskUpdates: GameTask[] = [];
    buzzerUpdates: BuzzerBase[] = [];
    orbUpdates: OrbBase[] = [];
    crateUpdates: CrateBase[] = [];
    enemyUpdates: EnemyBase[] = [];
    periscopeUpdates: string[] = [];
    snowBumberUpdates: string[] = [];
    darkCrystalUpdates: string[] = [];
    lpcChamberPosition: number = 0;

    constructor(levelName: string) {
        this.levelName = levelName;
    }
}