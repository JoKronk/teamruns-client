import { GoalService } from "src/app/services/goal.service";
import { GameState } from "../player/game-state";
import { PlayerState } from "../player/player-state";
import { RunMode } from "../run/run-mode";

export class LocalPlayerData {
  name: string;
  team: string;
  mode: RunMode;
  gameState: GameState;
  state: PlayerState;
  restrictedZoomerLevels: string[];
  killKlawwOnSpot: boolean;

  constructor() {
    this.name = "";
    this.team = "";
    this.mode = RunMode.Speedrun;
    this.gameState = new GameState();
    this.state = PlayerState.Neutral;
    this.restrictedZoomerLevels = ['firecanyon', 'ogre', 'lavatube'];
    this.killKlawwOnSpot = false;
  }

  checkKillKlaww(_goal: GoalService) {
    if (!this.killKlawwOnSpot || this.gameState.currentLevel !== "ogre" || this.gameState.onZoomer) 
      return;

    _goal.runCommand('(process-entity-status! (process-by-ename "ogre-bridge-1") (entity-perm-status complete) #t)');
    _goal.runCommand('(process-entity-status! (process-by-ename "ogreboss-1") (entity-perm-status complete) #t)');
    _goal.runCommand("(reset-actors 'life)");
    this.killKlawwOnSpot = false;
  }
}