import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Player } from '../../common/player/player';
import { UserBase } from '../../common/user/user';

@Component({
  selector: 'app-run-spectators',
  templateUrl: './run-spectators.component.html',
  styleUrls: ['./run-spectators.component.scss']
})
export class RunSpectatorsComponent {

  @Input() spectators: Player[];
  @Input() isHost: boolean;
  @Input() userId: string;
  @Output() onKick: EventEmitter<UserBase> = new EventEmitter<UserBase>();

  constructor() {

  }

  kickPlayer(spectator: UserBase) {
    this.onKick.emit(spectator);
  }
}
