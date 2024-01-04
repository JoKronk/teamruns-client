import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OG } from '../common/opengoal/og';
import { InfoComponent } from '../dialogs/info/info.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { SetControllerComponent } from '../dialogs/set-controller/set-controller.component';

@Component({
  selector: 'app-nav-board',
  templateUrl: './nav-board.component.html',
  styleUrls: ['./nav-board.component.scss']
})
export class NavBoardComponent {

  constructor(public _user: UserService, private dialog: MatDialog, private router: Router) {
    
  }

  startGame(port: number | undefined) {
    if (!this._user.user.ogFolderpath)
      this.dialog.open(SetPathComponent);
    else
      OG.startGame(port ?? OG.mainPort);

    this._user.viewSettings = false;
  }

  navigate(path: string) {
    this._user.viewSettings = !this._user.viewSettings;
    this._user.localUsers = [];
    this.router.navigate([path]);
  }

  getObsLink() {
    this._user.copyLink("https://teamrun.web.app/obs?user=" + this._user.getId() + "&height=780&bgColor=4e4e4e&timerBorder=true");
    this._user.viewSettings = false;
    this._user.sendNotification("Obs Link Copied");
  }

  openInfo() {
    this.dialog.open(InfoComponent, {maxWidth: "100vw"});
    this._user.viewSettings = false;
  }

  configControllers() {
    this.dialog.open(SetControllerComponent);
    this._user.viewSettings = false;
  }

  resetWindowSize() {
    if (this._user.isBrowser) return;
    (window as any).electron.send('settings-reset-size');
  }
}
