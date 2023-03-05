import { Component, Input } from '@angular/core';
import { Lobby } from '../common/firestore/lobby';

@Component({
  selector: 'app-run-spectators',
  templateUrl: './run-spectators.component.html',
  styleUrls: ['./run-spectators.component.scss']
})
export class RunSpectatorsComponent {

  @Input() lobby: Lobby | undefined;
}
