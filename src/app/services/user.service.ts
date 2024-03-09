import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbar/snackbar.component';
import { User } from '../common/user/user';
import { Router } from '@angular/router';
import { OG } from '../common/opengoal/og';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunData } from '../common/run/run-data';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {

  user: User = new User();
  private UserCopy: User = new User();
  localUsers: LocalPlayerData[] = [];
  
  viewSettings: boolean = false;
  offlineSettings: RunData | undefined;
  private secondaryPortsInUse: number[] = [];

  isBrowser: boolean;

  private launchListener: any;
  private shutdownListener: any;
  private trackerListener: any;
  private settingsListener: any;
  private messageListener: any;
  private errorListener: any;

  constructor(private _snackbar: MatSnackBar, private zone: NgZone, private router: Router) { 
    this.isBrowser = !(window as any).electron;
    this.setupReceiver();
    this.readSettings();
  }

  public getId() {
    return this.user.id;
  }

  public launchNewLocalPlayer(): number {
    let port = (this.secondaryPortsInUse.length === 0 ? OG.mainPort : this.secondaryPortsInUse[this.secondaryPortsInUse.length - 1]) - 1;
    OG.startGame(port);
    return port;
  }

  public destoryAllExtraLocals() {
    this.secondaryPortsInUse = [];
    this.localUsers.forEach(user => {
      user.onDestroy();
    });
    this.localUsers = [];
  }

  public getLastNewLocalPlayerDefaultController(): number {
    return this.secondaryPortsInUse.length + 1;
  }

  public routeTo(link: string) {
    this.router.navigate([link]);
  }

  public userHasChanged(): boolean {
    return !this.user.isEqualToDataCopy(this.UserCopy);
  }

  public writeUserDataChangeToLocal() {
    this.writeSettings();
    this.UserCopy = this.user.getCopy();
  }

  public sendNotification(message: string, notifDuration: number = 5000) {
    if (this.isBrowser) return;

    this.zone.run(() => {
      this._snackbar.openFromComponent(SnackbarComponent, {
        duration: notifDuration,
        data: message,
        verticalPosition: 'bottom',
        horizontalPosition: 'right'
      });
    });
  }

  public copyLink(link: string) {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = link;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);

    this.sendNotification("Link Copied!");
  }

  private setupReceiver(): void {
    if (this.isBrowser) return;

    //game launch
    this.launchListener = (window as any).electron.receive("og-launched", (port: number) => {
      let isMainPort: boolean = port === OG.mainPort;

      if (isMainPort)
        this.user.gameLaunched = true;
      else
        this.secondaryPortsInUse.push(port);
    });

    //game kill
    this.shutdownListener = (window as any).electron.receive("og-closed", (port: number) => {
      let isMainPort: boolean = port === OG.mainPort;

      if (isMainPort)
        this.user.gameLaunched = false;
      else
        this.secondaryPortsInUse = this.secondaryPortsInUse.filter(x => x !== port);
    });
    
    //settings get
    this.settingsListener = (window as any).electron.receive("settings-get", (data: User) => {
      this.user.importUserCopy(data);
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

  //settings write
  writeSettings(): void {
    if (this.isBrowser) return;
    (window as any).electron.send('settings-write', this.user);
  }

  //settings read
  readSettings(): void {
    if (this.isBrowser) return;
    (window as any).electron.send('settings-read');
  }

  //check for new update
  checkForUpdate(): void {
    if (this.isBrowser) return;
    (window as any).electron.send('update-check');
  }

  //install new update
  installUpdate(): void {
    if (this.isBrowser) return;
    (window as any).electron.send('update-install');
  }

  ngOnDestroy(): void {
    this.launchListener();
    this.shutdownListener();
    this.trackerListener();
    this.settingsListener();
    this.messageListener();
    this.errorListener();
  }
}
