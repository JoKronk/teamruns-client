import { Component, NgZone, OnDestroy } from '@angular/core';
import { FireStoreService } from '../services/fire-store.service';
import { UserService } from '../services/user.service';
import { MatDialog } from '@angular/material/dialog';
import { AccountDialogComponent, AccountReply } from '../dialogs/account-dialog/account-dialog.component';
import { DbUserProfile } from '../common/firestore/db-user-profile';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss']
})
export class UserSettingsComponent implements OnDestroy {

  path: string;
  newUsername: string = "";
  newPw: string = "";
  private pathListener: any;

  constructor(public _user: UserService, private _firestore: FireStoreService, private dialog: MatDialog, private zone: NgZone) {
    this.setPathListener();
    this.path = _user.user.ogFolderpath;
  }

  setPath() {
    this._user.user.ogFolderpath = this.path;
    this._user.writeUserDataChangeToLocal();
  }

  selectPath() {
    (window as any).electron.send('settings-select-path');
  }

  setPathListener() {
    this.pathListener = (window as any).electron.receive("settings-get-path", (path: string) => {
      this.zone.run(() => {
        this.path = path;
      });
    });
  }


  updateUsername() {
    this.newUsername = this.newUsername.trim();
    if (!this.newUsername || this.newUsername.length === 0) {
      this._user.sendNotification("Username not valid.");
      return;
    }

    const dialogRef = this.dialog.open(AccountDialogComponent, { data: { isLogin: true, newUsername: this.newUsername } });
    const dialogSubscription = dialogRef.afterClosed().subscribe((response: AccountReply | undefined) => {
      dialogSubscription.unsubscribe();
      if (!response) return;

      if (response.message)
        this._user.sendNotification(response.message);
    });
  }

  updatePassword() {
    if (!this.newPw || this.newPw.length < 6) {
      this._user.sendNotification("Password should be at least 6 characters.");
      return;
    }
    
    const dialogRef = this.dialog.open(AccountDialogComponent, { data: { isLogin: true, newPw: this.newPw } });
    const dialogSubscription = dialogRef.afterClosed().subscribe((response: AccountReply | undefined) => {
      dialogSubscription.unsubscribe();
      if (!response) return;

      if (response.message)
        this._user.sendNotification(response.message);
    });
  }


  ngOnDestroy(): void {
    if (this.pathListener) this.pathListener();
  }

}
