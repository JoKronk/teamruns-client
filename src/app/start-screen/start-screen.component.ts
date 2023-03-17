import { Component, ViewChild, ElementRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { OG } from '../common/opengoal/og';
import { User } from '../common/user/user';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { FireStoreService } from '../services/fire-store.service';
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
    "Thanks Ricky",
    "Thanks SixRock",
    "Thanks Stellar",
    "Thanks Tombo",
    "LowResKui",
    "speed run",
    "OpenGOAL",
    "goonin3"
  ];
  infoText: string = this.infoTexts[Math.floor(Math.random() * this.infoTexts.length)];

  initUserData: User;

  constructor(public _user: UserService, private router: Router, private dialog: MatDialog, private _firestore: FireStoreService) {
    this.checkVideoLoad();
    this._firestore.deleteOldLobbies();
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
      OG.startGame();
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
