export class UserBase {
    id: string;
    name: string;
    twitchName: string;

    constructor(id: string, name: string, twitch: string) {
        this.id =  id;
        this.name = name;
        this.twitchName = twitch;
    }

    getUserBase(): UserBase {
        return new UserBase(this.id, this.name, this.twitchName);
    }
}


export class User extends UserBase {
    ogFolderpath: string = "";
    darkMode: boolean = true;

    constructor() {
        super(crypto.randomUUID(), "", "");
    }

    getCopy(): User {
        return JSON.parse(JSON.stringify(this));
    }

    isEqualToDataCopy(copy: User) : boolean {
        return this.name === copy.name &&
            this.twitchName === copy.twitchName &&
            this.ogFolderpath === copy.ogFolderpath &&
            this.darkMode === copy.darkMode;
    }
}