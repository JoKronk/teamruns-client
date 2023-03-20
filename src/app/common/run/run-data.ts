import { RunMode } from "./run-mode";

//used to create base run from lobby
export class RunData {
    //metadata
    name: string;
    teams: number;
    buildVersion: string;

    //run settings
    mode: RunMode;
    requireSameLevel: boolean;
    allowSoloHubZoomers: boolean;
    normalCellCost: boolean;

    noLTS: boolean;
    noCitadelSkip: boolean;

    constructor(version: string) {
        this.name = "";
        this.teams = 1;
        this.buildVersion = version;
        this.mode = RunMode.Speedrun;
        this.requireSameLevel = false;
        this.allowSoloHubZoomers = false;
        this.normalCellCost = false;

        this.noLTS = true;
        this.noCitadelSkip = false;
    }
}