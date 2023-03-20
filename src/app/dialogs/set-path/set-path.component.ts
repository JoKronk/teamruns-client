import { Component, NgZone, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-set-path',
  templateUrl: './set-path.component.html',
  styleUrls: ['./set-path.component.scss']
})
export class SetPathComponent implements OnDestroy {

  path: string;
  private pathListener: any;

  constructor (public _user: UserService, private dialogRef: MatDialogRef<SetPathComponent>, private zone: NgZone) {
    this.setPathListener();
    this.path = _user.user.ogFolderpath;
  }

  setPath() {
    this._user.user.ogFolderpath = this.path;
    this._user.checkWriteUserDataHasChanged();
    this.dialogRef.close();
  }

  selectPath() {
    (window as any).electron.send('settings-select-path');
  }

  setPathListener() {
    this.pathListener = (window as any).electron.receive("settings-get-path", (path: string) => {
      this.zone.run(() => {
        this.path = path;
      });
    });
  }

  ngOnDestroy(): void {
    this.pathListener();
  }
}
