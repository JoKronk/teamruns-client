import { Component, HostListener, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Task } from '../../common/opengoal/task';
import { UserService } from '../../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../../services/fire-store.service';
import { LocalPlayerData } from '../../common/user/local-player-data';
import { PlayerState } from '../../common/player/player-state';
import { RunState } from '../../common/run/run-state';
import { RunHandler } from '../../common/run/run-handler';
import { EventType } from '../../common/peer/event-type';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmComponent } from '../../dialogs/confirm/confirm.component';
import { UserBase } from '../../common/user/user';
import { GameTaskLevelTime } from '../../common/opengoal/game-task';
import { TaskStatus } from '../../common/opengoal/task-status';
import { AddPlayerComponent, AddPlayerPackage, AddPlayerResponse } from '../../dialogs/add-player/add-player.component';
import { OG } from '../../common/opengoal/og';
import { Subscription } from 'rxjs';
import { RunImportComponent } from 'src/app/dialogs/run-import/run-import.component';
import { RecordingPackage } from 'src/app/common/recording/recording-package';
import { LevelSymbol } from 'src/app/common/opengoal/levels';
import { RunSetupState } from 'src/app/common/run/run-setup-state';

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
  mainLocalPlayer: LocalPlayerData | undefined = undefined;
  runHandler: RunHandler;

  runSetupSubscription: Subscription;

  editingTeamId: number | null = null;

  constructor(public _user: UserService, private firestoreService: FireStoreService, private route: ActivatedRoute, private zone: NgZone, private dialog: MatDialog, private router: Router) {

    
    //on parameter get (was swapped from route as electon had issues getting routes containing more than one (/) path)
    this.route.queryParamMap.subscribe((params) => {
      let runId = params.get('id');

      this.runHandler = new RunHandler(runId ?? undefined, firestoreService, _user, dialog, zone);
      this.runSetupSubscription = this.runHandler.runSetupSubject.subscribe(state => {
        if (state === null || !this.runHandler.run || (this.mainLocalPlayer && state === RunSetupState.SetupComplete)) return;
        
        if (state === RunSetupState.SetupComplete) {
          this.mainLocalPlayer = new LocalPlayerData(this._user.user, OG.mainPort, this.runHandler.connectionHandler, this.runHandler.run, this.zone);
          this.runHandler.setupLocalMainPlayer(this.mainLocalPlayer);
        }
      });
    });
  }

  addLocalPlayer() {
    if (!this.runHandler.run) return;
    const dialogSubscription = this.dialog.open(AddPlayerComponent, { data: new AddPlayerPackage(this.runHandler.run, this.runHandler.connectionHandler) }).afterClosed().subscribe((response: AddPlayerResponse | undefined) => {
      dialogSubscription.unsubscribe();

      if (response?.player && this.runHandler.run)
        this.runHandler.setupLocalSecondaryPlayer(response.player, response.teamId);
    });
  }
  
  importRun() {
    const dialogSubscription = this.dialog.open(RunImportComponent, { data: this.runHandler.run }).afterClosed().subscribe((recordingPackage: RecordingPackage | undefined) => {
      dialogSubscription.unsubscribe();
      if (!recordingPackage) return;

      this.runHandler.importRecordings(recordingPackage);
    });
  }

  forfeit() {
    if (!this.runHandler.run) return;

    const dialogSubscription = this.dialog.open(ConfirmComponent, { data: { message: "Are you sure you want to forfeit the run?" } }).afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed) {

        this._user.localUsers.forEach(localPlayer => {
          localPlayer.state = PlayerState.Forfeit;
          const task = new GameTaskLevelTime(Task.forfeit, localPlayer.user.getUserBaseWithDisplayName(), this.runHandler.run?.getPlayer(localPlayer.user.id)?.currentLevel ?? "", this.runHandler.run!.getTimerShortenedFormat(), TaskStatus.unknown);
          this.runHandler.connectionHandler.sendEvent(EventType.EndPlayerRun, localPlayer.user.id, task);
        });

        this.runHandler.selfImportedRecordings.forEach(recPlayer => {
          const task = new GameTaskLevelTime(Task.forfeit, recPlayer, this.runHandler.run?.getPlayer(recPlayer.id)?.currentLevel ?? "", this.runHandler.run!.getTimerShortenedFormat(), TaskStatus.unknown);
          this.runHandler.connectionHandler.sendEvent(EventType.EndPlayerRun, recPlayer.id, task);
        });
      }
    });
  }

  toggleReady() {
    if (!this.mainLocalPlayer) return;
      
    this.mainLocalPlayer.state = this.mainLocalPlayer.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
    this.runHandler.connectionHandler.sendEventAsMain(EventType.Ready, this.mainLocalPlayer.state);
  }

  toggleReset() {
    if (!this.mainLocalPlayer) return;

    this.mainLocalPlayer.state = this.mainLocalPlayer.state === PlayerState.WantsToReset ? this.mainLocalPlayer.socketHandler.localTeam?.splits.some(x => x.obtainedById === this.mainLocalPlayer?.user.id && x.gameTask === Task.forfeit) ? PlayerState.Forfeit : PlayerState.Neutral : PlayerState.WantsToReset;
    this.runHandler.connectionHandler.sendEventAsMain(EventType.ToggleReset, this.mainLocalPlayer.state);
  }

  switchTeam(teamId: number) {
    if (!this.mainLocalPlayer) return;
    let userId = this.mainLocalPlayer.user.id;

    let localPlayer = this._user.localUsers.find(x => x.user.id === userId);
    if (!localPlayer) return;

    if (this.runHandler.run?.timer.runState !== RunState.Waiting && this.runHandler.isSpectatorOrNull(userId)) return;
    this.runHandler.connectionHandler.sendEvent(EventType.ChangeTeam, userId, teamId);
    localPlayer.updateTeam(this.runHandler.run?.getTeam(teamId) ?? undefined);
    let player = this.runHandler.run!.getPlayer(userId);
    if (player) player.currentLevel = LevelSymbol.toName(this.mainLocalPlayer.socketHandler.getCurrentLevel() ?? 0);
  }

  editTeamName(teamId: number) {
    if (!this.mainLocalPlayer) return;
    if (this.editingTeamId !== null)
      this.updateTeamName();
    if (this.mainLocalPlayer.state !== PlayerState.Ready && this.runHandler?.run?.timer.runState === RunState.Waiting)
      this.editingTeamId = teamId;
  }
  updateTeamName() {
    if (this.editingTeamId === null || !this.mainLocalPlayer) return;

    let team = this.runHandler.run?.getTeam(this.editingTeamId);
    if (!team) return;

    if (!team.name.replace(/\s/g, ''))
      team.name = "Team " + (team.id + 1);

    this.runHandler.connectionHandler.sendEvent(EventType.ChangeTeamName, this.mainLocalPlayer.user.id, team);
    this.editingTeamId = null;
  }

  kickPlayer(user: UserBase) {
    if (this.runHandler.run?.timer.runIsOngoing()) {
      const dialogSubscription = this.dialog.open(ConfirmComponent, { data: { message: "Are you sure you want to kick " + user.name + "?" } }).afterClosed().subscribe(confirmed => {
        dialogSubscription.unsubscribe();
        if (confirmed)
          this.runHandler.connectionHandler.sendEventAsMain(EventType.Kick, user);
      });
    }
    else
      this.runHandler.connectionHandler.sendEventAsMain(EventType.Kick, user);
  }


  destory() {
    if (this.runSetupSubscription) this.runSetupSubscription.unsubscribe();
  
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
