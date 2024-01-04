import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { LocalPlayerData } from 'src/app/common/user/local-player-data';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-set-controller',
  templateUrl: './set-controller.component.html',
  styleUrls: ['./set-controller.component.scss']
})
export class SetControllerComponent {
  
  constructor(public _user: UserService, public dialogRef: MatDialogRef<SetControllerComponent>) {
    
  }

  updateControllerPort(localPlayer: LocalPlayerData) {
    if (localPlayer.user.controllerPort)
      localPlayer.socketHandler.changeController(localPlayer.user.controllerPort);
  }

  close() {
    this.dialogRef.close(null);
  }

}
