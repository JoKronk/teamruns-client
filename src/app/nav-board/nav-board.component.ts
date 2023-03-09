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

  openPathConfig() {
    this.dialog.open(SetPathComponent);
  }
}
