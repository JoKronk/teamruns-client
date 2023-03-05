import { Run } from "../run/run";
import { RunData } from "../run/run-data";

export class Lobby {
    id: string;
    host: string | null;
    backupHost: string | null;
    runData: RunData;
    runners: string[];
    spectators: string[];
    visible: boolean;

    constructor(runData: RunData) {
        this.id = crypto.randomUUID();
        this.runData = runData;
        this.host = null;
        this.backupHost = null;
        this.runners = [];
        this.spectators = [];
        this.visible = true;
    }
}