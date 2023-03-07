import { Component, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateRunComponent } from '../dialogs/create-run/create-run.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { Run } from '../common/run/run';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { Lobby } from '../common/firestore/lobby';
import { RunMode } from '../common/run/run-mode';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent implements OnDestroy {

  runMode = RunMode;

  buildVersion: string = pkg.version;
  showPlayers: boolean = true;
  avaliableLobbies: Lobby[] = [];
  unavaliableLobbies: Lobby[] = [];
  lobbiesSubscription: Subscription;

  constructor(public _user: UserService, private _firestore: FireStoreService, private router: Router, private dialog: MatDialog) {
    //Check if path is set
    setTimeout(() => {
      if (!_user.user.ogFolderpath)
        this.dialog.open(SetPathComponent);
    }, 300);

    this.lobbiesSubscription = this._firestore.getOpenLobbies().subscribe((lobbies) => {
      const version = this.buildVersion.slice(0, -2);
      this.avaliableLobbies = lobbies.filter(x => x.runData.buildVersion.slice(0, -2) === version).sort((x, y) => new Date(y.creationDate).valueOf() - new Date(x.creationDate).valueOf());
      this.unavaliableLobbies = lobbies.filter(x => x.runData.buildVersion.slice(0, -2) !== version).sort((x, y) => new Date(y.creationDate).valueOf() - new Date(x.creationDate).valueOf());
    });
  }

  startGame() {
    if (!this._user.user.ogFolderpath)
      this.dialog.open(SetPathComponent);
    else
      this._user._goal.startGame();
  }

  routeToRun(runId: string) {
    this.router.navigate(['/run' ], { queryParams: { id: runId } });
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

  ngOnDestroy() {
    this.lobbiesSubscription.unsubscribe();
  }

}
