import { Component, HostListener, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameState } from '../common/player/game-state';
import { Run } from '../common/run/run';
import { Task } from '../common/opengoal/task';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { Subscription } from 'rxjs';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunMode } from '../common/run/run-mode';
import { Timer } from '../common/run/timer';
import { PlayerState } from '../common/player/player-state';
import { RunState } from '../common/run/run-state';
import { RunHandler } from '../common/run/run-handler';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DataChannelEvent } from '../common/peer/data-channel-event';
import { EventType } from '../common/peer/event-type';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmComponent } from '../dialogs/confirm/confirm.component';

@Component({
  selector: 'app-run',
  templateUrl: './run.component.html',
  styleUrls: ['./run.component.scss']
})
export class RunComponent implements OnDestroy {
  
  //variables for frontend checks
  buildVersion: string = pkg.version;
  playerState = PlayerState;
  runState = RunState;

  //component variables
  localPlayer: LocalPlayerData = new LocalPlayerData();
  runHandler: RunHandler;

  private stateListener: any;
  private taskListener: any;


  constructor(public _user: UserService, private firestore: AngularFirestore, private route: ActivatedRoute, private zone: NgZone, private dialog: MatDialog, private router: Router) {
    this.setupListeners();
    
    //on parameter get (was swapped from route as electon had issues getting routes containing more than one (/) path)
    this.route.queryParamMap.subscribe((params) => {
      let runId = params.get('id');
      if (!runId) return;

      this.runHandler = new RunHandler(runId, firestore, _user, this.localPlayer, zone);
    });
  }

