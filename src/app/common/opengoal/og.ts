
export class OG {
  static startGame(): void {
    if (!(window as any).electron) return;
    (window as any).electron.send('og-start-game');
  }

  static runCommand(command: string): void {
    if (!(window as any).electron) return;
      (window as any).electron.send('og-command', command);
  }
}