export class User {
    displayName: string;
    twitchName: string;
    ogFolderpath: string;
    darkMode: boolean;

    constructor() {
        this.displayName = "";
        this.twitchName = "";
        this.ogFolderpath = "";
        this.darkMode = true;
    }

    getBaseCopy(): User {
        return JSON.parse(JSON.stringify(this));
    }

    isEqualToDataCopy(copy: User) : boolean {
        return this.displayName === copy.displayName &&
            this.twitchName === copy.displayName &&
            this.ogFolderpath === copy.ogFolderpath &&
            this.darkMode === copy.darkMode;
    }
}