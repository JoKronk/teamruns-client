import { Component, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { GoalService } from '../services/goal.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-start-screen',
  templateUrl: './start-screen.component.html',
  styleUrls: ['./start-screen.component.scss']
})
export class StartScreenComponent {

  @ViewChild('video') video: ElementRef;
  @ViewChild('blackscreen') blackscreen: ElementRef;
  
  infoTexts: String[] = [
    "Thanks Barg",
    "Thanks Mortis",
    "Thanks Kuitar",
    "TriFecto",
    "LowResKui",
    "speed run",
    "OpenGOAL"
  ];
  infoText = this.infoTexts[Math.floor(Math.random() * this.infoTexts.length)];

  constructor(public _user: UserService, private router: Router) {
    this.checkVideoLoad();
  }

  sendToLobby() {
    this.blackscreen.nativeElement.classList.remove('blackscreen-fade');
    setTimeout(() => {
      this.router.navigate(['/lobby']);
    }, 300);
  }

  checkVideoLoad() {
    setTimeout(() => {
      if (this.video.nativeElement.readyState === 4) {
        this.blackscreen.nativeElement.classList.add('blackscreen-fade');
        return;
      }
      else 
        this.checkVideoLoad();
    }, 200);
  }
}
