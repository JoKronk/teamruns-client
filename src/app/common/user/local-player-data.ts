import { OG } from "../opengoal/og";
import { GameState } from "../opengoal/game-state";
import { PlayerState } from "../player/player-state";
import { RunMode } from "../run/run-mode";
import { Task } from "../opengoal/task";
import { Run } from "../run/run";
import { Team } from "../run/team";
import { Level } from "../opengoal/levels";
import { UserBase } from "./user";
import { CitadelOption } from "../run/run-data";
import { GameTask } from "../opengoal/game-task";
import { TaskStatus } from "../opengoal/task-status";
import { PlayerHandler } from "../playback/player-handler";
import { LevelHandler } from "../level/level-handler";

export class LocalPlayerData {
  user: UserBase;
  team: Team | undefined = undefined;
  mode: RunMode = RunMode.Speedrun;
  gameState: GameState = new GameState();
  state: PlayerState = PlayerState.Neutral;

  hasCitadelSkipAccess: boolean;
  isSyncing: boolean = false;

  constructor(user: UserBase) {
    this.user = user;
    this.resetRunDependentProperties();
  }

  resetRunDependentProperties() {
    this.hasCitadelSkipAccess = true;
  }


  checkDesync(run: Run, levelHandler: LevelHandler, positionHandler: PlayerHandler) {
    if (this.isSyncing) return;
    if (!this.team) this.team = run.getPlayerTeam(this.user.id);
    if (!this.team) return;

    if (this.team.runState.cellCount > this.gameState.cellCount || (run.isMode(RunMode.Lockout) && run.teams.reduce((a, b) => a + (b.runState.cellCount || 0), 0) > this.gameState.cellCount)) {

      this.isSyncing = true;
      setTimeout(() => {  //give the player some time to spawn in
        if (!run.isMode(RunMode.Lockout)) {
          levelHandler.importRunStateHandler(this.team!.runState, positionHandler);
        }
        else {
          run.teams.forEach(runTeam => {
            levelHandler.importRunStateHandler(runTeam.runState, positionHandler);
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
}