import { Component, Inject, NgZone, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Run } from 'src/app/common/run/run';
import { LocalPlayerData } from 'src/app/common/user/local-player-data';
import { User } from 'src/app/common/user/user';
import { FireStoreService } from 'src/app/services/fire-store.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-add-player',
  templateUrl: './add-player.component.html',
  styleUrls: ['./add-player.component.scss']
})
export class AddPlayerComponent implements OnDestroy {

  phase: number = 0;
  teamId: number = 0;

  username: string;
  pw: string;
  
  user: User = new User();
  response: AddPlayerResponse | undefined = undefined;
  localPlayerCompleted: boolean = false;

  constructor(@Inject(MAT_DIALOG_DATA) public run: Run, private _user: UserService, private _firestore: FireStoreService, private zone: NgZone, public dialogRef: MatDialogRef<AddPlayerComponent>) {
  
  }

  setUser() {
    if (!this.username) this.username = "";
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
                this._user.sendNotification("User login failed.");
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
    if (this.response?.player && this.user.controllerPort)
      this.response.player.socketHandler.changeController(this.user.controllerPort);
  }

  startNewLocalGame() {
    this.phase = 3;
    this.response = new AddPlayerResponse(this._user.startGame(this.user, this.run), this.teamId);

    if (!this.response.player) {
      this._user.sendNotification("Unable to contact backend");
      this.close();
      return;
    }
  }

  confirm() {
    this.localPlayerCompleted = true;
    this.dialogRef.close(this.response);
  }

  close() {
    this.dialogRef.close(this.response);
  }

  ngOnDestroy(): void {
    if (!this.localPlayerCompleted && this.response?.player)
    this._user.removeLocalPlayer(this.response.player.user.id);
  }

}

export class AddPlayerResponse {
  teamId: number;
  player: LocalPlayerData | undefined;

  constructor(player: LocalPlayerData | undefined, teamId: number) {
    this.teamId = teamId;
    this.player = player;
  }
}
