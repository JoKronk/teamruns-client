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
  localPlayer: LocalPlayerData = new LocalPlayerData(this._user.user.getUserBase());
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
        this.runHandler.sendEvent(EventType.EndPlayerRun, true);
        this.runHandler.sendEvent(EventType.NewCell, new Task("int-finalboss-forfeit", this.localPlayer.user, this.runHandler.run!.getTimerShortenedFormat()));
      }
    });
  }

  toggleReady() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
    this.runHandler.sendEvent(EventType.Ready, this.localPlayer.state);
  }

  toggleReset() {
    this.localPlayer.state = this.localPlayer.state === PlayerState.WantsToReset ? this.localPlayer.team?.tasks.some(x => x.obtainedById === this.localPlayer.user.id && x.gameTask === "int-finalboss-forfeit") ? PlayerState.Forfeit : PlayerState.Neutral : PlayerState.WantsToReset;
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

  kickPlayer(userId: string) {
    this.runHandler.sendEvent(EventType.Kick, userId);
  }


  copyMultiTwitchLink() {
    const twitchLinks: string[] | undefined = this.runHandler.run?.teams.flatMap(team => team.players.filter(x => x.user.twitchName !== null).flatMap(x => x.user.twitchName!));
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
    if (!this.localPlayer.team || !this.runHandler.run?.timer.runIsOngoing()) {
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

          if (!insignificantChange)
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

          var cell = new Task(task, this.localPlayer.user, this.runHandler.run.getTimerShortenedFormat());
          this.runHandler.sendEvent(EventType.NewCell, cell);
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
    if (this.runHandler.run!.data.mode === RunMode.Lockout && this.runHandler.run!.teams.some(team => team.tasks.some(x => x.gameTask === task)))
      return false;
    if (task === "int-finalboss-movies")
      return true;
    if (Task.isCell(task)) {
      if (this.runHandler.run?.data.mode === RunMode.Speedrun && !this.runHandler.run.runHasCell(task))
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
