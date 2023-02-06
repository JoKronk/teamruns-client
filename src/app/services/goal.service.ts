import { Injectable } from '@angular/core';
import { IpcMain } from 'electron';

@Injectable({
  providedIn: 'root'
})
export class GoalService {

  constructor() { 

  }
  closeAll(): void {
    (window as any).electron.send('window-close');
  }

  startGame(): void {
    (window as any).electron.send('og-start-game');
  }

  startRun(): void {
    (window as any).electron.send('og-start-run');
  }

  runCommand(command: string): void {
    (window as any).electron.send('og-start-game', command);
  }
  
}
