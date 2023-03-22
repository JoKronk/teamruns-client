import { Component, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CreateRunComponent } from '../dialogs/create-run/create-run.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { Lobby } from '../common/firestore/lobby';
import { RunMode } from '../common/run/run-mode';
import { InfoComponent } from '../dialogs/info/info.component';
import { GivePasswordComponent } from '../dialogs/give-password/give-password.component';

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

  selectedLobby: Lobby | null = null;
  hideViewer: boolean = true;

  lobbiesSubscription: Subscription;

  constructor(public _user: UserService, private _firestore: FireStoreService, private router: Router, private dialog: MatDialog) {
    //Check if path is set
    setTimeout(() => {
      if (!_user.user.ogFolderpath)
        this.dialog.open(SetPathComponent);
    }, 300);

    this.lobbiesSubscription = this._firestore.getOpenLobbies().subscribe((lobbies) => {
      const expireDate = new Date();
      expireDate.setHours(expireDate.getHours() - 4);
      //remove old lobbies
      lobbies.filter(x => new Date(x.creationDate) < expireDate).forEach(lobby => {
        _firestore.deleteLobby(lobby.id);
      });
      
      lobbies = lobbies.filter(x => new Date(x.creationDate) >= expireDate);
      const version = this.buildVersion.slice(0, -2);
      this.avaliableLobbies = lobbies.filter(x => x.runData.buildVersion.slice(0, -2) === version).sort((x, y) => new Date(y.creationDate).valueOf() - new Date(x.creationDate).valueOf());
      this.unavaliableLobbies = lobbies.filter(x => x.runData.buildVersion.slice(0, -2) !== version).sort((x, y) => new Date(y.creationDate).valueOf() - new Date(x.creationDate).valueOf());
      this.selectedLobby = this.avaliableLobbies[0];
    });
  }

  openInfo() {
    this.dialog.open(InfoComponent, {maxWidth: "100vw"});
  }

  routeToRun(lobby: Lobby) {
    if (lobby.password) {
      const dialogRef = this.dialog.open(GivePasswordComponent, { data: lobby.password });
      const dialogSubscription = dialogRef.afterClosed().subscribe((successful: boolean | null) => {
        console.log(successful);
        dialogSubscription.unsubscribe();
        if (successful === undefined)
          return;
        if (!successful)
          this._user.sendNotification("Wrong password!");
        if (successful)
        this.router.navigate(['/run' ], { queryParams: { id: lobby.id } });
      });
    }
    else
      this.router.navigate(['/run' ], { queryParams: { id: lobby.id } });
  }
  


  selectLobby(lobby: Lobby) {
    this.selectedLobby = lobby;
    this.hideViewer = false;
  }

  hideLobbyViewer() {
    this.hideViewer = true;
  }

  createLobby(): void {
    this.dialog.open(CreateRunComponent);
  }

  toggleSetting(): void {
    this._user.viewSettings = !this._user.viewSettings;
  }

  ngOnDestroy() {
    this.lobbiesSubscription.unsubscribe();
  }

}
