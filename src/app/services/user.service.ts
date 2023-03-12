import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbar/snackbar.component';
import { User } from '../common/user/user';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {

  user: User = new User();
  private UserCopy: User = new User();
  
  viewSettings: boolean = false;
  trackerConnected: boolean = false;

  private trackerListener: any;
  private settingsListener: any;
  private messageListener: any;
  private errorListener: any;

  constructor(private _snackbar: MatSnackBar, private zone: NgZone) { 
    this.setupReceiver();
    this.readSettings();
    this.checkTrackerConnection();
  }

  public getName() {
    return this.user.displayName;
  }

  public checkWriteUserDataHasChanged() {
    if (!this.user.isEqualToDataCopy(this.UserCopy))
      this.writeSettings();
    
    this.UserCopy = this.user.getBaseCopy();
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
    //tracker update
    this.trackerListener = (window as any).electron.receive("og-tracker-connected", (connected: true) => {
      this.trackerConnected = connected;
      if (connected)
         (window as any).electron.send('og-state-read');
    });
    
    //settings get
    this.settingsListener = (window as any).electron.receive("settings-get", (data: User) => {
      this.user = Object.assign(new User(), data);
      this.UserCopy = data;
    });
    
    //backend messages
    this.messageListener = (window as any).electron.receive("backend-message", (message: string) => {
      console.log(message);
      this.sendNotification(message);
    });

    //backend errors
    this.errorListener = (window as any).electron.receive("backend-error", (message: string) => {
      console.log(message);
      this.sendNotification(message);
    });
  }

  //settings read
  checkTrackerConnection(): void {
    (window as any).electron.send('og-tracker-connected-read');
  }

  //settings write
  writeSettings(): void {
    (window as any).electron.send('settings-write', this.user);
  }

  //settings read
  readSettings(): void {
    (window as any).electron.send('settings-read');
  }

  ngOnDestroy(): void {
    this.trackerListener();
    this.settingsListener();
    this.messageListener();
    this.errorListener();
  }
}
