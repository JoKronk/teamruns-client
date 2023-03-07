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
    creationDate: string; //firestore saves it as string if Date and fetches it as string

    constructor(runData: RunData) {
        this.id = crypto.randomUUID();
        this.runData = runData;
        this.host = null;
        this.backupHost = null;
        this.runners = [];
        this.spectators = [];
        this.visible = true;
        this.creationDate = new Date().toUTCString();
    }
}