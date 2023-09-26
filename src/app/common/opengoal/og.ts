import { WebSocketSubject } from "rxjs/webSocket";
import { CurrentPositionData } from "../playback/position-data";
import { GameTask } from "./game-task";
import { Task } from "./task";

export class OG {
  static startGame(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-game');
  }

  static startRun(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-run');
  }

  static updateTask(task: GameTask) {
    this.runCommand("(close-specific-task! (game-task " + task.name + ") (task-status " + task.status + "))");
    
    if (Task.isCellCollect(task)) {
      let openFuelCell = Task.getCellEname(task.name);
      if (openFuelCell)
      this.runCommand('(+! (-> (the fuel-cell (process-by-ename "' + openFuelCell + '")) base y) (meters -200.0))');
    }
  }

  static giveFinalBossAccess(currentLevel: string) {
    this.runCommand('(set! *allow-final-boss?* #t)');
    if (currentLevel === "finalboss")
        this.runCommand('(set! (-> (the-as plat-eco-finalboss (process-by-ename "plat-eco-finalboss-1")) speed) 0.1)');
  }

  static removeFinalBossAccess(currentLevel: string) {
    this.runCommand('(set! *allow-final-boss?* #f)');
    if (currentLevel === "finalboss") {
        this.runCommand('(set-continue! *game-info* "finalboss-start")');
        this.runCommand('(set! (-> (the-as plat-eco-finalboss (process-by-ename "plat-eco-finalboss-1")) speed) 0.0)');
    }
  }

  static runCommand(command: string): void {
    if (!(window as any).electron) return;
      (window as any).electron.send('og-command', command);
  }
}