import { Component, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';
import { FireStoreService } from '../services/fire-store.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { Lobby } from '../common/firestore/lobby';
import { RunMode } from '../common/run/run-mode';
import { InputDialogComponent } from '../dialogs/input-dialog/input-dialog.component';
import { ConfirmComponent } from '../dialogs/confirm/confirm.component';
import { MatTableDataSource } from '@angular/material/table';
import { Category } from '../common/run/category';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent implements OnDestroy {

  runMode = RunMode;
  categoryOptions: Category[] = Category.GetGategories();

  buildVersion: string = pkg.version;
  avaliableLobbies: Lobby[] = [];
  unavailableLobbies: Lobby[] = [];
  loaded: boolean = false;
  inMaintance: boolean;

  selectedLobby: Lobby | null = null;
  hideViewer: boolean = true;
  
  dataSource: MatTableDataSource<Lobby> = new MatTableDataSource();
  dataSourceUnavailable: MatTableDataSource<Lobby> = new MatTableDataSource();
  columns: string[] = ["name", "mode", "category", "teams", "players"];

  lobbiesSubscription: Subscription;
  userSubscription: Subscription;

  constructor(public _user: UserService, private _firestore: FireStoreService, private router: Router, private dialog: MatDialog) {
    
    this.lobbiesSubscription = this._firestore.getOpenLobbies().subscribe((lobbies) => {
      const expireDate = new Date();
      expireDate.setHours(expireDate.getHours() - 4);
      //remove old lobbies
      lobbies.filter(x => new Date(x.creationDate) < expireDate).forEach(lobby => {
        _firestore.deleteLobby(lobby.id);
      });
      
      lobbies = lobbies.filter(x => new Date(x.creationDate) >= expireDate);
      
      //(The question marks in user for filtering here is only for backwards compability)
      lobbies.filter(x => x.users.some(user => user?.user?.id === _user.user.id) || x.host?.user?.id === _user.user.id).forEach(lobby => {
        lobby = Object.assign(new Lobby(lobby.runData, lobby.creatorId, lobby.password, lobby.id), lobby);
        if (lobby.host?.user.id === _user.user.id)
          lobby.host = null;
        
        lobby.removeUser(_user.user.id);
        _firestore.updateLobby(lobby);
      });

      const version = this.buildVersion.slice(0, -2);
      this.avaliableLobbies = lobbies.filter(x => x.available).sort((x, y) => new Date(y.creationDate).valueOf() - new Date(x.creationDate).valueOf());
      this.dataSource = new MatTableDataSource(this.avaliableLobbies);
      this.unavailableLobbies = lobbies.filter(x => !x.available).sort((x, y) => new Date(y.creationDate).valueOf() - new Date(x.creationDate).valueOf());
      this.dataSourceUnavailable = new MatTableDataSource(this.unavailableLobbies);
      this.selectedLobby = this.avaliableLobbies[0];
      this.loaded = true;
      this._user.clientInMaintenanceMode = false;
    }, error => {
      if (error.message === "Missing or insufficient permissions.")
        this._user.clientInMaintenanceMode = true;
    });

    
    this.userSubscription = this._user.userSetupSubject.subscribe(user => {
      if (!user) return;

      //this should technically be ran on user setup subject
      if (_user.user.saveRecordingsLocally === undefined) {
        const dialogSubscription = this.dialog.open(ConfirmComponent, { data: { message: "Do you want to save recordings of runs locally?", yesNo: true } }).afterClosed().subscribe(confirmed => {
          dialogSubscription.unsubscribe();
          this._user.user.saveRecordingsLocally = confirmed === undefined ? false : confirmed;
          _user.writeSettings();
        });
      }
    });
  }

  routeToRun(lobby: Lobby) {
    if (lobby.password) {
      const dialogRef = this.dialog.open(InputDialogComponent, { data: { passwordCheck: true, password: lobby.password, precursorTitle: "Password", title: "Lobby password:", confirmText: "Join" } });
      const dialogSubscription = dialogRef.afterClosed().subscribe((successful: boolean | null) => {
        dialogSubscription.unsubscribe();
        if (successful === undefined)
          return;
        if (!successful)
          this._user.sendNotification("Wrong password!");
        if (successful)
        this.router.navigate(lobby.runData.mode !== this.runMode.Casual ? ['/run'] : ['/run-casual'], { queryParams: { id: lobby.id } });
      });
    }
    else
      this.router.navigate(lobby.runData.mode !== this.runMode.Casual ? ['/run'] : ['/run-casual'], { queryParams: { id: lobby.id } });
  }
  


  selectLobby(lobby: Lobby) {
    this.selectedLobby = lobby;
    this.hideViewer = false;
  }

  hideLobbyViewer() {
    this.hideViewer = true;
  }

  toggleSetting(): void {
    this._user.viewSettings = !this._user.viewSettings;
  }

  deleteLobby(event: Event, lobby: Lobby) {
    event.stopPropagation();
    const dialogSubscription = this.dialog.open(ConfirmComponent, { data: { message: "Delete " + lobby.runData.name + "?" } }).afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed)
        this._firestore.deleteLobby(lobby.id);
    });
  }

  ngOnDestroy() {
    this.lobbiesSubscription.unsubscribe();
    this.userSubscription.unsubscribe();
  }

}
