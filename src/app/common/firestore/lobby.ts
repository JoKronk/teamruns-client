import { Run } from "../run/run";
import { RunData } from "../run/run-data";
import { LobbyUser } from "./lobby-user";

export class Lobby {
    id: string;
    host: LobbyUser | null;
    backupHost: LobbyUser | null;
    runData: RunData;
    password: string | null;
    users: LobbyUser[];
    runnerIds: string[]; //for obs plugin to find user
    visible: boolean;
    creatorId: string;
    creationDate: string; //firestore saves it as string if Date and fetches it as string
    lastUpdateDate: string;

    constructor(runData: RunData, creatorId: string, password: string | null = null, id: string | null = null) {
        this.id = id ?? crypto.randomUUID();
        this.runData = runData;
        this.password = password;
        this.host = null;
        this.backupHost = null;
        this.users = [];
        this.runnerIds = [];
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

    addUser(user: LobbyUser) {
        this.users.push(user);
        if (user.isRunner)
            this.runnerIds.push(user.id);
    }
    removeUser(id: string) {
        this.users = this.users.filter(user => user.id !== id);
        this.runnerIds = this.runnerIds.filter(x => x !== id);
    }

    setBestAvailableBackupHostCandidate(currentUserId: string) {
        this.backupHost = this.users.find(user => user.isRunner && user.id !== currentUserId) ?? this.users.find(user => !user.isRunner && user.id !== currentUserId && !user.id.startsWith("OBS-")) ?? null;
    }
}