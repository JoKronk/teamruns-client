import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GoalService {

  constructor() { 
    
  }

  startGame(): void {
    (window as any).electron.send('og-start-game');
  }

  startRun(): void {
    (window as any).electron.send('og-start-run');
  }

  runCommand(command: string): void {
    (window as any).electron.send('og-command', command);
  }
  
}
