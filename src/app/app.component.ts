import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'TeamRun';

  constructor(public _user: UserService, private router: Router) {

  }

  minimize() {
    (window as any).electron.send('window-minimize');
  }

  close() {
    this.router.navigate(['/close']);
  }
}
