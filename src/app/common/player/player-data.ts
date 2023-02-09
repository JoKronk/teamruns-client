export class PlayerData {
    displayName: string;
    twitchName: string;
    darkMode: boolean;

    constructor() {
        this.displayName = "";
        this.twitchName = "";
        this.darkMode = true;
    }

    setBase(data: PlayerData) {
        this.displayName = data.displayName;
        this.twitchName = data.twitchName;
        this.darkMode = data.darkMode;
    }

    getBase(): PlayerData {
        return this;
    }
}