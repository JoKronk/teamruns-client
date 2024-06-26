import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DbUserProfile } from 'src/app/common/firestore/db-user-profile';
import { DbUsersCollection } from 'src/app/common/firestore/db-users-collection';
import { UserBase } from 'src/app/common/user/user';
import { FireStoreService } from 'src/app/services/fire-store.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-account-dialog',
  templateUrl: './account-dialog.component.html',
  styleUrls: ['./account-dialog.component.scss']
})
export class AccountDialogComponent {

  username: string;
  pw: string;

  makeOldUserCheck: boolean = false;

  constructor(@Inject(MAT_DIALOG_DATA) public dialogData: AccountDialogData, private _user: UserService, private _firestore: FireStoreService, public dialogRef: MatDialogRef<AccountDialogComponent>) {
    if (dialogData.isLogin && _user.user.name)
      this.username = (' ' + _user.user.name).slice(1); //deep copy
  }

  close() {
    this.dialogRef.close(false);
  }

  returningUserConfirm(isReturningUser: boolean) {
    if (!isReturningUser) {
      this._user.sendNotification("Username is already taken.");
      this.close();
    }
    else {
      this.confirm(true);
    }
  }

  async confirm(isReturningUser: boolean = false) {
    this.username = this.username.trim();
    if (!this.username || this.username.length === 0) {
      this._user.sendNotification("Please enter a valid username!");
      return;
    }

    this._firestore.getUsers().then(collection => {
      if (collection) {
        const profile = collection.users.find(user => user.name.toLowerCase() === this.username.toLowerCase());
        
        
        if (this.dialogData.isLogin) { // handle login
          if (profile) {
            this._firestore.authenticateUsernamePw(profile, this.pw).then(success => {
              if (success) {
                this._user.user.importDbUser(profile, !this._user.user.displayName ? profile.name : this._user.user.displayName);
                if (this.dialogData.newUsername) // handle username change
                  this.updateUsername(collection, profile);
                else if (this.dialogData.newPw)
                  this.updatePassword(collection, profile);
                else
                  this.dialogRef.close(new AccountReply(profile.id, success, "User signed in successfully."));
              }
              else {
                this._user.sendNotification("User login failed.");
                return;
              }
            });
          }
          else
            this.dialogRef.close(new AccountReply("", false, "User doesn't exist."));
        }
          
          
          
        else { // handle user registration
          if (profile && !isReturningUser) { // user already taken
            this._firestore.checkUserExists(profile.name).then(exists => {
              if (exists)
                this._user.sendNotification("Username is already taken.");
              else
                this.makeOldUserCheck = true;
              return;
            });
            return;
          }
          else { // user creation
            this._firestore.createUser(this.username, this.pw).then(result => {
              if (result.success) {
                const newProfile = new DbUserProfile(new UserBase(profile ? profile.id : !collection.users.find(x => x.id === this._user.getMainUserId()) ? this._user.user.id : crypto.randomUUID(), this.username));
                
                if (!isReturningUser) { // completely new user
                  collection.users.push(newProfile);
                  this._firestore.updateUsers(collection).then(() => {
                    this._user.user.importDbUser(newProfile, !this._user.user.displayName ? newProfile.name : this._user.user.displayName);
                    this._user.user.hasSignedIn = true;
                    this._user.writeUserDataChangesToLocal();
                    this.dialogRef.close(new AccountReply(newProfile.id, true, "User created successfully."));
                  });
                }
                else { // returning user
                  this._user.user.importDbUser(newProfile, !this._user.user.displayName ? newProfile.name : this._user.user.displayName);
                  this._user.user.hasSignedIn = true;
                  this._user.writeUserDataChangesToLocal();
                  this.dialogRef.close(new AccountReply(newProfile.id, true, "User created successfully."));
                }
              }
              else {
                this._user.sendNotification(this.translateErrorMessage(result.message) ?? "User creation failed.");
                return;
              }
            });
          }
        }
      }
      else 
        this.dialogRef.close(new AccountReply("", false, "Unable to fetch user."));
    });
  }

  private async updateUsername(collection: DbUsersCollection, profile: DbUserProfile) {
    if (!this.dialogData.newUsername) return;

    const existingUser = collection.users.find(x => x.name === this.dialogData.newUsername);
    if (existingUser) 
      this.dialogRef.close(new AccountReply(profile.id, false, "Username is already taken."));
    else {
      this._firestore.createUser(this.dialogData.newUsername, this.pw, false).then(result => {
        if (result.success) {
          this._firestore.deleteCurrentUser().then(deleted => {
            if (deleted) {
              this._user.user.name = this.dialogData.newUsername!;
              profile.name = this._user.user.name;
              
              this._firestore.updateUsers(collection).then(() => {
                this.dialogRef.close(new AccountReply(profile.id, true, "Username successfully updated!"));
              });
            }
            else
              this.dialogRef.close(new AccountReply(profile.id, false, "User name change failed, please contact Dexz."));
          });
        }
        else
          this.dialogRef.close(new AccountReply(profile.id, false, "User name change failed."));
      });
    }
  }

  private async updatePassword(collection: DbUsersCollection, profile: DbUserProfile) {
    if (!this.dialogData.newPw) return;

    this._firestore.deleteCurrentUser().then(deleted => {
      if (deleted) {
        this._firestore.createUser(this.username, this.dialogData.newPw!).then(result => {
          if (result.success)
            this.dialogRef.close(new AccountReply(profile.id, true, "Password successfully updated!"));
          else
            this.dialogRef.close(new AccountReply(profile.id, false, "Password change failed, please contact Dexz."));
        });
      }
      else
        this.dialogRef.close(new AccountReply(profile.id, false, "Password change failed."));
    });
  }
  
  private translateErrorMessage(error: string | undefined): string | undefined {
    if (!error) return error;
    

    if (error.includes("Password should be at least 6 characters"))
      return "Password should be at least 6 characters.";
    else if (error.includes("The email address is already in use by another account"))
      return "The username is already taken.";

    return undefined;
  }
}

export class AccountDialogData {
  isLogin: boolean;
  newUsername: string | undefined;
  newPw: string | undefined;
}

export class AccountReply {
  userId: string;
  success: boolean;
  message: string | undefined;

  constructor(userId: string, success: boolean, message: string | undefined = undefined) {
    this.userId = userId;
    this.success = success;
    this.message = message;
  }
}
