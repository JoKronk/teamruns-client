import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { OG } from '../common/opengoal/og';
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
    OG.startGame();
  }

  getObsLink() {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = window.location.host + "/obs?user=" + this._user.getName() + "&height=800&bgColor=4e4e4e&timerBorder=true";
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);

    this._user.sendNotification("Link Copied!");
  }

  openPathConfig() {
    this.dialog.open(SetPathComponent);
  }
}
