import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Player } from '../common/player/player';
import { SnackbarComponent } from '../snackbar/snackbar.component';
import { GoalService } from './goal.service';
import { PlayerData } from '../common/player/player-data';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  player: Player = new Player();
  private playerDataCopy: PlayerData = new PlayerData();
  
  viewSettings: boolean = false;

  constructor(public _goal: GoalService, private _snackbar: MatSnackBar) { 
    this.setupReceiver();
    this.readSettings();
  }

  public checkWritePlayerDataHasChanged() {
    if (!this.player.isEqualToDataCopy(this.playerDataCopy))
      this.writeSettings();
    
      this.playerDataCopy = this.player.getBaseCopy();
  }

  public updatePlayerData(data: PlayerData) {
    this.player.setBase(data);
    this.writeSettings();
  }

  public sendNotiication(message: string) {
    this._snackbar.openFromComponent(SnackbarComponent, {
      duration: 5000,
      data: message,
      verticalPosition: 'bottom',
      horizontalPosition: 'right'
    });
  }

  private setupReceiver(): void {
    
    //settings get
    (window as any).electron.receive("settings-get", (data: PlayerData) => {
      this.player.setBase(data);
      this.playerDataCopy = data;
    });
    
    //backend messages
    (window as any).electron.receive("backend-message", (message: string) => {
      console.log(message);
      this.sendNotiication(message);
    });

    //backend errors
    (window as any).electron.receive("backend-error", (message: string) => {
      console.log(message);
      this.sendNotiication(message);
    });
  }

  //does nothing atm, should probably be moved
  closeAll(): void {
    (window as any).electron.send('window-close');
  }

  //settings write
  writeSettings(): void {
    (window as any).electron.send('settings-write', this.player.getBase());
  }

  //settings read
  readSettings(): void {
    (window as any).electron.send('settings-read');
  }
}
