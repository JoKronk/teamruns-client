import { RunMode } from "./run-mode";

//used to create base run from lobby
export class RunData {
    //metadata
    name: string;
    teamSize: number;
    teams: number;
    buildVersion: string;

    //run settings
    mode: RunMode;
    requireSameLevel: boolean;
    allowSoloHubZoomers: boolean;

    constructor(version: string) {
        this.name = "";
        this.teamSize = 3;
        this.teams = 1;
        this.buildVersion = version;
        this.mode = RunMode.Speedrun;
        this.requireSameLevel = false;
        this.allowSoloHubZoomers = false;
    }
}