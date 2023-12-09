import { CategoryOption } from "../run/category";
import { CitadelOption, RunData } from "../run/run-data";
import { RunMode } from "../run/run-mode";

export class GameSettings {
    category: CategoryOption;
    mode: RunMode;
    requireSameLevel: boolean;
    allowSoloHubZoomers: boolean;
    noLTS: boolean;
    citadelSkip: CitadelOption;
    enablePvp: boolean;
    freeForAll: boolean;

    constructor (runData: RunData | undefined) {
        if (runData) {
            this.category = runData.category;
            this.mode = runData.mode;
            this.requireSameLevel = runData.requireSameLevel;
            this.allowSoloHubZoomers = runData.allowSoloHubZoomers;
            this.noLTS = runData.noLTS;
            this.citadelSkip = runData.citadelSkip;
            this.enablePvp = runData.enablePvp;
            this.freeForAll = runData.teams === 1 && runData.mode === RunMode.Lockout;
        }
        else {
            this.category = CategoryOption.NoLts;
            this.mode = RunMode.Speedrun;
            this.requireSameLevel = false;
            this.allowSoloHubZoomers = true;
            this.noLTS = false;
            this.citadelSkip = CitadelOption.Normal;
            this.enablePvp = false;
            this.freeForAll = false;
        }
    }
}