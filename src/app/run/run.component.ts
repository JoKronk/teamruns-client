import { Component, HostListener, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Task } from '../common/opengoal/task';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunMode } from '../common/run/run-mode';
import { PlayerState } from '../common/player/player-state';
import { RunState } from '../common/run/run-state';
import { RunHandler } from '../common/run/run-handler';
import { EventType } from '../common/peer/event-type';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmComponent } from '../dialogs/confirm/confirm.component';
import { UserBase } from '../common/user/user';
import { PositionService } from '../services/position.service';
import { GameTask } from '../common/opengoal/game-task';
import { TaskStatus } from '../common/opengoal/task-status';

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

  constructor(public _user: UserService, private positionHandler: PositionService, private firestoreService: FireStoreService, private route: ActivatedRoute, private zone: NgZone, private dialog: MatDialog, private router: Router) {
    
    //on parameter get (was swapped from route as electon had issues getting routes containing more than one (/) path)
    this.route.queryParamMap.subscribe((params) => {
      let runId = params.get('id');
      if (!runId) return;

      this.runHandler = new RunHandler(runId, firestoreService, positionHandler, this.localPlayer, zone);
    });
  }

  forfeit() {
    if (!this.runHandler.run) return;

    const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to forfeit the run?" });
    const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed) {
        this.localPlayer.state = PlayerState.Forfeit;
        let task = new GameTask(Task.forfeit, this.localPlayer.user, this.runHandler.run!.getTimerShortenedFormat(), TaskStatus.unknown);
        this.runHandler.sendEvent(EventType.NewTaskUpdate, task);
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
    if (this.runHandler.run?.timer.runState !== RunState.Waiting && this.runHandler.isSpectatorOrNull()) return;
    this.runHandler.sendEvent(EventType.ChangeTeam, teamId);
    this.localPlayer.team = this.runHandler.run?.getTeam(teamId) ?? undefined;
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


  destory() {
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
