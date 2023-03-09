import { Component, Input } from '@angular/core';
import { Lobby } from '../common/firestore/lobby';
import { RunMode } from '../common/run/run-mode';

@Component({
  selector: 'app-lobby-viewer',
  templateUrl: './lobby-viewer.component.html',
  styleUrls: ['./lobby-viewer.component.scss']
})
export class LobbyViewerComponent {

  @Input() lobby: Lobby | null;
  @Input() hide: boolean;
  runMode = RunMode;

  constructor() {

  }

}
