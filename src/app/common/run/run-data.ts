import { CategoryOption } from "./category";
import { RunMode } from "./run-mode";

//used to create base run from lobby
export class RunData {
    //metadata
    name: string = "";
    teams: number = 1;
    buildVersion: string;
    gameVersion: string;

    //run settings
    category: CategoryOption = CategoryOption.NoLts;
    countdownSeconds: number = 10;
    mode: RunMode = RunMode.Speedrun;
    submitPbs: boolean = true;

    //category settings
    sameLevel: boolean = false;
    allowSoloHubZoomers: boolean = false;
    noLTS: boolean = true;
    citadelSkip: CitadelOption = CitadelOption.Shared;
    enablePvp: boolean = false;

    constructor(version: string) {
        this.buildVersion = version;
    }

    setCategoryDefaultSettings(): void {
        this.allowSoloHubZoomers = false;
        this.citadelSkip = CitadelOption.Shared;
        this.noLTS = false;

        switch (this.category) {
            case CategoryOption.NoLts:
                this.noLTS = true;
                break;
                break;
        }
    }

    public applyCasualSettings() {
        this.teams = 1;
        this.category = CategoryOption.Custom;
        this.countdownSeconds = 5;
        this.mode = RunMode.Casual;
        this.submitPbs = false;
        this.sameLevel = false;
        this.allowSoloHubZoomers = true;
        this.noLTS = false;
        this.citadelSkip = CitadelOption.Normal;
    }

    public static getFreeroamSettings(version: string, withPvp: boolean | undefined = undefined): RunData {
        const rundata = new RunData(version);
        rundata.category = CategoryOption.Custom;
        rundata.allowSoloHubZoomers = true;
        rundata.noLTS = false;
        rundata.submitPbs = false;
        rundata.citadelSkip = CitadelOption.Normal;
        rundata.enablePvp = withPvp !== undefined ? withPvp : true;
        rundata.teams = 2;
        return rundata;
    }
}

export enum CitadelOption {
    Patched,
    Normal,
    Shared
}