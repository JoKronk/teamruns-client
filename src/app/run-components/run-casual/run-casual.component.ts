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
import { TaskStatus } from '../../common/opengoal/task-status';
import { AddPlayerComponent, AddPlayerPackage, AddPlayerResponse } from '../../dialogs/add-player/add-player.component';
import { OG } from '../../common/opengoal/og';
import { LocalSave } from 'src/app/common/level/local-save';
import { Subscription } from 'rxjs';
import { SyncType } from 'src/app/common/level/sync-type';
import { RunSetupState } from 'src/app/common/run/run-setup-state';

@Component({
  selector: 'app-run-casual',
  templateUrl: './run-casual.component.html',
  styleUrls: ['./run-casual.component.scss']
})
export class RunCasualComponent implements OnDestroy {
  
  //variables for frontend checks
  buildVersion: string = pkg.version;
  playerState = PlayerState;
  runState = RunState;

  //component variables
  mainLocalPlayer: LocalPlayerData | undefined = undefined;
  runHandler: RunHandler;

  runSetupSubscription: Subscription;

  hasLoadedFile: boolean;

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
        else if (state === RunSetupState.Connected) {
          setTimeout(() => {
            this.switchTeam(0);
            this.toggleReady();
          }, 1000);
        }
        
      });
    });

  }


  addLocalPlayer() {
    if (!this.runHandler.run) return;
    const dialogRef = this.dialog.open(AddPlayerComponent, { data: new AddPlayerPackage(this.runHandler.run, this.runHandler.connectionHandler) });
    const dialogSubscription = dialogRef.afterClosed().subscribe((response: AddPlayerResponse | undefined) => {
      dialogSubscription.unsubscribe();

      if (response?.player && this.runHandler.run)
        this.runHandler.setupLocalSecondaryPlayer(response.player, response.teamId);
    });
  }

  toggleReady() {
    let player = this.runHandler.run?.getPlayer(this.mainLocalPlayer?.user.id);
    if (!player) return;
    
    player.state = player.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
    this.runHandler.connectionHandler.sendEventAsMain(EventType.Ready, player.state);
  }

  toggleReset() {
    let player = this.runHandler.run?.getPlayer(this.mainLocalPlayer?.user.id);
    if (!player || !this.mainLocalPlayer) return;

    player.state = player.state === PlayerState.WantsToReset ? this.mainLocalPlayer.socketHandler.localTeam?.splits.some(x => x.obtainedById === this.mainLocalPlayer?.user.id && x.gameTask === Task.forfeit) ? PlayerState.Forfeit : PlayerState.Neutral : PlayerState.WantsToReset;
    this.runHandler.connectionHandler.sendEventAsMain(EventType.ToggleReset, player.state);
  }

  loadSave(save: LocalSave) {
    if (!this.runHandler.run) return;

    let mainPlayer = this.runHandler.getMainLocalPlayer();
    if (!mainPlayer)
      return;

    let team = mainPlayer.socketHandler.localTeam;
    if (team)
      team.runState = save;

    this.runHandler.run.data.name = save.name;

    this._user.localUsers.forEach(player => {
      if (this.runHandler.run) {
        this.runHandler.runSyncLocalPlayer(player, this.runHandler.run, false);
        player.socketHandler.importRunStateHandler(save, SyncType.Full);
        let teamPlayer = team?.players.find(x => x.user.id === player.user.id);
        if (teamPlayer) teamPlayer.cellsCollected = save.tasksStatuses.filter(x => x.userId === teamPlayer?.user.id && Task.isCellCollect(x.interName, TaskStatus.nameFromEnum(x.interStatus))).length;
      }
    });
    this.runHandler.loadRunToAllRemote();
    this.hasLoadedFile = true;
  }

  openSavesFolder() {
    (window as any).electron.send('save-open');
  }


  switchTeam(teamId: number) {
    if (!this.mainLocalPlayer) return;
    this.runHandler.connectionHandler.sendEvent(EventType.ChangeTeam, this.mainLocalPlayer.user.id, teamId);
    this.mainLocalPlayer.updateTeam(this.runHandler.run?.getTeam(teamId) ?? undefined);
  }

  handleChatMessage(message: string) {
    this.runHandler.connectionHandler.sendEventAsMain(EventType.ChatMessage, message);
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

  leave() {
    if (this.runHandler.run?.timer?.runState === RunState.Waiting) {
      this.router.navigate(['/lobby' ]);
      return;
    }

    const dialogSubscription = this.dialog.open(ConfirmComponent, { data: { message: "Are you sure you want to leave the game?" } }).afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed)
        this.router.navigate(['/lobby' ]);
    });
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
