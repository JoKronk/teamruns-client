import { Component, HostListener, NgZone } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UserService } from './services/user.service';
import pkg from '@root/package.json';
import { Subscription } from 'rxjs';
import {MatSidenavModule} from '@angular/material/sidenav';
import { NavBoardComponent } from './window-components/nav-board/nav-board.component';

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

  setupUpdateListener() {
    this.updateListener = (window as any).electron.receive("update-available", () => {
      this.zone.run(() => {
        if (!this._user.isDownloading)
          this.launcherUpdateAvailable = true;
      });
    });
  }

  setupInstallListeners() {
    this.installMissingListener = (window as any).electron.receive("install-missing", () => {
      this.zone.run(() => {
        if (!this._user.isDownloading)
          this.toolingUpdateAvailable = true;
      });
    });

    this.installOutdatedListener = (window as any).electron.receive("install-outdated", () => {
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
          this.setupUpdateListener();
        this.setupInstallListeners();
        this._user.checkForUpdate();
      }

    });
  }

  minimize() {
    (window as any).electron.send('window-minimize');
  }

  close() {
    this.router.navigate(['/close']);
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
