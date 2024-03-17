import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { UserService } from './services/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Teamruns';

  constructor(public _user: UserService, private router: Router) {

  }

  minimize() {
    (window as any).electron.send('window-minimize');
  }

  close() {
    this.router.navigate(['/close']);
  }
  
  @HostListener('window:keydown.control.shift.b', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    event.preventDefault();
    (window as any).electron.send('settings-reset-size');
  }
}
