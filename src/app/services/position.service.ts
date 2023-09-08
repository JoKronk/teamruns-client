import { Injectable, OnDestroy } from '@angular/core';
import { Recording } from '../common/playback/recording';
import { CurrentPositionData, PositionDataTimestamp, UserPositionDataTimestamp } from '../common/playback/position-data';
import { UserService } from './user.service';
import { TimerService } from './timer.service';
import { OG } from '../common/opengoal/og';
import { UserBase } from '../common/user/user';

@Injectable({
  providedIn: 'root'
})
export class PositionService implements OnDestroy {

  recordings: Recording[] = [];
  userPositionRecording: Recording[] = [];

  private players: CurrentPositionData[] = [];
  private drawPositions: boolean = false;
  private positionUpdateRateMs: number = 100;


  constructor(public userService: UserService, public timer: TimerService) {
  }

  resetGetRecordings(): Recording[] {
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


  addRecording(recording: Recording, user: UserBase) {
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
      userRecording = new Recording(positionData.userId);
      this.userPositionRecording.unshift(userRecording);
    }

    //log if timer has started
    if (positionData.time !== 0)
      userRecording.playback.unshift(new PositionDataTimestamp(positionData, positionData.time));
  }

  startDrawPlayers() {
    if (this.drawPositions) return;
    this.drawPositions = true;
    this.drawPlayers();
    this.players.forEach(player => {
      OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-connected))");
    })
  }

  stopDrawPlayers() {
    this.drawPositions = false;
    this.players.forEach(player => {
      OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
    })
  }

  private async drawPlayers() {
    if (!this.drawPositions) return;

    this.recordings.forEach(player => {
      const positionData = player.playback.find(x => x.time < this.timer.totalMs);
      if (!positionData) return;
      const currentPlayer = this.players.find(x => x.user.id === player.userId);
      if (!currentPlayer) return;

      currentPlayer.updateCurrentPosition(positionData);
    });

    OG.updatePlayerPositions(this.players);
    await new Promise(r => setTimeout(r, this.positionUpdateRateMs));

    this.drawPlayers();
  }

  ngOnDestroy(): void {
    this.players.forEach(player => {
      OG.runCommand("(set! (-> *multiplayer-info* players " + player.playerId + " mp_state) (mp-tgt-state mp-tgt-disconnected))");
    })
  }
}
