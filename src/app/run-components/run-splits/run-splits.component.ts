import { Component, Input } from '@angular/core';
import { Team } from '../../common/run/team';
import { DbTeam } from '../../common/firestore/db-team';

@Component({
  selector: 'app-run-splits',
  templateUrl: './run-splits.component.html',
  styleUrls: ['./run-splits.component.scss']
})
export class RunSplitsComponent {

  public teamSplits: Team | undefined;
  
  @Input() set team(team: Team) {
    this.teamSplits = team;
  }

  @Input() set dbTeam(dbTeam: DbTeam) {
    if (!this.teamSplits)
      this.teamSplits = Team.fromDbTeam(dbTeam);
  }
  
}
