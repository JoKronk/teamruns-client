import { Injectable, OnDestroy } from '@angular/core';
import { Recording } from '../common/playback/recording';
import { CurrentPositionData, PositionDataTimestamp, UserPositionDataTimestamp } from '../common/playback/position-data';
import { UserService } from './user.service';
import { TimerService } from './timer.service';
import { UserBase } from '../common/user/user';
import { WebSocketSubject, webSocket } from "rxjs/webSocket";
import { MultiplayerState } from '../common/opengoal/multiplayer-state';

@Injectable({
  providedIn: 'root'
})
export class PositionService implements OnDestroy {

  hasDrawnRecordingNames:boolean = false;
  recordings: Recording[] = [];
  userPositionRecording: Recording[] = [];

  private self: CurrentPositionData;
  private players: CurrentPositionData[] = [];
  private drawPositions: boolean = false;
  private positionUpdateRateMs: number = 16;

  ogSocket: WebSocketSubject<any> = webSocket('ws://localhost:8111');
  private launchListener: any;


  constructor(public userService: UserService, public timer: TimerService) {

    if (this.userService.user.name) //if client is fully reloaded in a place where position service is started at same time as use we pick up user on movement instead
      this.checkRegisterPlayer(this.userService.user, MultiplayerState.interactive);

    if (this.userService.gameLaunched)
      this.connectToOpengoal();
    
    this.launchListener = (window as any).electron.receive("og-launched", (launched: boolean) => {
      if (launched)
        this.connectToOpengoal();
    });
  }
  
  private connectToOpengoal() {
    this.ogSocket.subscribe(target => {
      if (target.position) 
        this.updatePlayerPosition(new UserPositionDataTimestamp(target.position, this.timer.totalMs, this.userService.user));

      if (target.state && target.state.justSpawned)
        this.timer.onPlayerLoad();

      if (target.connected) {
        this.userService.replConnected = true;
        console.log("REPL Connected!");
      }
    },
    error => {
      console.log("Opengoal socket error, did the game shut down?");
    });
  }

  resetGetRecordings(): Recording[] {
    const recordings = this.userPositionRecording;
    this.cleanupPlayers();

    this.userPositionRecording = [];
    this.recordings = [];
    this.players = [];
    return recordings;
  }

  removePlayer(userId: string) {
    this.recordings = this.recordings.filter(x => x.userId !== userId);
    this.userPositionRecording = this.userPositionRecording.filter(x => x.userId !== userId);
    this.players = this.players.filter(x => x.userId !== userId);
  }

  checkRegisterPlayer(user: UserBase | undefined, state: MultiplayerState) {
    if (!user || this.players.find(x => x.userId === user.id)) return;

    if (user.id !== this.userService.getId())
      this.players.push(new CurrentPositionData(user, state));
    else
      this.self = new CurrentPositionData(user, MultiplayerState.interactive);
  }

  addRecording(recording: Recording, user: UserBase, state: MultiplayerState = MultiplayerState.active) {
    recording.userId = recording.id;
    user.id = recording.id;
    this.checkRegisterPlayer(user, state);
    this.recordings.push(recording);
  }


  updatePlayerPosition(positionData: UserPositionDataTimestamp) {
    let player = positionData.userId !== this.userService.user.id ? this.players.find(x => x.userId === positionData.userId) : this.self;

    if (player) player.updateCurrentPosition(positionData);
    else 
      this.checkRegisterPlayer(new UserBase(positionData.userId, positionData.username), MultiplayerState.interactive);

    if (this.timer.totalMs === 0) return;
    //handle user position recording
    let userRecording = this.userPositionRecording.find(x => x.userId === positionData.userId);

    //registner new if missing
    if (!userRecording) {
      userRecording = new Recording(positionData.userId);
      this.userPositionRecording.push(userRecording);
    }

    userRecording.playback.unshift(new PositionDataTimestamp(positionData, positionData.time));
  }

  startDrawPlayers() {
    if (this.drawPositions) return;
    this.drawPositions = true;
    this.drawPlayers();
    this.players.forEach(player => {
      if (player.mpState === MultiplayerState.disconnected)
        player.mpState = MultiplayerState.interactive;
    });
  }

  stopDrawPlayers() {
    this.drawPositions = false;
    this.cleanupPlayers();
  }

  private async drawPlayers() {
    if (!this.drawPositions) return;

    
    if (this.timer.totalMs > 0) {
      this.recordings.forEach(recording => {
        const positionData = recording.playback.find(x => x.time < this.timer.totalMs);
        if (positionData) {
          const currentPlayer = this.players.find(x => x.userId === recording.userId);
          if (currentPlayer && currentPlayer.updateCurrentPosition(positionData, recording.playback.indexOf(positionData)) && currentPlayer.mpState === MultiplayerState.interactive) {
            //!TODO: add pickup handling for recordings here
          }
        }
      });
    }

    if (this.timer.totalMs > 200) {
      if (!this.hasDrawnRecordingNames) {
        this.recordings.forEach(recording => {
          const currentPlayer = this.players.find(x => x.userId === recording.userId);
          if (currentPlayer) currentPlayer.username = recording.nameFrontend ?? "BLANK";
        });
      }
    }

    this.updatePlayersInOpengoal();
    await new Promise(r => setTimeout(r, this.positionUpdateRateMs));

    this.drawPlayers();
  }

  private updatePlayersInOpengoal() {
    this.ogSocket.next(this.players);
  }

  private cleanupPlayers() {
    if (!this.players.some(x => x.mpState !== MultiplayerState.disconnected)) return;

    this.players.forEach(player => {
      player.username = "";
      player.mpState = MultiplayerState.disconnected;
    });
    
    this.updatePlayersInOpengoal();
  }

  ngOnDestroy(): void {
    this.cleanupPlayers();
    this.launchListener();
    this.ogSocket.complete();
  }
}
