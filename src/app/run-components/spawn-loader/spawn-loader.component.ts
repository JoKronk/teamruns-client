import { Component } from '@angular/core';
import { Checkpoint } from 'src/app/common/opengoal/checkpoint';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-spawn-loader',
  templateUrl: './spawn-loader.component.html',
  styleUrls: ['./spawn-loader.component.scss']
})
export class SpawnLoaderComponent {

  checkpoints: Checkpoint[] = Checkpoint.getAll();

  constructor(public _user: UserService) {

  }

  loadCheckpoint(checkpoint: string) {
    let localMain = this._user.localUsers.find(x => x.user.id === this._user.getMainUserId());
    if (!localMain)
      return;
    localMain.socketHandler.forceCheckpointSpawn(checkpoint);
  }
}
