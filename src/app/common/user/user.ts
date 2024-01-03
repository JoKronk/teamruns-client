import { DbUserProfile } from "../firestore/db-user-profile";

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
    ogFolderpath: string = "";
    darkMode: boolean = true;
    displayName: string;
    hasSignedIn: boolean = false;
    gameLaunched: boolean = false;

    constructor() {
        super(crypto.randomUUID(), "");
    }

    getCopy(): User {
        return JSON.parse(JSON.stringify(this));
    }

    isEqualToDataCopy(copy: User) : boolean {
        return this.name === copy.name &&
            this.displayName === copy.displayName &&
            this.ogFolderpath === copy.ogFolderpath &&
            this.darkMode === copy.darkMode &&
            this.hasSignedIn === copy.hasSignedIn;
    }

    createUserBaseFromDisplayName(): UserBase {
        return new UserBase(this.id, this.displayName);
    }

    importDbUser(user: DbUserProfile, displayName: string) {
        this.id =  user.id;
        this.name = user.name;
        this.displayName = displayName;
    }

    importUserCopy(user: User) {
        this.id =  user.id;
        this.name = user.name;
        this.ogFolderpath = user.ogFolderpath;
        this.darkMode = user.darkMode;
        this.displayName = user.displayName;
        this.hasSignedIn = user.hasSignedIn;
    }
}