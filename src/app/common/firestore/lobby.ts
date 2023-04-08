import { RunData } from "../run/run-data";
import { UserBase } from "../user/user";
import { LobbyUser } from "./lobby-user";

export class Lobby {
    id: string;
    host: UserBase | null = null;
    backupHost: UserBase | null = null;
    runData: RunData;
    password: string | null;
    users: LobbyUser[] = [];
    runnerIds: string[] = []; //for obs plugin to find user
    visible: boolean = true;
    creatorId: string;
    creationDate: string = new Date().toUTCString(); //firestore saves it as string if Date and fetches it as string
    lastUpdateDate: string = new Date().toUTCString();

    constructor(runData: RunData, creatorId: string, password: string | null = null, id: string | null = null) {
        this.id = id ?? crypto.randomUUID();
        this.runData = runData;
        this.password = password;
        this.creatorId = creatorId;
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
}