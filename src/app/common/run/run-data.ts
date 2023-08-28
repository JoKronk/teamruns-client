import { CategoryOption } from "./category";
import { RunMode } from "./run-mode";

//used to create base run from lobby
export class RunData {
    //metadata
    name: string = "";
    teams: number = 1;
    category: CategoryOption = CategoryOption.NoLts;
    buildVersion: string;

    //run settings
    countdownSeconds: number = 10;
    mode: RunMode = RunMode.Speedrun;
    hideOtherPlayers: boolean = false;
    requireSameLevel: boolean = false;

    //category settings
    allowSoloHubZoomers: boolean = false;
    normalCellCost: boolean = false;
    sharedWarpGatesBetweenTeams: boolean = false;
    noLTS: boolean = true;
    citadelSkip: CitadelOption = CitadelOption.Shared;

    constructor(version: string) {
        this.buildVersion = version;
    }

    SetCategoryDefaultSettings(): void {
        this.allowSoloHubZoomers = false;
        this.normalCellCost = false;
        this.sharedWarpGatesBetweenTeams = false;
        this.citadelSkip = CitadelOption.Shared;
        this.noLTS = false;

        switch (this.category) {
            case 1:
                this.noLTS = true;
                break;
            case 4:
                this.noLTS = true;
                this.citadelSkip = CitadelOption.Patched;
                break;
        }
    }
}

export enum CitadelOption {
    Patched,
    Normal,
    Shared
}