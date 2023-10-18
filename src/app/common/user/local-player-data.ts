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

export class LocalPlayerData {
  user: UserBase;
  team: Team | undefined = undefined;
  mode: RunMode = RunMode.Speedrun;
  gameState: GameState = new GameState();
  state: PlayerState = PlayerState.Neutral;

  restrictedZoomerLevels: string[];

  killKlawwOnSpot: boolean;
  hasCitadelSkipAccess: boolean;
  isSyncing: boolean = false;

  constructor(user: UserBase) {
    this.user = user;
    this.resetRunDependentProperties();
  }

  resetRunDependentProperties() {
    this.restrictedZoomerLevels = [Level.fireCanyon, Level.mountainPass, Level.lavaTube];
    this.killKlawwOnSpot = false;
    this.hasCitadelSkipAccess = true;
  }


  checkLockoutRestrictions(run: Run) {
    const playerTeam = run.getPlayerTeam(this.user.id);
    if (playerTeam) {
        if (run.teams.length !== 1) {
            if (this.gameState.cellCount < 73 || run.teams.some(team => team.id !== playerTeam.id && team.runState.cellCount > playerTeam.runState.cellCount))
                OG.removeFinalBossAccess(this.gameState.currentLevel);
            else
                OG.giveFinalBossAccess(this.gameState.currentLevel);
        }
        //free for all Lockout
        else {
            const localPlayer = run.getPlayer(this.user.id)!;
            if (this.gameState.cellCount < 73 || playerTeam.players.some(player => player.user.id !== localPlayer.user.id && player.cellsCollected > localPlayer.cellsCollected))
                OG.removeFinalBossAccess(this.gameState.currentLevel);
            else
                OG.giveFinalBossAccess(this.gameState.currentLevel);
        }
    }
  }


  checkKillKlaww() {
    if (!this.killKlawwOnSpot || this.gameState.currentLevel !== "ogre" || this.gameState.onZoomer)
      return;

    OG.runCommand('(process-entity-status! (process-by-ename "ogre-bridge-1") (entity-perm-status complete) #t)');
    OG.runCommand('(process-entity-status! (process-by-ename "ogreboss-1") (entity-perm-status complete) #t)');
    OG.runCommand("(reset-actors 'life)");
    OG.runCommand("(safe-release-from-grab)");
    this.killKlawwOnSpot = false;
  }


