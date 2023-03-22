import { Run } from "../run/run";
import { RunData } from "../run/run-data";
import { LobbyUser } from "./lobby-user";

export class Lobby {
    id: string;
    host: LobbyUser | null;
    backupHost: LobbyUser | null;
    runData: RunData;
    users: LobbyUser[];
    visible: boolean;
    creatorId: string;
    creationDate: string; //firestore saves it as string if Date and fetches it as string
    lastUpdateDate: string;

    constructor(runData: RunData, creatorId: string) {
        this.id = crypto.randomUUID();
        this.runData = runData;
        this.host = null;
        this.backupHost = null;
        this.users = [];
        this.visible = true;
        this.creatorId = creatorId;
        this.creationDate = new Date().toUTCString();
        this.lastUpdateDate = new Date().toUTCString();
    }

    getUserNameFromKey(id: string) {
        return this.users.find(x => x.id === id)?.name;
    }

    hasUser(id: string) {
        return this.users.some(x => x.id === id);
    }

    hasRunner(id: string) {
        return this.users.some(x => x.id === id && x.isRunner);
    }

    hasSpectator(id: string) {
        return this.users.some(x => x.id === id && !x.isRunner);
    }

    getUser(id: string) {
        return this.users.find(x => x.id === id);
    }
}