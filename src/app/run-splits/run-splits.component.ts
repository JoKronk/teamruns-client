import { Component, Input } from '@angular/core';
import { Team } from '../common/run/team';

@Component({
  selector: 'app-run-splits',
  templateUrl: './run-splits.component.html',
  styleUrls: ['./run-splits.component.scss']
})
export class RunSplitsComponent {
  
  @Input() team: Team;
  
}
