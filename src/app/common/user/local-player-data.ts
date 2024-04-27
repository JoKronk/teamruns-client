import { GameState } from "../opengoal/game-state";
import { PlayerState } from "../player/player-state";
import { RunMode } from "../run/run-mode";
import { Run } from "../run/run";
import { Team } from "../run/team";
import { User } from "./user";
import { SocketHandler } from "../socket/socket-handler";
import { RunCleanupHandler } from "../level/run-cleanup-handler";
import { NgZone } from "@angular/core";
import { RunStateHandler } from "../level/run-state-handler";
import { SocketHandlerLockout } from "../socket/socket-handler-lockout";
import { SyncType } from "../level/sync-type";

export class LocalPlayerData {
  user: User;
  mode: RunMode = RunMode.Speedrun;
  gameState: GameState = new GameState();
  state: PlayerState = PlayerState.Neutral;

  socketHandler: SocketHandler;
  cleanupHandler: RunCleanupHandler = new RunCleanupHandler();

  constructor(user: User, port: number, run: Run, zone: NgZone) {
    this.user = user;
    this.mode = run.data.mode;

    switch (run.data.mode) {
      case RunMode.Lockout:
        this.socketHandler = new SocketHandlerLockout(port, user, run, this.cleanupHandler, zone);
        break;
      default:
        this.socketHandler = new SocketHandler(port, user, run, this.cleanupHandler, zone);
        break;
    }
  }

  importRunStateHandler(runStateHandler: RunStateHandler, syncType: SyncType) {
    this.socketHandler.isSyncing = true;
    this.cleanupHandler.importRunState(runStateHandler, this.socketHandler, this.gameState, syncType);

    setTimeout(() => {
      if (this.socketHandler.inMidRunRestartPenaltyWait === 0)
        this.socketHandler.isSyncing = false;
    }, 100);
  }

  updateTeam(team: Team | undefined) {
    if (!team) return;
    this.socketHandler.localTeam = team;
  }


  checkDesync(run: Run) {
    if (!this.socketHandler.localTeam) this.socketHandler.localTeam = run.getPlayerTeam(this.user.id, true);
    let syncType = this.isInSync();
    if (!this.socketHandler.localTeam || syncType === SyncType.None || this.socketHandler.isSyncing) return;


    this.socketHandler.isSyncing = true;
    setTimeout(() => {  //give the player some time to catch up if false positive
      syncType = this.isInSync();
      if (syncType === SyncType.None) {
        this.socketHandler.isSyncing = false;
        return;
      }
      
      this.importRunStateHandler(this.socketHandler.localTeam!.runState, syncType);

    }, 1000);
    }

  private isInSync(): SyncType {
    let syncType: SyncType = SyncType.None;
    if (!this.socketHandler.localTeam) return syncType;
    
    if (this.socketHandler.localTeam.runState.orbCount > this.gameState.orbCount)
      syncType = SyncType.Soft;
    
    //if (this.socketHandler.localTeam.runState.buzzerCount > this.gameState.buzzerCount)
    //  syncType = SyncType.Hard;

    if (this.socketHandler.localTeam.runState.cellCount > this.gameState.cellCount)
      syncType = SyncType.Hard;
    return syncType;
  }

  onDestroy(): void {
    (window as any).electron.send('og-close-game', this.socketHandler.socketPort);
    
    this.socketHandler.onDestroy();
  }
}