export class PbTeamPlayers { //this is pretty much just a map but JSON.stringfy doesn't like maps so this is just to bypasses that for the data channels
    pbId: string;
    playerIds: string[];
    leaderboardPosition: number;

    constructor (pbId: string, playerIds: string[], lbPosition: number) {
        this.pbId = pbId;
        this.playerIds = playerIds;
        this.leaderboardPosition = lbPosition;
    }
}