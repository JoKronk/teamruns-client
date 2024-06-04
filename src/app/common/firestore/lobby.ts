import { PlayerBase } from "../player/player-base";
import { RunData } from "../run/run-data";
import { UserBase } from "../user/user";
import { LobbyUser } from "./lobby-user";

export class Lobby {
    id: string;
    host: PlayerBase | null = null;
    backupHost: UserBase | null = null;
    runData: RunData;
    password: string | null;
    users: LobbyUser[] = [];
    runnerIds: string[] = []; //for obs plugin to find user
    allowLateSpectate: boolean = false;
    inProgress: boolean = false;
    visible: boolean = true;
    available: boolean = true;
    creatorId: string;
    creationDate: string = new Date().toUTCString(); //firestore saves it as string if Date and fetches it as string
    lastUpdateDate: string = new Date().toUTCString();

    constructor(runData: RunData, creatorId: string, lateSpectate: boolean, password: string | null = null, id: string | null = null) {
        this.id = id ?? crypto.randomUUID();
        this.runData = runData;
        this.password = password;
        this.creatorId = creatorId;
        this.allowLateSpectate = lateSpectate;
    }

    hasUser(id: string) {
        return this.users.some(x => x.user.id === id);
    }

    hasRunner(id: string) {
        return this.users.some(x => x.user.id === id && x.isRunner);
    }

    hasSpectator(id: string) {
        return this.users.some(x => x.user.id === id && !x.isRunner);
    }

    getUser(id: string) {
        return this.users.find(x => x.user.id === id);
    }

    addUser(user: LobbyUser) {
        this.users.push(user);
        if (user.isRunner)
            this.runnerIds.push(user.user.id);
    }
    removeUser(id: string) {
        this.users = this.users.filter(user => user.user.id !== id);
        this.runnerIds = this.runnerIds.filter(x => x !== id);
    }
}