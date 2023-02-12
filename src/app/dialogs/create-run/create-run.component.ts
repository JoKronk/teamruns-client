import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Player } from 'src/app/common/player/player';
import { Run } from 'src/app/common/run/run';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-create-run',
  templateUrl: './create-run.component.html',
  styleUrls: ['./create-run.component.scss']
})
export class CreateRunComponent {

  runName: string;
  numberOfTeams: number = 1;
  runnersPerTeam: number = 3;
  runSize: number;

  teamsOptions: number[] = [1, 2, 3, 4];
  runnersOptions: number[] = [1, 2, 3, 4];

  constructor(private _user: UserService, private router: Router, private dialogRef: MatDialogRef<CreateRunComponent>) {
    this.updateRunSize();
  }

  createRun() {
    let player = new Player(this._user.getName());
    let run = new Run(this.runName, this.numberOfTeams, this.runnersPerTeam, player);
    this._user.setLocalRunStorage(run);
    this.router.navigate(['/run']);
    this.dialogRef.close();
  }

  updateRunSize() {
    this.runSize = this.numberOfTeams * this.runnersPerTeam;
  }
}
