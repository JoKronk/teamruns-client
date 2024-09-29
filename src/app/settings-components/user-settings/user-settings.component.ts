import { Component, NgZone, OnDestroy } from '@angular/core';
import { UserService } from '../../services/user.service';
import { MatDialog } from '@angular/material/dialog';
import { AccountDialogComponent, AccountReply } from '../../dialogs/account-dialog/account-dialog.component';
import { TaskSplit } from 'src/app/common/opengoal/task-split';
import { Task } from 'src/app/common/opengoal/task';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss']
})
export class UserSettingsComponent implements OnDestroy {

  settingsOptions: string[] = ['General','Splits','Taunts'];
  selectedSettingTab: string = 'General';

  newUsername: string = "";
  newPw: string = "";

  splitBeingEdited: string | null = null;
  splits: TaskSplit[] = [];
  splitsDefaultNames: string[] = [];
  private splitsListener: any;

  constructor(public _user: UserService, private dialog: MatDialog, private zone: NgZone) {
    this.setupSplitsListener();
    (window as any).electron.send('splits-fetch');
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

  setSplits(splits: TaskSplit[]) {
    this.splits = splits;
    this.splitsDefaultNames = [];
    for (let split of splits)
      this.splitsDefaultNames.push(Task.defaultSplitName(split.gameTask) ?? "Unknown");
  }

  resetSplits() {
    this.setSplits(TaskSplit.generateDefaultSplitList());
    this.saveSplits();
  }

  saveSplits() {
    (window as any).electron.send('splits-write', this.splits);
    this._user.sendNotification("Splits saved!");
  }

  setupSplitsListener() {
    this.splitsListener = (window as any).electron.receive("splits-get", (splits: TaskSplit[] | null) => {
      this.zone.run(() => {
        this.setSplits(splits !== null ? splits : TaskSplit.generateDefaultSplitList());
      });
    });
  }

  changeSettingsTab(setting: string) {
    this.selectedSettingTab = setting;
  }

  ngOnDestroy(): void {
    this.splitsListener();
  }

}
