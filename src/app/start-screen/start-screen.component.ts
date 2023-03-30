import { Component, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { OG } from '../common/opengoal/og';
import { User } from '../common/user/user';
import { NewUpdateComponent } from '../dialogs/new-update/new-update.component';
import { SetPathComponent } from '../dialogs/set-path/set-path.component';
import { FireStoreService } from '../services/fire-store.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-start-screen',
  templateUrl: './start-screen.component.html',
  styleUrls: ['./start-screen.component.scss']
})
export class StartScreenComponent implements OnDestroy, AfterViewInit {

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

  private updateListener: any;

  constructor(public _user: UserService, private router: Router, private dialog: MatDialog, private _firestore: FireStoreService) {
    this.checkVideoLoad();

    this.setupUpdateListener();

    if (new Date().getHours() % 4 === 0) //saving some reads on the free plan db
      this._firestore.deleteOldLobbies();
  }

  ngAfterViewInit(): void {
    this._user.checkForUpdate();
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

  setupUpdateListener() {
    this.updateListener = (window as any).electron.receive("update-available", () => {
      this.dialog.open(NewUpdateComponent);
    });
  }

  ngOnDestroy(): void {
    this.updateListener();
  }
}
