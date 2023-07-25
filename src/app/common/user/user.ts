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
    leaderboardName: string;

    constructor() {
        super(crypto.randomUUID(), "");
    }

    getCopy(): User {
        return JSON.parse(JSON.stringify(this));
    }

    isEqualToDataCopy(copy: User) : boolean {
        return this.name === copy.name &&
            this.leaderboardName === copy.leaderboardName &&
            this.ogFolderpath === copy.ogFolderpath &&
            this.darkMode === copy.darkMode;
    }
}