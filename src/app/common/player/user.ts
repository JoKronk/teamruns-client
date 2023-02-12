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

    setBase(data: User) {
        //!TODO: Replace with something less manual
        this.displayName = data.displayName;
        this.twitchName = data.twitchName;
        this.ogFolderpath = data.ogFolderpath;
        this.darkMode = data.darkMode;
    }

    getBase(): User {
        return this;
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