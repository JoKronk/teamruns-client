import { RunMode } from "./run-mode";

//used to create base run from lobby
export class RunData {
    //metadata
    name: string;
    teams: number;
    buildVersion: string;

    //run settings
    countdownSeconds: number;
    mode: RunMode;
    requireSameLevel: boolean;
    allowSoloHubZoomers: boolean;
    normalCellCost: boolean;
    sharedWarpGatesBetweenTeams: boolean;

    noLTS: boolean;
    citadelSkip: CitadelOptions;

    constructor(version: string) {
        this.name = "";
        this.teams = 1;
        this.buildVersion = version;
        this.countdownSeconds = 10;
        this.mode = RunMode.Speedrun;
        this.requireSameLevel = false;
        this.allowSoloHubZoomers = false;
        this.normalCellCost = false;
        this.sharedWarpGatesBetweenTeams = false;

        this.noLTS = true;
        this.citadelSkip = CitadelOptions.Shared;
    }
}

export enum CitadelOptions {
    Patched,
    Normal,
    Shared
}