import { BuzzerBase } from "./buzzer";
import { CrateBase } from "./crate";
import { OrbBase } from "./orb";

export class LevelCollectables {
    
    levelName: string;
    cellUpdates: string[] = [];
    buzzerUpdates: BuzzerBase[] = [];
    orbUpdates: OrbBase[] = [];
    crateUpdates: CrateBase[] = [];
    periscopeUpdates: string[] = [];

    constructor(levelName: string) {
        this.levelName = levelName;
    }
}