import { Component, Input } from '@angular/core';
import { Lobby } from '../common/firestore/lobby';
import { RunMode } from '../common/run/run-mode';
import { Category } from '../common/run/category';
import { CitadelOption } from '../common/run/run-data';

@Component({
  selector: 'app-lobby-viewer',
  templateUrl: './lobby-viewer.component.html',
  styleUrls: ['./lobby-viewer.component.scss']
})
export class LobbyViewerComponent {

  @Input() lobby: Lobby | null;
  @Input() hide: boolean;
  runMode = RunMode;
  citadelOptions = CitadelOption;
  categoryOptions: Category[] = Category.GetGategories();

  constructor() {

  }

}
