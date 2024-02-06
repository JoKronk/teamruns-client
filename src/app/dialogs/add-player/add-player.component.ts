import { Component, Inject, NgZone } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OG } from 'src/app/common/opengoal/og';
import { Timer } from 'src/app/common/run/timer';
import { LocalPlayerData } from 'src/app/common/user/local-player-data';
import { User } from 'src/app/common/user/user';
import { FireStoreService } from 'src/app/services/fire-store.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-add-player',
  templateUrl: './add-player.component.html',
  styleUrls: ['./add-player.component.scss']
})
export class AddPlayerComponent {

  phase: number = 0;
  controller: number = 0;
  port: number = 0;

  username: string;
  pw: string;
  
  user: User = new User();
  localPlayer: LocalPlayerData | undefined = undefined;

  constructor(@Inject(MAT_DIALOG_DATA) public timer: Timer, private _user: UserService, private _firestore: FireStoreService, private zone: NgZone, public dialogRef: MatDialogRef<AddPlayerComponent>) {
    
  }

  setUser() {
    this.username = this.username.trim();
    if (!this.username || this.username.length === 0) {
      this._user.sendNotification("Please enter a valid username!");
      return;
    }

    //guest
    if (this.phase === 1) {
      this.user.id = crypto.randomUUID();
      this.user.name = this.username;
      this.user.displayName = this.username;
      this.user.hasSignedIn = false;
      this.user.ogFolderpath = this._user.user.ogFolderpath;
      this.startNewLocalGame();
      return;
    }

    //login
    if (this.phase === 2) {
      this._firestore.getUsers().then(collection => {
        if (collection) {
          const profile = collection.users.find(user => user.name === this.username);
          
          if (profile) {
            this._firestore.authenticateUsernamePw(profile, this.pw).then(success => {
              if (success) {
                this.user.importDbUser(profile, profile.name);
                this.user.hasSignedIn = true;
                this.startNewLocalGame();
                return;
              }
              else {
                this._user.sendNotification("User sign in failed.");
                return;
              }
            });
          }
          else {
            this._user.sendNotification("User doesn't exist.");
            return;
          }
        }
      });
    }
  }

  updateControllerPort() {
    if (this.localPlayer)
      this.localPlayer.socketHandler.changeController(this.controller);
  }

  startNewLocalGame() {
    this.phase = 3;
    this.port = this._user.launchNewLocalPlayer();
    this.controller = this._user.getLastNewLocalPlayerDefaultController();
    this.localPlayer = new LocalPlayerData(this.user, this.port, this.zone, this.timer, this.controller);
  }

  confirm() {
    this.dialogRef.close(this.localPlayer);
  }

  close() {
    this.dialogRef.close(null);
  }

}
