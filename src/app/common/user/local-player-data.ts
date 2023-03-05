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

  constructor() {
    this.name = "";
    this.team = "";
    this.mode = RunMode.Speedrun;
    this.gameState = new GameState();
    this.state = PlayerState.Neutral;
    this.restrictedZoomerLevels = ['firecanyon', 'ogre', 'lavatube'];
  }
}