export class RemotePlayerInfo {
    teamId: number = 0;
    playerIndex: number = 0;
    cellsCollected: number = 0;

    constructor(teamId: number, playerIndex: number, cellsCollected: number) {
        this.teamId = teamId;
        this.playerIndex = playerIndex;
        this.cellsCollected = cellsCollected;
    }
}