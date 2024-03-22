import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SnackbarComponent } from '../snackbars/snackbar/snackbar.component';
import { User } from '../common/user/user';
import { Router } from '@angular/router';
import { OG } from '../common/opengoal/og';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunData } from '../common/run/run-data';
import { Timer } from '../common/run/timer';
import { SnackbarInstallComponent } from '../snackbars/snackbar-install/snackbar-install.component';
import { DownloadHandler } from '../common/user/download-handler';

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {

  user: User = new User();
  private UserCopy: User = new User();
  localUsers: LocalPlayerData[] = [];
  
  viewSettings: boolean = false;
  offlineSettings: RunData | undefined;

  isBrowser: boolean;
  downloadHandler: DownloadHandler = new DownloadHandler();

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

  public startGame(user: User, timer: Timer | undefined = undefined): LocalPlayerData | undefined {
    if (!(window as any).electron || this.isBrowser || this.downloadHandler.isDownloading) return undefined;

    let localUser = this.localUsers.find(x => x.user.id === user.id);
    const isMainUser: boolean = user.id === this.user.id;
    const port = isMainUser ? OG.mainPort : localUser ? localUser.socketHandler.socketPort : (OG.mainPort - this.localUsers.length);
    
    (window as any).electron.send('og-start-game', port);
    
    if (!localUser) {
      if (!user.controllerPort)
        user.controllerPort = this.localUsers.length;
      localUser = new LocalPlayerData(user, port, this.zone, timer);
      this.localUsers.push(localUser);
    }

    return localUser;
  }

  public removeLocalPlayer(id: string): boolean {
    let localUser = this.localUsers.find(x => x.user.id === id);
    if (!localUser) return false;
    localUser.onDestroy();
    this.localUsers = this.localUsers.filter(localPlayer => localPlayer.user.id !== localUser?.user.id);
    return true;
  }

  public removeAllExtraLocals() {
    this.localUsers.filter(x => x.user.id !== this.user.id).forEach(user => {
      user.onDestroy();
    });
    this.localUsers = this.localUsers.filter(x => x.user.id === this.user.id);
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

  public drawProgressBar() {
    if (this.isBrowser || this.downloadHandler.isDownloading) return;

    this.downloadHandler.isDownloading = true; //blocks other snackbars while installing as only one can be open at a time
    this.zone.run(() => {
      const snackSubcription = this._snackbar.openFromComponent(SnackbarInstallComponent, {
        verticalPosition: 'bottom',
        horizontalPosition: 'center'
      }).afterDismissed().subscribe(() => {
        this.downloadHandler.isDownloading = false;
      });
    });
  }

  public sendNotification(message: string, notifDuration: number = 5000) {
    if (this.isBrowser || this.downloadHandler.isDownloading) return;

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
    });

    //game kill
    this.shutdownListener = (window as any).electron.receive("og-closed", (port: number) => {
      let isMainPort: boolean = port === OG.mainPort;

      if (isMainPort)
        this.user.gameLaunched = false;
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

  ngOnDestroy(): void {
    this.launchListener();
    this.shutdownListener();
    this.trackerListener();
    this.settingsListener();
    this.messageListener();
    this.errorListener();
    this.downloadHandler.onDestory();
  }
}
