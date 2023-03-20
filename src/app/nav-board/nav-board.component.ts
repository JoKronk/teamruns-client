import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OG } from '../common/opengoal/og';
import { InfoComponent } from '../dialogs/info/info.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-nav-board',
  templateUrl: './nav-board.component.html',
  styleUrls: ['./nav-board.component.scss']
})
export class NavBoardComponent {

  constructor(public _user: UserService, private dialog: MatDialog) {
    
  }

  startGame() {
    if (!this._user.user.ogFolderpath)
      this.dialog.open(SetPathComponent);
    else
      OG.startGame();

    this._user.viewSettings = false;
  }

  getObsLink() {
    this._user.copyLink(window.location.host + "/obs?user=" + this._user.getName() + "&height=800&bgColor=4e4e4e&timerBorder=true");
    this._user.viewSettings = false;
  }

  openPathConfig() {
    this.dialog.open(SetPathComponent);
    this._user.viewSettings = false;
  }

  openInfo() {
    this.dialog.open(InfoComponent, {maxWidth: "100vw"});
    this._user.viewSettings = false;
  }
}
