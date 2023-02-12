import { Component, ViewChild, ElementRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { User } from '../common/player/user';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
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
  
  infoTexts: string[] = [
    "Thanks Barg",
    "Thanks Mortis",
    "Thanks Kuitar",
    "TriFecto",
    "LowResKui",
    "speed run",
    "OpenGOAL"
  ];
  infoText: string = this.infoTexts[Math.floor(Math.random() * this.infoTexts.length)];

  initUserData: User;

  constructor(public _user: UserService, private router: Router, private dialog: MatDialog) {
    this.checkVideoLoad();
  }

  sendToLobby() {
    this._user.checkWriteUserDataHasChanged();
    this.blackscreen.nativeElement.classList.remove('blackscreen-fade');
    setTimeout(() => {
      this.router.navigate(['/lobby']);
    }, 300);
  }

  startGame() {
    if (!this._user.user.ogFolderpath)
      this.dialog.open(SetPathComponent);
    else
    this._user._goal.startGame();
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
