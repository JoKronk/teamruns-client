import { Component, HostListener, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameState } from '../common/player/game-state';
import { Run } from '../common/run/run';
import { Task } from '../common/run/task';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { Subscription } from 'rxjs';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunMode } from '../common/run/run-mode';
import { Timer } from '../common/run/timer';
import { PlayerState } from '../common/player/player-state';
import { RunState } from '../common/run/run-state';

@Component({
  selector: 'app-run',
  templateUrl: './run.component.html',
  styleUrls: ['./run.component.scss']
})
export class RunComponent implements OnDestroy {

  buildVersion: string = pkg.version;
  run: Run | undefined;
  localPlayer: LocalPlayerData = new LocalPlayerData("", RunMode.Speedrun);
  playerState = PlayerState;
  runState = RunState;

  runSubscription: Subscription;

  constructor(public _user: UserService, private _firestore: FireStoreService, private route: ActivatedRoute, private zone: NgZone) {
    this.setupListeners();

    //on parameter get
    //this.route.paramMap.subscribe((params) => { //!SWAPPED TO QUERY PARAM AS ELECTRON WAS BUGGING WHEN ROUTE CONTAINS MORE THAN ONE /
    this.route.queryParamMap.subscribe((params) => {
      let runId = params.get('id');
      //handle online run
      if (runId) {
        //handle run updates
        this.runSubscription = _firestore.getRun(runId).subscribe((runDoc) => {
          //skip local change call
          if (runDoc.payload.metadata.hasPendingWrites)
            return;
          let run = runDoc.payload.data();
          if (run) {
            if (!this.run) {
              this.run = Object.assign(new Run(run.data, run.teams.length), run);
              this.run.timer = Object.assign(new Timer(run.timer.countdownSeconds), run.timer);
              this.onRunFound();
            }
            else
              this.run.importChanges(this.localPlayer, run, _user._goal);
          }
          return;
        });
      }
      
      //handle local run
      if (!this.run)
        this.run = _user.getLocalRunStorage();
      
      if (this.run)
        this.onRunFound();
    });
  }

  onRunFound() {
    if (this.run && (this.run.timer.runState === RunState.Started || this.run.timer.runState === RunState.Countdown))
      this.run.timer.updateTimer();
      
    this.localPlayer = new LocalPlayerData(this._user.getName(), this.run!.data.mode);

    let playerTeam = this.run?.getPlayerTeam(this.localPlayer.name);
    if (playerTeam)
      this.localPlayer.team = playerTeam.name;
    
    this.getInitPlayerState();
  }

  sendRunUpdate() {
    this._firestore.updateRun(this.run);
  }

  toggleReady() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
    this.run!.toggleReady(this._user.getName(), this.localPlayer.state);
    
    //check if everyone is ready, send start call if so
    if (this.localPlayer.state === PlayerState.Ready && this.run!.everyoneIsReady()) {
      this._firestore.deleteLobby(this.run!.id);
      this.run!.start(new Date());
    }
    
    this.sendRunUpdate();
  }

  toggleReset() {
    console.log("prevopis state! ", this.localPlayer.state);
    this.localPlayer.state = this.localPlayer.state === PlayerState.WantsToReset ? PlayerState.Neutral : PlayerState.WantsToReset;
    console.log("state! ", this.localPlayer.state);
    if (this.run!.toggleVoteReset(this._user.getName(), this.localPlayer.state)) {
      this._user._goal.runCommand("(send-event *target* 'loading)");
      this.localPlayer.state = PlayerState.Neutral;
    }
    this.sendRunUpdate();
  }

  switchTeam(teamName: string) {
    if (this.run?.switchTeam(this._user.getName(), teamName)) {
      this.localPlayer.team = teamName;
      this.sendRunUpdate();
    }

  }

  setupListeners() {
    //state update
    (window as any).electron.receive("og-state-update", (state: GameState) => {
      this.zone.run(() => {
        if (this.run && state && this.localPlayer.gameState.hasChanged(state)) {
          this.localPlayer.gameState = Object.assign(new GameState(), state);
          this.run.updateState(this._user.getName(), state);
          this.sendRunUpdate();
        }
      });
    });

    //on task get
    (window as any).electron.receive("og-task-update", (task: string) => {
      this.zone.run(() => {
        if (!this.run)
        return;

        if (this.shouldAddTask(task)) {  
          if (task === "int-finalboss-movies") {
            this.localPlayer.state = PlayerState.Finished;
            this.run.endPlayerRun(this._user.getName());
          }

          var cell = new Task(task, this._user.getName(), this.run.getTimerShortenedFormat());
          this.run.addSplit(cell);
          this.sendRunUpdate();
        }
      });
    });
  }

  private shouldAddTask(task: string): boolean {
    if (this.run!.timer.runState !== RunState.Started || this.localPlayer.state === PlayerState.Finished || this.localPlayer.state === this.playerState.Forfeit)
      return false;
    if (task === "int-finalboss-movies")
      return true;
    if (Task.isCell(task)) {
      console.log(this.run)
      if (this.run?.data.mode === RunMode.Speedrun && !this.run.runHasCell(task))
        return true;
      else if (!this.run?.playerTeamHasCell(task, this.localPlayer.name))
        return true;
    }
    return false;
  }

  //state read
  getInitPlayerState(): void {
    (window as any).electron.send('og-state-read');
  }

  ngOnDestroy() {
    if (this.runSubscription)
      this.runSubscription.unsubscribe();
    
    this.run?.removePlayer(this.localPlayer.name);
    this.sendRunUpdate();
  }
  
  @HostListener('window:unload', [ '$event' ])
  unloadHandler(event: any) {
    //event.returnValue = false; !TODO: Add once custom close button is added!
    this.run?.removePlayer(this.localPlayer.name);
    this.sendRunUpdate();
  }

  @HostListener('window:beforeunload', [ '$event' ])
  beforeUnloadHandler(event: any) {
    //event.returnValue = false; !TODO: Add once custom close button is added!
    this.run?.removePlayer(this.localPlayer.name);
    this.sendRunUpdate();
  }

}
