import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Player } from 'src/app/common/player/player';
import { Run } from 'src/app/common/run/run';
import { RunData } from 'src/app/common/run/run-data';
import { FireStoreService } from 'src/app/services/fire-store.service';
import { UserService } from 'src/app/services/user.service';
import pkg from 'app/package.json';
import { RunMode } from 'src/app/common/run/run-mode';
import { Lobby } from 'src/app/common/firestore/lobby';

@Component({
  selector: 'app-create-run',
  templateUrl: './create-run.component.html',
  styleUrls: ['./create-run.component.scss']
})
export class CreateRunComponent {

  runData: RunData = new RunData(pkg.version);
  maxSize: number = 1;

  teamsOptions: number[] = [1, 2, 3, 4];
  runnersOptions: number[] = [1, 2, 3, 4];

  runMode = RunMode;

  constructor(private _user: UserService, private _firestore: FireStoreService, private router: Router, private dialogRef: MatDialogRef<CreateRunComponent>) {
    this.updateRunSize();
  }

  createRun() {
    this.runData.buildVersion = pkg.version;
    const lobby = new Lobby(this.runData);
    this._firestore.addLobby(lobby);
    this.router.navigate(['/run'], { queryParams: { id: lobby.id } });
    this.dialogRef.close();
  }

  updateRunSize() {
    this.maxSize = this.runData.teams * this.runData.teamSize;
  }
}
