import { OG } from "../opengoal/og";
import { CurrentPositionData, PositionDataTimestamp, UserPositionDataTimestamp } from "./position-data";
import { DbUserPositionData } from "./db-user-position-data";
import { UserBase } from "../user/user";
import { UserService } from "src/app/services/user.service";

export class PositionHandler {

    recordings: DbUserPositionData[] = [];
    userPositionRecording: DbUserPositionData[] = [];

    private players: CurrentPositionData[] = [];
    private lastDrawTime: number = 0;

    private userService: UserService;

    constructor(userService: UserService) {
        this.userService = userService;
    }

    onTimerReset() {
        this.lastDrawTime = 0;
    }

    resetGetRecordings(): DbUserPositionData[] {
        const recordings = this.userPositionRecording;
        this.players.forEach(player => {
            OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
        });

        this.userPositionRecording = [];
        this.recordings = [];
        this.players = [];
        return recordings;
    }

    removePlayer(userId: string) {
        this.recordings = this.recordings.filter(x => x.userId !== userId);
        this.userPositionRecording = this.userPositionRecording.filter(x => x.userId !== userId);
        const player = this.players.find(x => x.user.id === userId);
        if (!player) return;

        this.players = this.players.filter(x => x.user.id !== userId);
        OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
    }

    checkRegisterPlayer(user: UserBase | undefined) {
        if (!user || this.players.find(x => x.user.id === user.id) || user.id === this.userService.getId()) return;

        const playerId = this.findOpenPlayerId();
        this.players.push(new CurrentPositionData(user, playerId));
        
        OG.runCommand("(set! (-> *multiplayer-info* players " + playerId + " username) \"" + user.name + "\")");
        OG.runCommand("(set! (-> *multiplayer-info* players " + playerId + " mp_state) (mp-tgt-state mp-tgt-connected))");
        OG.runCommand("(set! (-> *self-player-info* color) (tgt-color normal))");
    }

    private findOpenPlayerId() {
        this.players.sort((a, b) => a.playerId - b.playerId);
    
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].playerId !== i + 1) {
                return i + 1;
          }
        }
    
        return this.players.length + 1;
    }


    addRecording(recording: DbUserPositionData, user: UserBase) {
        recording.userId = recording.id;
        user.id = recording.id;
        this.checkRegisterPlayer(user);
        this.recordings.push(recording);
    }


    updatePosition(positionData: UserPositionDataTimestamp) {
        let player = this.players.find(x => x.user.id === positionData.userId);
        
        if (player)
            player.updateCurrentPosition(positionData);
        else if (positionData.userId !== this.userService.getId())
            return;

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

            currentPlayer.updateCurrentPosition(positionData);
        });

        OG.updatePlayerPositions(this.players);
        
    }

    destroy() {
        this.players.forEach(player => {
            OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
        })
    }
}