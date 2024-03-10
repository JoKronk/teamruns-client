
export class OG {
  
  static mainPort: number = 8111;

  static runCommand(command: string): void {
    if (!(window as any).electron) return;
      (window as any).electron.send('og-command', command);
  }
}