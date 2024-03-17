import { Component, NgZone } from '@angular/core';
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
export class UserSettingsComponent {

  newUsername: string = "";
  newPw: string = "";

  constructor(public _user: UserService, private dialog: MatDialog, private zone: NgZone) {

  }

  openRecordings() {
    (window as any).electron.send('recordings-open');
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



}
