import { RunMode } from "./run-mode";

//used to create base run from lobby
export class RunData {
    //metadata
    name: string = "";
    teams: number = 1;
    buildVersion: string;

    //run settings
    countdownSeconds: number = 10;
    mode: RunMode = RunMode.Speedrun;
    requireSameLevel: boolean = false;
    allowSoloHubZoomers: boolean = false;
    normalCellCost: boolean = false;
    sharedWarpGatesBetweenTeams: boolean = false;

    noLTS: boolean = true;
    citadelSkip: CitadelOptions = CitadelOptions.Shared;

    constructor(version: string) {
        this.buildVersion = version;
    }
}

export enum CitadelOptions {
    Patched,
    Normal,
    Shared
}