  checkDesync(run: Run) {
    if (this.isSyncing) return;
    if (!this.team) this.team = run.getPlayerTeam(this.user.id);
    if (!this.team) return;

    if (this.team.runState.cellCount > this.gameState.cellCount || (run.isMode(RunMode.Lockout) && run.teams.reduce((a, b) => a + (b.runState.cellCount || 0), 0) > this.gameState.cellCount)) {

      this.isSyncing = true;
      setTimeout(() => {  //give the player some time to spawn in
        if (!run.isMode(RunMode.Lockout)) {
          this.team!.splits.filter(x => x.isCell).forEach(cell => {
            OG.updateTask(new GameTask(cell.gameTask, new UserBase(cell.obtainedById, cell.obtainedByName), cell.obtainedAt));
          });
        }
        else {
          run.teams.forEach(runTeam => {
            runTeam.splits.filter(x => x.isCell).forEach(cell => {
              OG.updateTask(new GameTask(cell.gameTask, new UserBase(cell.obtainedById, cell.obtainedByName), cell.obtainedAt));
            });
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
  

  checkForZoomerTalkSkip(playerGameState: GameState) {
    if (playerGameState.currentLevel === Level.fireCanyon && playerGameState.onZoomer && this.restrictedZoomerLevels.includes(Level.fireCanyon))
      OG.runCommand("(close-specific-task! (game-task firecanyon-assistant) (task-status need-reward-speech))");
    if (playerGameState.currentLevel === Level.lavaTube && playerGameState.onZoomer && this.restrictedZoomerLevels.includes(Level.lavaTube))
      OG.runCommand("(close-specific-task! (game-task lavatube-start) (task-status need-reward-speech))");
  }



  checkTaskUpdateSpecialCases(task: GameTask, run: Run, checkWarpgates: boolean) {

    switch (task.name) {
      //handle klaww kill
      case "ogre-boss":
        if (task.status === TaskStatus.needReminder) {
          this.killKlawwOnSpot = true;
          this.checkKillKlaww();
      }
        break;
      //handle citadel elevator cell cases
      case "citadel-sage-green": 
      if (task.status === TaskStatus.needResolution) {
        this.checkCitadelSkip(run);
        this.checkCitadelElevator();
    }
        break;
        
      case "plunger-lurker-hit":
        //!TODO: softlocks sometimes
        /*
        OG.runCommand("(close-specific-task! (game-task plunger-lurker-hit) (task-status need-hint))");
        OG.runCommand('(process-entity-status! (process-by-ename "plunger-lurker-3")(entity-perm-status complete) #t)');
        OG.runCommand('(cleanup-for-death (the-as (process-by-ename "plunger-lurker-3")))');
        OG.runCommand('(deactivate (process-by-ename "plunger-lurker-3"))');
        */
        break;
      
      //handle hub warp gates
      case "village2-levitator":
        if (checkWarpgates && (task.status !== TaskStatus.needReminderA || this.gameState.currentLevel !== "village1")) break;
        OG.runCommand("(reset-actors 'life)");
        OG.runCommand("(safe-release-from-grab)");
        break;
      case "village3-button":
        if (checkWarpgates && (task.status !== TaskStatus.needIntroduction || (this.gameState.currentLevel !== "village1" && this.gameState.currentLevel !== "village2"))) break;
        OG.runCommand("(reset-actors 'life)");
        OG.runCommand("(safe-release-from-grab)");
        break;
      case "village4-button":
        if (checkWarpgates && (task.status !== TaskStatus.needRewardSpeech || (this.gameState.currentLevel !== "village1" && this.gameState.currentLevel !== "village2" && this.gameState.currentLevel !== "village3"))) break;
        OG.runCommand("(reset-actors 'life)");
        OG.runCommand("(safe-release-from-grab)");
        break;
      default:
        break;
    }
  }

  checkNoLTS() {
    if (this.gameState.currentLevel === Level.lavaTube && this.gameState.onZoomer && this.gameState.cellCount < 72)
      OG.runCommand("(start 'play (get-continue-by-name *game-info* \"lavatube-start\"))");
  }

  checkCitadelSkip(run: Run) {
    if (run.data.citadelSkip === CitadelOption.Patched)
      this.handleNoCitadelSkip(run);
    else if (run.data.citadelSkip === CitadelOption.Shared)
      this.handleCitadelSkip(run);
  }

  private handleNoCitadelSkip(run: Run) {
    if (!this.team) return;
    const hasAllCitadelCells: boolean = (!run.isMode(RunMode.Lockout) ? this.team.splits : run.getAllSplits()).filter(x => x.gameTask.startsWith("citadel-sage-")).length === 4;
    if (hasAllCitadelCells) return;

    if (this.gameState.currentCheckpoint === "citadel-elevator") {
      OG.runCommand('(set-continue! *game-info* "citadel-start")');
    }
    if (this.gameState.currentLevel === Level.finalBoss) {
      OG.runCommand('(set-continue! *game-info* "citadel-start")');
      OG.runCommand("(start 'play (get-continue-by-name *game-info* \"citadel-elevator\"))");
    }
  }

  private handleCitadelSkip(run: Run) {
    if (this.hasCitadelSkipAccess && this.gameState.currentCheckpoint === "citadel-start" && (run.isMode(RunMode.Lockout) ? run.runHasSplit("citadel-sage-green") : this.team?.hasSplit("citadel-sage-green"))) {
      OG.runCommand('(set-continue! *game-info* "citadel-elevator")');
      //citadel-start is sometimes given to you twice when entering citadel, this is to give you some time to deathwarp
      setTimeout(() => {
        this.hasCitadelSkipAccess = false;
      }, 10000);
    }
  }

  checkCitadelElevator() {
    if (this.gameState.currentLevel === "citadel") {
      setTimeout(() => { //give level time to load
        OG.runCommand("(send-event (process-by-name \"citb-exit-plat-4\" *active-pool*) 'trigger)");
      }, 300);
    }
  }
}