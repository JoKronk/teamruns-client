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

  importRunStateHandler(runStateHandler: RunStateHandler, hardReset: boolean = false) {
    this.cleanupHandler.importRunState(runStateHandler, this.socketHandler, this.gameState, hardReset);

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
    if (!this.socketHandler.localTeam || this.isInSync(run) || this.socketHandler.isSyncing) return;


    this.socketHandler.isSyncing = true;
    setTimeout(() => {  //give the player some time to catch up if false positive
      if (this.isInSync(run)) {
        this.socketHandler.isSyncing = false;
        return;
      }
      
      this.importRunStateHandler(this.socketHandler.localTeam!.runState);

    }, 1000);
    }

  private isInSync(run: Run): boolean {
    if (!this.socketHandler.localTeam) return true;
    
    if (this.socketHandler.localTeam.runState.cellCount > this.gameState.cellCount)
    return false;
    
    if (this.socketHandler.localTeam.runState.buzzerCount > this.gameState.buzzerCount)
    return false;

    if (this.socketHandler.localTeam.runState.orbCount > this.gameState.orbCount)
    return false;

    return true;
  }

  onDestroy(): void {
    (window as any).electron.send('og-close-game', this.socketHandler.socketPort);
    
    this.socketHandler.onDestroy();
  }
}