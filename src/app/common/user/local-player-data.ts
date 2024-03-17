import { GameState } from "../opengoal/game-state";
import { PlayerState } from "../player/player-state";
import { RunMode } from "../run/run-mode";
import { Run } from "../run/run";
import { Team } from "../run/team";
import { User } from "./user";
import { SocketHandler } from "../socket/socket-handler";
import { LevelHandler } from "../level/level-handler";
import { NgZone } from "@angular/core";
import { RunStateHandler } from "../level/run-state-handler";
import { Timer } from "../run/timer";
import { OG } from "../opengoal/og";

export class LocalPlayerData {
  user: User;
  private team: Team | undefined = undefined;
  mode: RunMode = RunMode.Speedrun;
  gameState: GameState = new GameState();
  state: PlayerState = PlayerState.Neutral;

  teamId: number | null = null; //purely here since frontend html can't access private team

  isSyncing: boolean = false;

  socketHandler: SocketHandler;
  levelHandler: LevelHandler = new LevelHandler();

  constructor(user: User, port: number, zone: NgZone, private importedTimer: Timer | undefined = undefined) {
    this.user = user;
    this.socketHandler = new SocketHandler(port, user, this.levelHandler, this.team, zone, importedTimer);
  }

  importRunStateHandler(runStateHandler: RunStateHandler, hardReset: boolean = false) {
    this.levelHandler.importRunStateHandler(runStateHandler, this.socketHandler, this.gameState.orbCount, hardReset);
  }

  getTeam(): Team | undefined {
    return this.team;
  }

  updateTeam(team: Team | undefined) {
    this.teamId = team ? team.id : null;
    if (!team) return;

    this.team = team;
    this.socketHandler.updateLocalTeam(team);
  }


  checkDesync(run: Run) {
    if (!this.team) this.team = run.getPlayerTeam(this.user.id);
    if (!this.team || this.isInSync(run) || this.isSyncing) return;


    this.isSyncing = true;
    setTimeout(() => {  //give the player some time to catch up if false positive
      if (this.isInSync(run)) {
        this.isSyncing = false;
        return;
      }

      if (!run.isMode(RunMode.Lockout))
        this.importRunStateHandler(this.team!.runState);
      else {
        run.teams.forEach(runTeam => {
          this.importRunStateHandler(runTeam.runState);
        });
      }

      setTimeout(() => {
        this.isSyncing = false;
      }, 500);
    }, 1000);
    }

  private isInSync(run: Run): boolean {
    if (!this.team) return true;
    
    if (this.team.runState.cellCount > this.gameState.cellCount || (run.isMode(RunMode.Lockout) && run.teams.reduce((a, b) => a + (b.runState.cellCount || 0), 0) > this.gameState.cellCount))
    return false;
    
    if (this.team.runState.buzzerCount > this.gameState.buzzerCount || (run.isMode(RunMode.Lockout) && run.teams.reduce((a, b) => a + (b.runState.buzzerCount || 0), 0) > this.gameState.buzzerCount))
    return false;

    if (this.team.runState.orbCount > this.gameState.orbCount || (run.isMode(RunMode.Lockout) && run.teams.reduce((a, b) => a + (b.runState.orbCount || 0), 0) > this.gameState.orbCount))
    return false;

    return true;
  }

  onDestroy(): void {
    if (OG.mainPort !== this.socketHandler.socketPort)
      (window as any).electron.send('og-close-game', this.socketHandler.socketPort);
    
    this.socketHandler.onDestroy();
  }
}