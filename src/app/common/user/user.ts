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
    displayName: string;
    saveRecordingsLocally: boolean = true;
    hasSignedIn: boolean = false;
    
    gameLaunched: boolean = false;
    controllerPort: number | undefined = undefined;

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
        this.displayName = user.displayName;
        this.saveRecordingsLocally = user.saveRecordingsLocally;
        this.hasSignedIn = user.hasSignedIn;
    }
}