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

  importRunStateHandler(runStateHandler: RunStateHandler) {
    this.levelHandler.importRunStateHandler(runStateHandler, this.socketHandler, this.gameState.orbCount);
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
    if (this.isSyncing) return;
    if (!this.team) this.team = run.getPlayerTeam(this.user.id);
    if (!this.team) return;

    if (this.team.runState.cellCount > this.gameState.cellCount || (run.isMode(RunMode.Lockout) && run.teams.reduce((a, b) => a + (b.runState.cellCount || 0), 0) > this.gameState.cellCount)) {

      this.isSyncing = true;
      setTimeout(() => {  //give the player some time to spawn in
        if (!run.isMode(RunMode.Lockout)) {
          this.importRunStateHandler(this.team!.runState);
        }
        else {
          run.teams.forEach(runTeam => {
            this.importRunStateHandler(runTeam.runState);
          });
        }

        setTimeout(() => {
          this.isSyncing = false;
        }, 1000);
      }, 300);
    }
    //thought of adding a check for if you have more cells than others but this would instantly mess up a run for everyone 
    //if you accidentally loaded a file with more cells than the run in it, and even though low I think the chance for that is higher than a desync this way

  }

  onDestroy(): void {
    this.socketHandler.onDestroy();
  }
}