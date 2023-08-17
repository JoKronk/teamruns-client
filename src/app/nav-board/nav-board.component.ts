import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OG } from '../common/opengoal/og';
import { InfoComponent } from '../dialogs/info/info.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-nav-board',
  templateUrl: './nav-board.component.html',
  styleUrls: ['./nav-board.component.scss']
})
export class NavBoardComponent {

  constructor(public _user: UserService, private dialog: MatDialog, private router: Router) {
    
  }

  startGame() {
    if (!this._user.user.ogFolderpath)
      this.dialog.open(SetPathComponent);
    else
      OG.startGame();

    this._user.viewSettings = false;
  }

  getObsLink() {
    this._user.copyLink("https://teamrun.web.app/obs?user=" + this._user.getId() + "&height=800&bgColor=4e4e4e&timerBorder=true");
    this._user.viewSettings = false;
  }

  navHistory() {
    this.router.navigate(['/history' ]);
  }

  openPathConfig() {
    this.dialog.open(SetPathComponent);
    this._user.viewSettings = false;
  }

  openInfo() {
    this.dialog.open(InfoComponent, {maxWidth: "100vw"});
    this._user.viewSettings = false;
  }

  resetWindowSize() {
    if (this._user.isBrowser) return;
    (window as any).electron.send('settings-reset-size');
  }
}
