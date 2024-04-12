import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { InfoComponent } from '../../dialogs/info/info.component';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import { SetControllerComponent } from '../../dialogs/set-controller/set-controller.component';
import { User } from '../../common/user/user';

@Component({
  selector: 'app-nav-board',
  templateUrl: './nav-board.component.html',
  styleUrls: ['./nav-board.component.scss']
})
export class NavBoardComponent {

  constructor(public _user: UserService, private dialog: MatDialog, private router: Router) {
    
  }

  startGame(user: User | undefined) {
    if (this._user.downloadHandler.isDownloading) return;
    
    this._user.startGame(user ?? this._user.user, undefined);
    this._user.viewSettings = false;
  }

  navigate(path: string) {
    this._user.viewSettings = !this._user.viewSettings;
    this.router.navigate([path]);
  }

  getObsLink() {
    this._user.copyLink("https://teamrun.web.app/obs?user=" + this._user.getMainUserId() + "&height=780&bgColor=4e4e4e&timerBorder=true");
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
