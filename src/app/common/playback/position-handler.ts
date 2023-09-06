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

    clearGetRecordings(): DbUserPositionData[] {
        const recordings = this.userPositionRecording;
        this.userPositionRecording = [];
        this.recordings = [];
        return recordings;
    }

    checkRegisterPlayer(user: UserBase | undefined) {
        if (this.players.length === 0)
            this.players.push(new CurrentPositionData(this.userService.user, 0));

        if (!user || this.players.find(x => x.user.id === user.id)) return;

        const playerId = this.players.length;
        this.players.push(new CurrentPositionData(user, playerId));
        
        if (user.id !== this.userService.getId()) {
            OG.runCommand("(set! (-> *multiplayer-info* players " + playerId + " username) \"" + user.name + "\")");
            OG.runCommand("(set! (-> *multiplayer-info* players " + playerId + " mp_state) (mp-tgt-state mp-tgt-connected))");
            OG.runCommand("(set! (-> *self-player-info* color) (tgt-color normal))");
        }
    }


    addRecording(recording: DbUserPositionData, user: UserBase) {
        recording.userId = recording.id;
        user.id = recording.id;
        this.checkRegisterPlayer(user);
        this.recordings.push(recording);
    }


    updatePosition(positionData: UserPositionDataTimestamp) {
        let player = this.players.find(x => x.user.id === positionData.userId);
        
        if (!player) return;
        player.updateCurrentPosition(positionData);

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

        const userId = this.userService.getId();
        this.players.forEach(player => {
            if (player.user.id !== userId)
                OG.updatePlayerPosition(player, player.playerId)
        });
    }

    destroy() {
        this.players.forEach(player => {
            OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
        })
    }
}