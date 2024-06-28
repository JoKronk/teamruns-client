import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CitadelOption, RunData } from 'src/app/common/run/run-data';
import { FireStoreService } from 'src/app/services/fire-store.service';
import pkg from 'app/package.json';
import { RunMod, RunMode } from 'src/app/common/run/run-mode';
import { Lobby } from 'src/app/common/firestore/lobby';
import { UserService } from 'src/app/services/user.service';
import { Category, CategoryOption } from 'src/app/common/run/category';

@Component({
  selector: 'app-create-run',
  templateUrl: './create-run.component.html',
  styleUrls: ['./create-run.component.scss']
})
export class CreateRunComponent {

  runData: RunData = new RunData(pkg.version);
  categoryOptions: Category[] = Category.GetGategories();
  teamsOptions: number[] = [1, 2, 3, 4];
  countdownOptions: number[] = [5, 10, 15];
  citadelSkipOptions: number[] = Object.values(CitadelOption).filter((v) => !isNaN(Number(v))).map(x => parseInt(x.toString()));
  password: string | null = null;
  modeInfo: string | null = null;
  allowLateSpectate: boolean = false;

  runMode = RunMode;
  citadelOptions = CitadelOption;

  constructor(public _user: UserService, private _firestore: FireStoreService, private router: Router, private dialogRef: MatDialogRef<CreateRunComponent>) {
    this.getModeInfo();
  }

  private createRun() {
    this.runData.buildVersion = pkg.version;
    this.runData.gameVersion = this._user.user.gameVersion;

    switch(this.runData.mode) {
      case RunMode.Speedrun:
        this.runData.applyCategorySettings();
        break;

      case RunMode.Casual:
        this.runData.applyCasualSettings();
        break;
        
      default:
        break;
    }
  }

  createOnlineRun() {
    this.createRun();

    const lobby = new Lobby(this.runData, this._user.getMainUserId(), this.allowLateSpectate, this.password);
    this._firestore.addLobby(lobby);
    this.router.navigate(this.runData.mode !== this.runMode.Casual ? ['/run'] : ['/run-casual'], { queryParams: { id: lobby.id } });
    this.dialogRef.close();
  }

  createOfflineRun() {
    this.createRun();
    
    this._user.offlineSettings = this.runData;
    this.router.navigate(this.runData.mode !== this.runMode.Casual ? ['/run'] : ['/run-casual']);
    this.dialogRef.close();
  }

  getModeInfo() {
    this.modeInfo = RunMod.getInfo(this.runData.mode);
  }

  changeMode() {
    if (this.runData.mode === RunMode.Lockout) {
        if (this.runData.teams === 1)
          this.runData.teams = 2;
        
        this.categoryOptions = [Category.GetGategories()[0]];
        this.runData.category = CategoryOption.Custom;
    }
    else {
      this.categoryOptions = Category.GetGategories();
      this.runData.category = CategoryOption.NoLts;
    }
    this.getModeInfo();
  }
  changeTeams() {
    if (this.runData.mode === RunMode.Lockout && this.runData.teams === 1) {
        this.runData.sameLevel = false;
    }
  }
  changeCategory() {
    if (this.runData.mode === RunMode.Lockout && this.runData.teams === 1) {
        this.runData.sameLevel = false;
    }
  }
}