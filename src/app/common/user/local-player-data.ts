import { OG } from "../opengoal/og";
import { GameState } from "../player/game-state";
import { PlayerState } from "../player/player-state";
import { RunMode } from "../run/run-mode";
import { Task } from "../opengoal/task";

export class LocalPlayerData {
  name: string;
  team: string;
  mode: RunMode;
  gameState: GameState;
  state: PlayerState;
  restrictedZoomerLevels: string[];
  tasksStatus: Map<string, number>;
  killKlawwOnSpot: boolean;

  constructor() {
    this.name = "";
    this.team = "";
    this.mode = RunMode.Speedrun;
    this.gameState = new GameState();
    this.state = PlayerState.Neutral;
    this.resetRunDependentProperties();
  }

  resetRunDependentProperties() {
    this.restrictedZoomerLevels = ['firecanyon', 'ogre', 'lavatube'];
    this.tasksStatus = new Map();
    this.killKlawwOnSpot = false;
  }



  checkKillKlaww() {
    if (!this.killKlawwOnSpot || this.gameState.currentLevel !== "ogre" || this.gameState.onZoomer)
      return;

    OG.runCommand('(process-entity-status! (process-by-ename "ogre-bridge-1") (entity-perm-status complete) #t)');
    OG.runCommand('(process-entity-status! (process-by-ename "ogreboss-1") (entity-perm-status complete) #t)');
    OG.runCommand("(reset-actors 'life)");
    OG.runCommand("(process-release? *target*)");
    this.killKlawwOnSpot = false;
  }



  checkForFirstOrbCellFromMultiSeller(task: string) {
    if (task === "village1-oracle-money1") {
      OG.runCommand("(close-specific-task! (game-task village1-oracle-money1) (task-status need-introduction))");
      OG.runCommand("(close-specific-task! (game-task village1-oracle-money2) (task-status need-introduction))");
    }
    else if (task === "village2-oracle-money1") {
      OG.runCommand("(close-specific-task! (game-task village2-oracle-money1) (task-status need-introduction))");
      OG.runCommand("(close-specific-task! (game-task village2-oracle-money2) (task-status need-introduction))");
    }
    else if (task === "village3-oracle-money1") {
      OG.runCommand("(close-specific-task! (game-task village3-oracle-money1) (task-status need-introduction))");
      OG.runCommand("(close-specific-task! (game-task village3-oracle-money2) (task-status need-introduction))");
    }
    else if (task === "village3-miner-money1") {
      OG.runCommand("(close-specific-task! (game-task village3-miner-money1) (task-status need-introduction))");
      OG.runCommand("(close-specific-task! (game-task village3-miner-money2) (task-status need-introduction))");
      OG.runCommand("(close-specific-task! (game-task village3-miner-money3) (task-status need-introduction))");
      OG.runCommand("(close-specific-task! (game-task village3-miner-money4) (task-status need-introduction))");
    }
  }



  checkForZoomerTalkSkip(playerGameState: GameState) {
    if (playerGameState.currentLevel === "firecanyon" && playerGameState.onZoomer && this.restrictedZoomerLevels.includes("firecanyon"))
      OG.runCommand("(close-specific-task! (game-task firecanyon-assistant) (task-status need-reward-speech))");
    if (playerGameState.currentLevel === "lavatube" && playerGameState.onZoomer && this.restrictedZoomerLevels.includes("lavatube"))
      OG.runCommand("(close-specific-task! (game-task lavatube-start) (task-status need-reward-speech))");
  }



  updateTaskStatus(tasks: Map<string, string>, isLocalPlayer: boolean) {
    const taskStatusValues = Task.getTaskStatusValues();
    for (let [key, value] of tasks) {
      const taskValue = taskStatusValues.get(value) ?? 1;

      if ((this.tasksStatus.get(key) ?? 0) < taskValue) {
        this.tasksStatus.set(key, taskValue);
        if (isLocalPlayer || taskValue < taskStatusValues.get("need-reminder-a")!)
          continue;

        switch (key) {
          //handle hub warp gates
          case "village2-levitator":
            OG.runCommand("(close-specific-task! (game-task " + key + ") (task-status need-reminder))");
            if (this.gameState.currentLevel !== "village1") break;
            OG.runCommand("(reset-actors 'life)");
            OG.runCommand("(process-release? *target*)");
            break;
          case "village3-button":
            OG.runCommand("(close-specific-task! (game-task " + key + ") (task-status need-introduction))");
            if (this.gameState.currentLevel !== "village1" && this.gameState.currentLevel !== "village2") break;
            OG.runCommand("(reset-actors 'life)");
            OG.runCommand("(process-release? *target*)");
            break;
          case "village4-button":
            OG.runCommand("(close-specific-task! (game-task " + key + ") (task-status need-reward-speech))");
            if (this.gameState.currentLevel !== "village1" && this.gameState.currentLevel !== "village2" && this.gameState.currentLevel !== "village3") break;
            OG.runCommand("(reset-actors 'life)");
            OG.runCommand("(process-release? *target*)");
            break;
          //handle none cell tasks
          case "lavatube-balls":
            OG.runCommand("(close-specific-task! (game-task " + key + ") (task-status need-resolution))");
            break;
            case "plunger-lurker-hit":
              //softlocks sometimes
              /*
              OG.runCommand("(close-specific-task! (game-task plunger-lurker-hit) (task-status need-hint))");
              OG.runCommand('(process-entity-status! (process-by-ename "plunger-lurker-3")(entity-perm-status complete) #t)');
              OG.runCommand('(cleanup-for-death (the-as (process-by-ename "plunger-lurker-3")))');
              OG.runCommand('(deactivate (process-by-ename "plunger-lurker-3"))');
              */
              break;
          //handle cell tasks
          default:
            if (Task.isCell(key)) {
              OG.runCommand("(close-specific-task! (game-task " + key + ") (task-status need-reminder))");
            }
        }
      }
    };
  }
}