import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User, UserBase } from '../common/user/user';
import { Router } from '@angular/router';
import { OG } from '../common/opengoal/og';
import { LocalPlayerData } from '../common/user/local-player-data';
import { RunData } from '../common/run/run-data';
import { SnackbarComponent } from '../snackbars/snackbar/snackbar.component';
import { SnackbarInstallComponent } from '../snackbars/snackbar-install/snackbar-install.component';
import { SnackbarImportComponent } from '../snackbars/snackbar-import/snackbar-import.component';
import { DownloadHandler } from '../common/user/download-handler';
import { BehaviorSubject } from 'rxjs';
import { Run } from '../common/run/run';
import pkg from 'app/package.json';
import { DbUserProfile } from '../common/firestore/db-user-profile';
import { ConnectionHandler } from '../common/peer/connection-handler';

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
  clientInMaintanceMode: boolean = false;
  downloadHandler: DownloadHandler = new DownloadHandler();

  private launchListener: any;
  private shutdownListener: any;
  private trackerListener: any;
  private settingsListener: any;
  private messageListener: any;
  private errorListener: any;

  userSetupSubject: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  

  constructor(private _snackbar: MatSnackBar, private zone: NgZone, private router: Router) { 
    this.isBrowser = !(window as any).electron;
    this.setupReceiver();
    this.readSettings();
  }

  public getMainUserId() {
    return this.user.id;
  }

  public startGame(user: User, connenctionHandler: ConnectionHandler | undefined, run: Run | undefined): LocalPlayerData | undefined {
    if (!(window as any).electron || this.isBrowser || this.downloadHandler.isDownloading) return undefined;

    let localUser = this.localUsers.find(x => x.user.id === user.id);
    const isMainUser: boolean = user.id === this.user.id;
    const port = isMainUser ? OG.mainPort : localUser ? localUser.socketHandler.socketPort : (OG.mainPort - this.localUsers.length);

    user.isLaunching = true;
    (window as any).electron.send('og-start-game', port);
    
    if (!localUser) {
      if (!user.controllerPort)
        user.controllerPort = this.localUsers.length;
      localUser = new LocalPlayerData(user, port, connenctionHandler ?? new ConnectionHandler(this.localUsers, this.user, false), run ?? new Run(RunData.getFreeroamSettings(pkg.version)), this.zone);
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

  public resetLocalPlayersToNewMain(newMain: LocalPlayerData) {
    this.localUsers.forEach(user => {
      user.onDestroy();
    });
    this.localUsers = [ newMain ];
  }

  public routeTo(link: string) {
    this.router.navigate([link]);
  }

  public userHasChanged(checkBaseOnly: boolean = false): boolean {
    return checkBaseOnly ? this.user.isEqualToDataCopyBase(this.UserCopy) : !this.user.isEqualToDataCopy(this.UserCopy);
  }

  public writeUserDataChangesToLocal() {
    this.writeSettings();
    this.UserCopy = this.user.getCopy();
  }

  public drawProgressBar() {
    if (this.isBrowser || this.downloadHandler.isDownloading) return;

    this.downloadHandler.isDownloading = true; //blocks other snackbars while installing as only one can be open at a time
    this.zone.run(() => {
      this._snackbar.openFromComponent(SnackbarInstallComponent, {
        verticalPosition: 'bottom',
        horizontalPosition: 'center'
      }).afterDismissed().subscribe(() => {
        this.downloadHandler.isDownloading = false;
      });
    });
  }

  public drawImportNotif() {
    if (this.isBrowser || this.downloadHandler.isDownloading) return;

    this.zone.run(() => {
      this._snackbar.openFromComponent(SnackbarImportComponent, {
        verticalPosition: 'bottom',
        horizontalPosition: 'right'
      });
    });
  }

  public sendNotification(message: string, notifDurationMs: number = 5000) {
    if (this.isBrowser || this.downloadHandler.isDownloading) return;

    this.zone.run(() => {
      this._snackbar.openFromComponent(SnackbarComponent, {
        duration: notifDurationMs,
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

  logout() {
    if (!this.user.hasSignedIn)
      return;
      
    this.user.importDbUser(new DbUserProfile(new UserBase(crypto.randomUUID(), "")), this.user.displayName);
    this.user.hasSignedIn = false;
    this.writeUserDataChangesToLocal();
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
      this.userSetupSubject.next(this.user);
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
