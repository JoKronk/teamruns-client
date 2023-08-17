import { Component, HostListener, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameState } from '../common/player/game-state';
import { Task } from '../common/opengoal/task';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { Subscription } from 'rxjs';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunMode } from '../common/run/run-mode';
import { PlayerState } from '../common/player/player-state';
import { RunState } from '../common/run/run-state';
import { RunHandler } from '../common/run/run-handler';
import { EventType } from '../common/peer/event-type';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmComponent } from '../dialogs/confirm/confirm.component';
import { UserBase } from '../common/user/user';

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
  localPlayer: LocalPlayerData = new LocalPlayerData(this._user.user.createUserBaseFromDisplayName());
  runHandler: RunHandler;

  editingName: boolean;

  private stateListener: any;
  private taskListener: any;


  constructor(public _user: UserService, private firestoreService: FireStoreService, private route: ActivatedRoute, private zone: NgZone, private dialog: MatDialog, private router: Router) {
    this.setupListeners();
    
    //on parameter get (was swapped from route as electon had issues getting routes containing more than one (/) path)
    this.route.queryParamMap.subscribe((params) => {
      let runId = params.get('id');
      if (!runId) return;

      this.runHandler = new RunHandler(runId, firestoreService, _user, this.localPlayer, zone);
    });
  }

  forfeit() {
    if (!this.runHandler.run) return;

    const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to forfeit the run?" });
    const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed) {
        this.localPlayer.state = PlayerState.Forfeit;
        let task = new Task(Task.forfeit, this.localPlayer.user, this.runHandler.run!.getTimerShortenedFormat());
        this.runHandler.sendEvent(EventType.NewCell, task);
        this.runHandler.sendEvent(EventType.EndPlayerRun, task);
      }
    });
  }

  toggleReady() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
    this.runHandler.sendEvent(EventType.Ready, this.localPlayer.state);
  }

  toggleReset() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.WantsToReset ? this.localPlayer.team?.tasks.some(x => x.obtainedById === this.localPlayer.user.id && x.gameTask === Task.forfeit) ? PlayerState.Forfeit : PlayerState.Neutral : PlayerState.WantsToReset;
    this.runHandler.sendEvent(EventType.ToggleReset, this.localPlayer.state);
  }

  switchTeam(teamId: number) {
    if (this.runHandler.run?.timer.runState !== RunState.Waiting && this.isSpectatorOrNull()) return;
    this.runHandler.sendEvent(EventType.ChangeTeam, teamId);
    this.localPlayer.team = this.runHandler.run?.getTeam(teamId) ?? undefined;
    this.runHandler.getPlayerState();
  }

  editTeamName(teamId: number) {
    if (teamId === this.localPlayer.team?.id && this.localPlayer.state !== PlayerState.Ready && this.runHandler?.run?.timer.runState === RunState.Waiting) {
      this.editingName = !this.editingName;
    }
  }
  newTeamName() {
    if (!this.localPlayer.team) return;

    if (!this.localPlayer.team.name.replace(/\s/g, ''))
      this.localPlayer.team.name = "Team " + (this.localPlayer.team.id + 1);

    this.runHandler.sendEvent(EventType.ChangeTeamName, this.localPlayer.team.name);
    this.editingName = !this.editingName;
  }

  kickPlayer(user: UserBase) {
    if (this.runHandler.run?.timer.runIsOngoing()) {
      const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to kick " + user.name + "?" });
      const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
        dialogSubscription.unsubscribe();
        if (confirmed)
          this.runHandler.sendEvent(EventType.Kick, user);
      });
    }
    else
      this.runHandler.sendEvent(EventType.Kick, user);
  }

  setupListeners() {
    //state update
    this.stateListener = (window as any).electron.receive("og-state-update", (state: GameState) => {
      this.zone.run(() => {
        if (!this.runHandler.run || !state || this.isSpectatorOrNull()) return;

        this.localPlayer.gameState.cellCount = state.cellCount;
        this.localPlayer.checkDesync(this.runHandler.run);

        //handle task status updates
        if (this.localPlayer.gameState.hasSharedTaskChange(state) && this.runHandler.run.timer.runIsOngoing()) {
          this.localPlayer.gameState.sharedTasks = state.sharedTasks;
          this.runHandler.sendEvent(EventType.NewTaskStatusUpdate, state.sharedTasks);
        }

        //handle state change
        if (this.localPlayer.gameState.hasPlayerStateChange(state) && this.localPlayer.state !== PlayerState.Finished) {

          //this is purely to save unnecessary writes to db if user is on client-server communication
          const insignificantChange = (((this.runHandler.localSlave && this.runHandler.localSlave.peer.usesServerCommunication) || (this.runHandler.localMaster && this.runHandler.localMaster.peers.every(x => x.peer.usesServerCommunication))) && !this.localPlayer.gameState.hasSignificantPlayerStateChange(state));
          
          this.localPlayer.gameState.currentLevel = state.currentLevel;
          this.localPlayer.gameState.currentCheckpoint = state.currentCheckpoint;
          this.localPlayer.gameState.onZoomer = state.onZoomer;

          //check death
          if (this.localPlayer.gameState.hasDied(state)) {
            this.localPlayer.gameState.deathCount = state.deathCount;
  
            //handle citadel elevator
            this.localPlayer.checkCitadelElevator();
          }

          if (!insignificantChange)
            this.runHandler.sendEvent(EventType.NewPlayerState, state);
          
          //handle klaww kill
          this.localPlayer.checkKillKlaww();
        }

        //handle no LTS
        if (this.runHandler.run.data.noLTS)
          this.localPlayer.checkNoLTS();

        //handle Citadel Skip
        this.localPlayer.checkCitadelSkip(this.runHandler.run);
      });
    });

    //on task get
    this.taskListener = (window as any).electron.receive("og-task-update", (task: string) => {
      this.zone.run(() => {
        if (!this.runHandler.run || this.isSpectatorOrNull()) return;

        if (Task.isCell(task) && !this.localPlayer.cellsRecivedFromOG.includes(task))
          this.localPlayer.cellsRecivedFromOG.push(task);

        if (this.shouldAddTask(task)) {  
          if (task === "citadel-sage-green")
            this.localPlayer.hasCitadelSkipAccess = false;

          var cell = new Task(task, this.localPlayer.user, this.runHandler.run.getTimerShortenedFormat());
          this.runHandler.sendEvent(EventType.NewCell, cell);
          
          //run end
          if (task === Task.lastboss) {
            this.localPlayer.state = PlayerState.Finished;
            this.runHandler.sendEvent(EventType.EndPlayerRun, cell);
          }
        }
      });
    });
  }

  private isSpectatorOrNull() {
    return !this.localPlayer.user.id || this.localPlayer.user.id === "" || this.runHandler.lobby?.hasSpectator(this.localPlayer.user.id);
  }

  private shouldAddTask(task: string): boolean {
    if (this.runHandler.run!.timer.runState !== RunState.Started || this.localPlayer.state === PlayerState.Finished || this.localPlayer.state === PlayerState.Forfeit)
      return false;
    if (task === Task.lastboss)
      return true;
    if (Task.isCell(task)) {
      if (this.runHandler.run?.isMode(RunMode.Lockout) && !this.runHandler.run.runHasCell(task))
        return true;
      else if (!this.runHandler.run?.playerTeamHasCell(task, this.localPlayer.user.id))
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
