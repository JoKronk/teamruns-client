import { RunData } from "../run/run-data";

export class Preset {
    presetIsVisible: boolean;
    presetKey: string;
    presetButtonText: string;
    runData: RunData;

    constructor (runData: RunData) {
        this.runData = runData;
        this.presetIsVisible = true;
        this.presetKey = crypto.randomUUID();
        this.presetButtonText = "";
    }
}