import { Component, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlayerState } from '../common/player/player-state';
import { RunHandler } from '../common/run/run-handler';
import { RunState } from '../common/run/run-state';
import { LocalPlayerData } from '../common/user/local-player-data';
import { FireStoreService } from '../services/fire-store.service';
import { UserService } from '../services/user.service';
import { Lobby } from '../common/firestore/lobby';

@Component({
  selector: 'app-obs-run',
  templateUrl: './obs-run.component.html',
  styleUrls: ['./obs-run.component.scss']
})
export class ObsRunComponent implements OnDestroy {

  localPlayer: LocalPlayerData = new LocalPlayerData();
  runHandler: RunHandler | undefined;

  width: number = 320;
  height: string = "800";
  backgroundColor: string = "#4e4e4e";
  timerBorder: boolean = false;
  
  playerState = PlayerState;
  runState = RunState;

  lobbiesSubscription: Subscription; 

  constructor(public _user: UserService, private firestoreService: FireStoreService, private route: ActivatedRoute, private zone: NgZone) {

    this.route.queryParamMap.subscribe((params) => {
      const userId = params.get('user');
      this.height = params.get('height') ?? this.height;
      this.backgroundColor = params.get('bgColor') ?? this.backgroundColor;
      this.timerBorder = (params.get('timerBorder') ?? "false") === "true";
      if (!userId) return;

      this.lobbiesSubscription = this.firestoreService.getUserLobby(userId).subscribe((lobbies) => {
        if (lobbies && lobbies.length !== 0) {
          console.log("GOT GHANGES");

          let playerLobby = lobbies.sort((x, y) => new Date(y.lastUpdateDate).valueOf() - new Date(x.lastUpdateDate).valueOf())[0];
          if (this.runHandler?.lobby?.id === playerLobby.id) return; //return if still in same lobby
          
          //if new lobby 
          //remove user from old lobbies if any
          this.removeUserFromLobbies(userId, lobbies.filter(x => x.id !== playerLobby.id));

          //create run
          this.runHandler = new RunHandler(playerLobby.id, firestoreService.firestore, _user, this.localPlayer, zone, userId);
        }
        else {
          if (this.runHandler) {
            setTimeout(() => { //allow runHandler to get player leave change and set host to null if runner was the only one left in lobby
              this.runHandler!.destroy();
              this.runHandler = undefined;
              this.localPlayer = new LocalPlayerData();
            }, 300);
          }
        }
      });

    });
  }

  //purely done to reduce db reads as every lobby returned when the users lobbies are returned counts as 1 read
  removeUserFromLobbies(userId: string, lobbies: Lobby[]) {
    if (lobbies.length === 0) return;

    lobbies.forEach(lobby => {
      lobby.runners = lobby.runners.filter(x => x !== userId);
      lobby.spectators = lobby.spectators.filter(x => x !== userId);
      console.log("DELETEIGN");
      this.firestoreService.updateLobby(lobby);
    });
  }

  ngOnDestroy(): void {
    this.lobbiesSubscription.unsubscribe();
    if (this.runHandler)
      this.runHandler.destroy();
  }
}