  forfeit() {
    if (!this.runHandler.run) return;

    const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to forfeit the run?" });
    const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed) {
        this.localPlayer.state = PlayerState.Forfeit;
        this.runHandler.sendEvent(EventType.EndPlayerRun, true);
        this.runHandler.sendEvent(EventType.NewCell, new Task("int-finalboss-forfeit", this._user.getName(), this.runHandler.run!.getTimerShortenedFormat()));
      }
    });
  }

  toggleReady() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
    this.runHandler.sendEvent(EventType.Ready, this.localPlayer.state);
  }

  toggleReset() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.WantsToReset ? PlayerState.Neutral : PlayerState.WantsToReset;
    this.runHandler.sendEvent(EventType.ToggleReset, this.localPlayer.state);
  }

  switchTeam(teamName: string) {
    if (this.runHandler.run?.timer.runState !== RunState.Waiting && this.isSpectatorOrNull()) return;

    //swap from spectator if user currently is
    if (this.runHandler.lobby?.spectators.includes(this.localPlayer.name)) 
      this.movePlayerOutOfSpectators();

    this.runHandler.sendEvent(EventType.ChangeTeam, teamName);
    this.localPlayer.team = this.runHandler.run?.getTeam(teamName) ?? undefined;
    this.runHandler.getPlayerState();
  }

  private movePlayerOutOfSpectators() {
    this.zone.run(() => {
      if (!this.runHandler.lobby) return;
      let change = false;
      if (this.runHandler.lobby.spectators.includes(this.localPlayer.name)) {
        this.runHandler!.lobby.spectators = this.runHandler.lobby.spectators.filter(user => user !== this.localPlayer.name);
        change = true;
      }
      
      if (!this.runHandler.lobby.runners.includes(this.localPlayer.name)) { //incase disconnect
        this.runHandler.lobby.runners.push(this.localPlayer.name);
        change = true;
      }
      this.runHandler.updateFirestoreLobby();
    });
  }

  copyMultiTwitchLink() {
    const twitchLinks: string[] | undefined = this.runHandler.run?.teams.flatMap(team => team.players.filter(x => x.twitchName !== null).flatMap(x => x.twitchName!));
    if (!twitchLinks || twitchLinks.length === 0) {
      this._user.sendNotification("No players with twitch links found!");
    }
    else {
      let link = "https://www.multitwitch.tv";
      twitchLinks.forEach(user => {
        link += "/" + user;
      });
      this._user.copyLink(link);
    }
  }

  routeToLobby() {
    if (!this.localPlayer.team || this.runHandler.run?.timer.runState === RunState.Waiting || this.runHandler.run?.timer.runState === RunState.Ended) {
      this.router.navigate(['/lobby' ]);
      return;
    }

    const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to leave the run in progress?" });
    const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed)
        this.router.navigate(['/lobby' ]);
    });
  }

  setupListeners() {
    //state update
    this.stateListener = (window as any).electron.receive("og-state-update", (state: GameState) => {
      this.zone.run(() => {
        if (!this.runHandler.run || !state || this.isSpectatorOrNull()) return;

        this.localPlayer.gameState.cellCount = state.cellCount;
        this.localPlayer.checkDesync(this.runHandler.run);

        //handle task status updates
        if (this.localPlayer.gameState.hasSharedTaskChange(state) && this.runHandler.run.timer.runState !== RunState.Waiting) {
          this.localPlayer.gameState.sharedTasks = state.sharedTasks;
          this.runHandler.sendEvent(EventType.NewTaskStatusUpdate, state.sharedTasks);
        }

        //handle state change
        if (this.localPlayer.gameState.hasPlayerStateChange(state) && this.localPlayer.state !== PlayerState.Finished) {
          this.localPlayer.gameState.currentLevel = state.currentLevel;
          this.localPlayer.gameState.currentCheckpoint = state.currentCheckpoint;
          this.localPlayer.gameState.onZoomer = state.onZoomer;
          this.runHandler.sendEvent(EventType.NewPlayerState, state);
          
          //handle klaww kill
          this.localPlayer.checkKillKlaww();
        }

        //handle no LTS
        if (this.runHandler.run.data.noLTS)
          this.localPlayer.checkNoLTS();

        //handle no Citadel Skip
        if (this.runHandler.run.data.noCitadelSkip)
          this.localPlayer.checkNoCitadelSkip(this.runHandler.run);
      });
    });

    //on task get
    this.taskListener = (window as any).electron.receive("og-task-update", (task: string) => {
      this.zone.run(() => {
        if (!this.runHandler.run || this.isSpectatorOrNull()) return;

        if (this.shouldAddTask(task)) {  
          //run end
          if (task === "int-finalboss-movies") {
            this.localPlayer.state = PlayerState.Finished;
            this.runHandler.sendEvent(EventType.EndPlayerRun, false);
          }

          var cell = new Task(task, this._user.getName(), this.runHandler.run.getTimerShortenedFormat());
          this.runHandler.sendEvent(EventType.NewCell, cell);
        }
      });
    });
  }

  private isSpectatorOrNull() {
    return !this.localPlayer.name || this.localPlayer.name === "" || this.runHandler.lobby?.spectators.includes(this.localPlayer.name);
  }

  private shouldAddTask(task: string): boolean {
    if (this.runHandler.run!.timer.runState !== RunState.Started || this.localPlayer.state === PlayerState.Finished || this.localPlayer.state === PlayerState.Forfeit)
      return false;
    if (this.runHandler.run!.data.mode === RunMode.Lockout && this.runHandler.run!.teams.some(team => team.tasks.some(x => x.gameTask === task)))
      return false;
    if (task === "int-finalboss-movies")
      return true;
    if (Task.isCell(task)) {
      if (this.runHandler.run?.data.mode === RunMode.Speedrun && !this.runHandler.run.runHasCell(task))
        return true;
      else if (!this.runHandler.run?.playerTeamHasCell(task, this.localPlayer.name))
        return true;
    }
    return false;
  }


  destory() {
    this.stateListener();
    this.taskListener();
    this.runHandler.destroy();
  }

  ngOnDestroy() {
    this.destory();
  }
  
  @HostListener('window:unload', [ '$event' ])
  unloadHandler(event: any) {
    //event.returnValue = false; !TODO: Add once custom close button is added!
    this.destory();
  }

  @HostListener('window:beforeunload', [ '$event' ])
  beforeUnloadHandler(event: any) {
    //event.returnValue = false; !TODO: Add once custom close button is added!
    this.destory();
  }

}
