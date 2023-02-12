import { Injectable, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbar/snackbar.component';
import { GoalService } from './goal.service';
import { User } from '../common/player/user';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  user: User = new User();
  private UserCopy: User = new User();
  
  viewSettings: boolean = false;

  constructor(public _goal: GoalService, private _snackbar: MatSnackBar, private zone: NgZone) { 
    this.setupReceiver();
    this.readSettings();
  }

  public getName() {
    return this.user.displayName;
  }

  public checkWriteUserDataHasChanged() {
    if (!this.user.isEqualToDataCopy(this.UserCopy))
      this.writeSettings();
    
      this.UserCopy = this.user.getBaseCopy();
  }

  public updateUser(data: User) {
    this.user.setBase(data);
    this.writeSettings();
  }

  public sendNotification(message: string) {
    this.zone.run(() => {
      this._snackbar.openFromComponent(SnackbarComponent, {
        duration: 5000,
        data: message,
        verticalPosition: 'bottom',
        horizontalPosition: 'right'
      });
    });
  }

  private setupReceiver(): void {
    
    //settings get
    (window as any).electron.receive("settings-get", (data: User) => {
      this.user.setBase(data);
      this.UserCopy = data;
    });
    
    //backend messages
    (window as any).electron.receive("backend-message", (message: string) => {
      console.log(message);
      this.sendNotification(message);
    });

    //backend errors
    (window as any).electron.receive("backend-error", (message: string) => {
      console.log(message);
      this.sendNotification(message);
    });
  }

  //does nothing atm, should probably be moved
  closeAll(): void {
    (window as any).electron.send('window-close');
  }

  //settings write
  writeSettings(): void {
    (window as any).electron.send('settings-write', this.user);
  }

  //settings read
  readSettings(): void {
    (window as any).electron.send('settings-read');
  }
}
