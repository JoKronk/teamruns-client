import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RunData } from 'src/app/common/run/run-data';
import { FireStoreService } from 'src/app/services/fire-store.service';
import pkg from 'app/package.json';
import { RunMode } from 'src/app/common/run/run-mode';
import { Lobby } from 'src/app/common/firestore/lobby';
import { Preset } from 'src/app/common/firestore/preset';

@Component({
  selector: 'app-create-run',
  templateUrl: './create-run.component.html',
  styleUrls: ['./create-run.component.scss']
})
export class CreateRunComponent {

  runData: RunData = new RunData(pkg.version);
  teamsOptions: number[] = [1, 2, 3, 4];

  runMode = RunMode;

  tournamentPreset: Preset;
  usingPreset: boolean;

  constructor(private _firestore: FireStoreService, private router: Router, private dialogRef: MatDialogRef<CreateRunComponent>) {
    this.getPreset();
  }

  createRun() {
    this.runData.buildVersion = pkg.version;
    const lobby = new Lobby(this.runData);
    this._firestore.addLobby(lobby);
    this.router.navigate(['/run'], { queryParams: { id: lobby.id } });
    this.dialogRef.close();
  }

  async getPreset() {
    this.tournamentPreset = await this._firestore.getPreset("tournament") ?? new Preset(this.runData);
  }

  usePreset() {
    this.usingPreset = true;
    this.runData = this.tournamentPreset.runData;
  }

  changeMode() {
    if (this.runData.mode === RunMode.Speedrun)
      this.teamsOptions = [1, 2, 3, 4];
    else if (this.runData.mode === RunMode.Lockout) {
      this.teamsOptions = [2, 3, 4];
      if (this.runData.teams === 1)
        this.runData.teams = 2;
    }
    else if (this.runData.mode === RunMode.Elimination) {
      this.teamsOptions = [1];
      if (this.runData.teams !== 1)
        this.runData.teams = 1;
    }
  }
}
