export class PbTeamPlayers { //this is pretty much just a map but JSON.stringfy doesn't like maps so this is just to bypasses that for the data channels
    pbId: string;
    playerIds: string[];

    constructor (pbId: string, playerIds: string[]) {
        this.pbId = pbId;
        this.playerIds = playerIds;
    }
}