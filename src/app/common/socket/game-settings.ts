import { CategoryOption } from "../run/category";
import { CitadelOption, RunData } from "../run/run-data";
import { RunMod, RunMode } from "../run/run-mode";

export class GameSettings {
    category: CategoryOption;
    mode: RunMode;
    requireSameLevel: number;
    allowSoloHubZoomers: number;
    noLTS: number;
    citadelSkip: CitadelOption;
    enablePvp: number;
    freeForAll: number;

    constructor (runData: RunData | undefined) {
        if (runData) {
            this.category = runData.category;
            this.mode = runData.mode;
            this.requireSameLevel = runData.sameLevel ? 1 : 0;
            this.allowSoloHubZoomers = runData.allowSoloHubZoomers ? 1 : 0;
            this.noLTS = runData.noLTS ? 1 : 0;
            this.citadelSkip = runData.citadelSkip;
            this.enablePvp = runData.enablePvp ? 1 : 0;
            this.freeForAll = runData.teams === 1 && RunMod.singleTeamEqualsFFA(runData.mode) ? 1 : 0;
        }
        else {
            this.category = CategoryOption.NoLts;
            this.mode = RunMode.Speedrun;
            this.requireSameLevel = 0;
            this.allowSoloHubZoomers = 1;
            this.noLTS = 0;
            this.citadelSkip = CitadelOption.Normal;
            this.enablePvp = 0;
            this.freeForAll = 0;
        }
    }
}