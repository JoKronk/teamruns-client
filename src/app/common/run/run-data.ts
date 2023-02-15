import { RunMode } from "./run-mode";

//made to seperate the data a bit and to make creating new run from db obj easier
export class RunData {
    //metadata
    name: string;
    owner: string;
    teamCap: number;
    maxSize: number;
    buildVersion: string;

    //run settings
    mode: RunMode;
    requireSameLevel: boolean;
    allowSoloHubZoomers: boolean;

    constructor(version: string) {
        this.name = "";
        this.owner = "";
        this.teamCap = 3;
        this.maxSize = 0;
        this.buildVersion = version;
        this.mode = RunMode.Speedrun;
        this.requireSameLevel = false;
        this.allowSoloHubZoomers = false;
    }
}