import { CurrentPositionData } from "../playback/position-data";

export class OG {
  static startGame(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-game');
  }

  static startRun(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-run');
  }

  static giveCell(taskName: string) {
    this.runCommand("(dm-give-cell (game-task " + taskName + "))");
  }

  static updatePlayerPositions(players: CurrentPositionData[]) {
    players.forEach(target => {
      if (target.transX)
        this.runCommand("(manual-position-update " + target.playerId + " " + target.transX.toFixed(4) + " " + target.transY.toFixed(4) + " " + target.transZ.toFixed(4) + " " + target.quatY.toFixed(4) + " " + target.quatZ.toFixed(4) + " " + target.quatW.toFixed(4) + " \"" + target.tgtState + "\")");
    });
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