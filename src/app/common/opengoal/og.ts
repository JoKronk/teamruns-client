
export class OG {
  static startGame(port: number): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-game', port);
  }

  static runCommand(command: string): void {
    if (!(window as any).electron) return;
      (window as any).electron.send('og-command', command);
  }
}