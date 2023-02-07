import { Component } from '@angular/core';
import { GoalService } from './services/goal.service';
import { NavToggleService } from './services/nav-toggle.service';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'TeamRun';

  constructor(public _nav: NavToggleService, public _user: UserService) {

  }
}
