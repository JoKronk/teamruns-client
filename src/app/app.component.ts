import { Component, HostListener, NgZone } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { invoke } from "@tauri-apps/api/core";
import { UserService } from './services/user.service';
import pkg from '@root/package.json';
import { Subscription } from 'rxjs';
import {MatSidenavModule} from '@angular/material/sidenav';
import { NavBoardComponent } from './window-components/nav-board/nav-board.component';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listDownloadedVersions, updateCheckLauncher } from './rpc/versions';

const appWindow = getCurrentWindow();

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet, MatSidenavModule, NavBoardComponent]
})
export class AppComponent {
  title = 'Teamruns';

  buildVersion: string = pkg.version;
  
  private userSubscription: Subscription;
  private updateListener: any;
  private installMissingListener: any;
  private installOutdatedListener: any;
  toolingUpdateAvailable: boolean = false;
  launcherUpdateAvailable: boolean = false;

  constructor(public _user: UserService, private router: Router, private zone: NgZone) {
    this.setupUserListener();
  }

  checkForUpdate(): void {
    updateCheckLauncher().then((result) => {
      console.log(result);

      //update-available
      this.zone.run(() => {
        if (!this._user.isDownloading)
          this.launcherUpdateAvailable = true;
      });

    });
    
    listDownloadedVersions().then((result) => {
      console.log(result);

      //install-missing
      this.zone.run(() => {
        if (!this._user.isDownloading)
          this.toolingUpdateAvailable = true;
      });

      //install-outdated
      this.zone.run(() => {
        if (!this._user.isDownloading)
          this.toolingUpdateAvailable = true;
      });
    });
  }


  setupUserListener() {
    this.userSubscription = this._user.userSetupSubject.subscribe(localUser => {
      if (!this._user.updateChecked) {
        this._user.updateChecked = true;
        this.checkForUpdate();
      }

    });
  }

  minimize() {
    appWindow.minimize();
  }

  close() {
    appWindow.close();
  }

  goToUpdate(tab: number) {
      this.router.navigate(['/install'], { queryParams: { tab: tab } });
  }

  ngOnDestroy(): void {
    if (this.userSubscription) this.userSubscription.unsubscribe();
    if (this.updateListener) this.updateListener();
    if (this.installMissingListener) this.installMissingListener();
    if (this.installOutdatedListener) this.installOutdatedListener();
  }
  
  /*
  @HostListener('window:keydown.control.shift.b', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    event.preventDefault();
    (window as any).electron.send('settings-reset-size');
  }
  */
}
