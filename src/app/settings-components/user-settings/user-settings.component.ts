import { Component, NgZone, OnDestroy } from '@angular/core';
import { UserService } from '../../services/user.service';
import { MatDialog } from '@angular/material/dialog';
import { AccountDialogComponent, AccountReply } from '../../dialogs/account-dialog/account-dialog.component';
import { TaskSplit } from 'src/app/common/opengoal/task-split';
import { Task } from 'src/app/common/opengoal/task';
import { Taunts } from 'src/app/common/opengoal/taunts';
import { NonNullableFormBuilder } from '@angular/forms';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss']
})
export class UserSettingsComponent implements OnDestroy {

  settingsOptions: string[] = ['General','Splits','Taunts'];
  selectedSettingTab: string = 'General';

  tauntsValid: boolean = true;

  newUsername: string = "";
  newPw: string = "";

  splitBeingEdited: string | null = null;
  tauntBeingEdited: number | null = null;
  splits: TaskSplit[] = [];
  taunts: Taunts[] = [];
  tauntsUp: number[] = [0,1,2,3];
  tauntsRight: number[] = [4,5,6,7];
  tauntsDown: number[] = [8,9,10,11];
  tauntsLeft: number[] = [12,13,14,15];
  splitsDefaultNames: string[] = [];
  tauntsDefaultNames: string[] = [];
  private splitsListener: any;
  private tauntsListener: any;

  constructor(public _user: UserService, private dialog: MatDialog, private zone: NgZone) {
    this.setupSplitsListener();
    this.setupTauntsListener();
    (window as any).electron.send('splits-fetch');
    (window as any).electron.send('taunts-fetch');
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

  setTaunts(taunts: Taunts[]) {
    this.taunts = taunts;
    this.tauntsDefaultNames = [];
    for (let taunt of taunts)
      this.tauntsDefaultNames.push(Taunts.defaultTauntName(taunt.index) ?? "Unknown");
  }

  resetTaunts() {
    this.setTaunts(Taunts.generateDefaultTauntList());
    this.saveTaunts();
  }

  saveTaunts() {
    // sanity check before saving
    this.tauntsValid = true;
    for (let i = 0 ; i < 16 ; i++) {
      if(!Taunts.sanityCheck(this.taunts[i].ambient_name)) {
        this.taunts[i].valid = false;
        this.tauntsValid = false;
      } else {
        this.taunts[i].valid = true;
      }
    }
    if (this.tauntsValid) { // sanity check passed, save taunts!
      (window as any).electron.send('taunts-write', this.taunts);
      this._user.sendNotification("Taunts saved!");
    } else {
      this._user.sendNotification("Invalid name detected!")
    }
  }

  setupTauntsListener() {
    this.tauntsListener = (window as any).electron.receive("taunts-get", (taunts: Taunts[] | null) => {
      this.zone.run(() => {
        this.setTaunts(taunts !== null ? taunts : Taunts.generateDefaultTauntList());
      });
    });
  }

  changeSettingsTab(setting: string) {
    this.selectedSettingTab = setting;
  }

  ngOnDestroy(): void {
    this.splitsListener();
    this.tauntsListener();
  }

}
