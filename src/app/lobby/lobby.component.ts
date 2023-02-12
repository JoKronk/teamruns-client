import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateRunComponent } from '../dialogs/create-run/create-run.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent {

  showPlayers: boolean = true;

  constructor(public _user: UserService, private dialog: MatDialog) {
    setTimeout(() => {
      if (!_user.user.ogFolderpath)
        this.dialog.open(SetPathComponent);
    }, 500)
  }

  startGame() {
    if (!this._user.user.ogFolderpath)
      this.dialog.open(SetPathComponent);
    else {
      console.log("has path: " + this._user.user.ogFolderpath);
      this._user._goal.startGame();
    }
  }

  createLobby(): void {
    const dialogRef = this.dialog.open(CreateRunComponent);

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }

  toggleSetting(): void {
    this._user.viewSettings = !this._user.viewSettings;
  }

}
