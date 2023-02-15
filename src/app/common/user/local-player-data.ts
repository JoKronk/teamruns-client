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

  constructor(name: string, mode: RunMode) {
    this.name = name;
    this.team = "";
    this.mode = mode;
    this.gameState = new GameState();
    this.state = PlayerState.Neutral;
    this.restrictedZoomerLevels = ['firecanyon', 'ogre', 'lavatube'];
  }
}