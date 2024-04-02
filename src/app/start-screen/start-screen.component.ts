import { Component, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { User, UserBase } from '../common/user/user';
import { FireStoreService } from '../services/fire-store.service';
import { UserService } from '../services/user.service';
import { DbUserProfile } from '../common/firestore/db-user-profile';
import { AccountDialogComponent, AccountReply } from '../dialogs/account-dialog/account-dialog.component';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { Subscription } from 'rxjs';

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
    "Thanks Zed",
    "Thanks Cippy",
    "goonin3"
  ];
  infoText: string = this.infoTexts[Math.floor(Math.random() * this.infoTexts.length)];

  private userSubscription: Subscription;
  private updateListener: any;
  private installMissingListener: any;
  private installOutdatedListener: any;

  userCollection: DbUsersCollection | undefined = undefined;

  constructor(public _user: UserService, private router: Router, private dialog: MatDialog, private _firestore: FireStoreService) {
    this.checkVideoLoad();

    this.setupUpdateListener();
    this.setupInstallListeners();
    this.setupUserListener();

    if (new Date().getHours() % 4 === 0) //saving some reads on the free plan db
      this._firestore.deleteOldLobbies();
  }

  ngAfterViewInit(): void {
    this._user.checkForUpdate();
  }

  sendToLobby(asGuest: boolean) {
    if (!asGuest && (!this._user.user.displayName || this._user.user.displayName.length === 0))
      this._user.user.displayName = this._user.user.name;

    this._user.user.hasSignedIn = !asGuest;
    
    if (this._user.userHasChanged()) {
      this._user.writeUserDataChangeToLocal();

      this._firestore.getUsers().then(collection => {
        if (!collection) return;

        let user = collection.users.find(user => user.id === this._user.user.id);
        if (user)
          user = new DbUserProfile(this._user.user);
        else
          collection.users.push(new DbUserProfile(this._user.user));

        this._firestore.updateUsers(collection);
      });
    }

    this.blackscreen.nativeElement.classList.remove('blackscreen-fade');
    setTimeout(() => {
      this.router.navigate(['/lobby']);
    }, 300);
  }

  logout() {
    this._user.user.importDbUser(new DbUserProfile(new UserBase(crypto.randomUUID(), "")), this._user.user.displayName);
    this._user.user.hasSignedIn = false;
    
    if (this._user.userHasChanged())
      this._user.writeUserDataChangeToLocal();
  }

  login(checkAlreadyLoggedIn: boolean) {
    if (checkAlreadyLoggedIn && this._user.user.hasSignedIn) {
      this.sendToLobby(false);
      return;
    }

    const dialogSubscription = this.dialog.open(AccountDialogComponent, { data: { isLogin: true } }).afterClosed().subscribe((response: AccountReply | undefined) => {
      dialogSubscription.unsubscribe();
      if (!response) return;

      if (response.message)
        this._user.sendNotification(response.message);

      this._user.user.hasSignedIn = response.success;
    });
  }

  register() {
    const dialogSubscription = this.dialog.open(AccountDialogComponent, { data: { isLogin: false } }).afterClosed().subscribe((response: AccountReply | undefined) => {
      dialogSubscription.unsubscribe();
      if (!response) return;

      if (response.message)
        this._user.sendNotification(response.message);
    });
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
      this.router.navigate(['/install'], { queryParams: { client: 1 } });
    });
  }

  setupInstallListeners() {
    this.installMissingListener = (window as any).electron.receive("install-missing", () => {
      this.router.navigate(['/install'], { queryParams: { install: 1 } });
    });

    this.installOutdatedListener = (window as any).electron.receive("install-outdated", () => {
      this.router.navigate(['/install'], { queryParams: { update: 1 } });
    });
  }

  setupUserListener() {
    if (this._user.user.hasSignedIn) return;
    
    this.userSubscription = this._user.userSetupSubject.subscribe(localUser => {
      if (this._user.user.hasSignedIn) return;
      
      this._firestore.getUsers().then(collection => {
        if (!collection) return;
        this.userCollection = collection;
          this.checkCollectionForUser();
      });

    });
  }

  checkCollectionForUser() {
    if (!this.userCollection) return;

    const user = this.userCollection.users.find(user => user.id === this._user.getMainUserId());
    if (user) {
      this._user.user.importDbUser(user, this._user.user.displayName);
      this._user.user.hasSignedIn = true;
    }

  }

  ngOnDestroy(): void {
    if (this.userSubscription) this.userSubscription.unsubscribe();
    if (this.updateListener) this.updateListener();
    if (this.installMissingListener) this.installMissingListener();
    if (this.installOutdatedListener) this.installOutdatedListener();
  }
}
