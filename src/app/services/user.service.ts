import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Player } from '../common/player/player';
import { SnackbarComponent } from '../snackbar/snackbar.component';
import { GoalService } from './goal.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  player: Player = new Player();
  viewSettings: boolean = false;

  constructor(public _goal: GoalService, private _snackbar: MatSnackBar) { 
    
  }

  public sendNotiication(message: string) {
    this._snackbar.openFromComponent(SnackbarComponent, {
      duration: 3000,
      data: message,
      verticalPosition: 'bottom',
      horizontalPosition: 'right'
    });
  }
}
