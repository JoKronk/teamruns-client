import { DbUserProfile } from "../firestore/db-user-profile";
import { PlayerBase } from "../player/player-base";
import { PlayerType } from "../player/player-type";

export class UserBase {
    id: string;
    name: string;

    constructor(id: string, name: string) {
        this.id =  id;
        this.name = name;
    }

    getUserBase(): UserBase {
        return new UserBase(this.id, this.name);
    }
}


export class User extends UserBase {
    gameVersion: string = "";
    displayName: string;
    hasSignedIn: boolean = false;
    
    isLaunching: boolean = false;
    gameLaunched: boolean = false;
    controllerPort: number | undefined = undefined;

    constructor() {
        super(crypto.randomUUID(), "");
    }

    getCopy(): User {
        return JSON.parse(JSON.stringify(this));
    }

    isEqualToDataCopy(copy: User) : boolean {
        return this.id === copy.id &&
            this.name === copy.name &&
            this.displayName === copy.displayName &&
            this.gameVersion === copy.gameVersion &&
            this.hasSignedIn === copy.hasSignedIn;
    }

    isEqualToDataCopyBase(copy: UserBase) : boolean {
        return this.name === copy.name &&
        this.name === copy.name;
    }

    getUserBaseWithDisplayName(): UserBase {
        return new UserBase(this.id, this.displayName ?? this.name);
    }

    getPlayerType(): PlayerType {
        return this.hasSignedIn ? PlayerType.User : PlayerType.GuestUser;
    }

    generatePlayerBase(): PlayerBase {
        return new PlayerBase(this.getUserBaseWithDisplayName(), this.getPlayerType());
    }

    importDbUser(user: DbUserProfile, displayName: string) {
        this.id =  user.id;
        this.name = user.name;
        this.displayName = displayName;
    }

    importUserCopy(user: User) {
        this.id =  user.id;
        this.name = user.name;
        this.gameVersion = user.gameVersion;
        this.displayName = user.displayName;
        this.hasSignedIn = user.hasSignedIn;
    }
}