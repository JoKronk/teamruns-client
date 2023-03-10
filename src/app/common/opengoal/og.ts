export class OG {
  static startGame(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-game');
  }

  static startRun(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-run');
    this.runCommand("(set! *allow-cell-pickup?* #t)");
  }

  static giveCell(taskName: string) {
    this.runCommand("(dm-give-cell (game-task " + taskName + "))");
  }

  static runCommand(command: string): void {
    if (!(window as any).electron) return;
      (window as any).electron.send('og-command', command);
  }
}