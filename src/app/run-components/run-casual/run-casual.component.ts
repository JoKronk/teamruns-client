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
import { AddPlayerComponent } from '../../dialogs/add-player/add-player.component';
import { Player } from '../../common/player/player';
import { OG } from '../../common/opengoal/og';
import { RunStateHandler } from 'src/app/common/level/run-state-handler';
import { OgCommand } from 'src/app/common/socket/og-command';

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
  mainLocalPlayer: LocalPlayerData = new LocalPlayerData(this._user.user, OG.mainPort, this.zone);
  runHandler: RunHandler;

  hasLoadedFile: boolean;

  constructor(public _user: UserService, private firestoreService: FireStoreService, private route: ActivatedRoute, private zone: NgZone, private dialog: MatDialog, private router: Router) {
    
    this._user.localUsers = [ this.mainLocalPlayer ];

    //on parameter get (was swapped from route as electon had issues getting routes containing more than one (/) path)
    this.route.queryParamMap.subscribe((params) => {
      let runId = params.get('id');

      this.runHandler = new RunHandler(runId ?? undefined, firestoreService, _user, dialog, zone);
      this.toggleReady();
    });
  }

  addLocalPlayer(teamId: number) {
    const dialogRef = this.dialog.open(AddPlayerComponent, { data: this.runHandler.run?.timer });
    const dialogSubscription = dialogRef.afterClosed().subscribe((player: LocalPlayerData | undefined) => {
      dialogSubscription.unsubscribe();

      if (player && this.runHandler.run) {
        this.runHandler.run.spectators.push(new Player(player.user));
        this.runHandler.sendEvent(EventType.ChangeTeam, player.user.id, teamId);
        player.socketHandler.run = this.runHandler.run;
        player.updateTeam(this.runHandler.run.getPlayerTeam(player.user.id));
        player.socketHandler.startDrawPlayers();
        player.socketHandler.addCommand(OgCommand.StartRun);
      }
    });
  }

  toggleReady() {
    this._user.localUsers.forEach(localPlayer => {
      localPlayer.state = localPlayer.state === PlayerState.Ready ? PlayerState.Neutral : PlayerState.Ready;
      this.runHandler.sendEvent(EventType.Ready, localPlayer.user.id, localPlayer.state);
    });
  }

  toggleReset() {
    this._user.localUsers.forEach(localPlayer => {
      localPlayer.state = localPlayer.state === PlayerState.WantsToReset ? localPlayer.getTeam()?.splits.some(x => x.obtainedById === localPlayer.user.id && x.gameTask === Task.forfeit) ? PlayerState.Forfeit : PlayerState.Neutral : PlayerState.WantsToReset;
      this.runHandler.sendEvent(EventType.ToggleReset, localPlayer.user.id, localPlayer.state);
    });
  }

  loadSave(save: RunStateHandler) {
    if (!this.runHandler.run) return;

    let team = this.runHandler.getMainLocalPlayer().getTeam();
    if (team)
      team.runState = save;

    this._user.localUsers.forEach(player => {
      if (this.runHandler.run) {
        this.runHandler.runSyncLocalPlayer(player, this.runHandler.run, false);
        player.importRunStateHandler(save, false);
        let teamPlayer = team?.players.find(x => x.user.id === player.user.id);
        if (teamPlayer) teamPlayer.cellsCollected = save.tasksStatuses.filter(x => x.userId === teamPlayer?.user.id && Task.isCellCollect(x.interName, TaskStatus.nameFromEnum(x.interStatus))).length;
      }
    });
    this.hasLoadedFile = true;
  }


  switchTeam(teamId: number) {
    let userId = this.mainLocalPlayer.user.id;
    if (this._user.localUsers.length !== 1) {
      
    }

    let localPlayer = this._user.localUsers.find(x => x.user.id === userId);
    if (!localPlayer) return;

    if (this.runHandler.run?.timer.runState !== RunState.Waiting && this.runHandler.isSpectatorOrNull(userId)) return;
    this.runHandler.sendEvent(EventType.ChangeTeam, userId, teamId);
    localPlayer.updateTeam(this.runHandler.run?.getTeam(teamId) ?? undefined);
  }

  kickPlayer(user: UserBase) {
    if (this.runHandler.run?.timer.runIsOngoing()) {
      const dialogRef = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to kick " + user.name + "?" });
      const dialogSubscription = dialogRef.afterClosed().subscribe(confirmed => {
        dialogSubscription.unsubscribe();
        if (confirmed)
          this.runHandler.sendEventAsMain(EventType.Kick, user);
      });
    }
    else
      this.runHandler.sendEventAsMain(EventType.Kick, user);
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
