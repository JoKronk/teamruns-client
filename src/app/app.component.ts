import { Component } from '@angular/core';
import { GoalService } from './services/goal.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'TeamRun';

  constructor(public _goal: GoalService) {

  }
}
