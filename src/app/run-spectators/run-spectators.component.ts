import { Component, Input } from '@angular/core';
import { Player } from '../common/player/player';

@Component({
  selector: 'app-run-spectators',
  templateUrl: './run-spectators.component.html',
  styleUrls: ['./run-spectators.component.scss']
})
export class RunSpectatorsComponent {

  @Input() spectators: Player[];
}
