import { Component, Input } from '@angular/core';
import { Team } from '../common/run/team';

@Component({
  selector: 'app-run-team',
  templateUrl: './run-team.component.html',
  styleUrls: ['./run-team.component.scss']
})
export class RunTeamComponent {
  
  @Input() team: Team;
  
}
