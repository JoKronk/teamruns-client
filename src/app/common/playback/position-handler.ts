import { OG } from "../opengoal/og";
import { CurrentPositionData, PositionDataTimestamp, UserPositionDataTimestamp } from "./position-data";
import { DbUserPositionData } from "./db-user-position-data";
import { UserBase } from "../user/user";

export class PositionHandler {

    recordings: DbUserPositionData[] = [];
    userPositionRecording: DbUserPositionData[] = [];

    private players: CurrentPositionData[] = [];
    private lastDrawTime: number = 0;

    constructor() {
        
    }

    onTimerReset() {
        this.lastDrawTime = 0;
    }

    clearGetRecordings(): DbUserPositionData[] {
        const recordings = this.userPositionRecording;
        this.userPositionRecording = [];
        this.recordings = [];
        return recordings;
    }

    checkRegisterPlayer(user: UserBase | undefined, isLocalPlayer: boolean = false) {
        if (!user || this.players.find(x => x.user.id === user.id)) return;

        const playerId = this.players.length + 1;
        this.players.push(new CurrentPositionData(user, playerId));
        
        if (!isLocalPlayer) {
            OG.runCommand("(set! (-> *multiplayer-info* players " + playerId + " username) \"" + user.name + "\")");
            OG.runCommand("(set! (-> *multiplayer-info* players " + playerId + " mp_state) (mp-tgt-state mp-tgt-connected))");
            OG.runCommand("(set! (-> *self-player-info* color) (tgt-color normal))");
        }
    }


    addRecording(recording: DbUserPositionData, user: UserBase) {
        recording.userId = recording.userId + "-" + this.recordings.length;
        this.checkRegisterPlayer(user);
        this.recordings.push(recording);
    }


    updatePosition(positionData: UserPositionDataTimestamp) {
        let player = this.players.find(x => x.user.id === positionData.userId);
        
        if (!player) return;
        player.updatePosition(positionData);

        let userRecording = this.userPositionRecording.find(x => x.userId === positionData.userId);
        
        //registner new if missing
        if (!userRecording) {
            userRecording = new DbUserPositionData(positionData.userId);
            this.userPositionRecording.unshift(userRecording);
        }
        
        //log if timer has started
        if (positionData.time !== 0)
            userRecording.playback.unshift(new PositionDataTimestamp(positionData, positionData.time));

        //draw players
        if (positionData.time >= this.lastDrawTime)
            this.drawPlayers(positionData.time);
    }

    drawPlayers(timeMs: number) {
        this.lastDrawTime = timeMs;

        this.recordings.forEach(player => {
            const positionData = player.playback.find(x => x.time < timeMs);
            if (!positionData) return;
            const currentPlayer = this.players.find(x => x.user.id === player.userId);
            if (!currentPlayer) return;

            currentPlayer.updatePosition(positionData);
        });

        this.players.forEach(player => {
            OG.updatePlayerPosition(player, player.playerId)
        });
    }

    destroy() {
        this.players.forEach(player => {
            OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
        })
    }
}