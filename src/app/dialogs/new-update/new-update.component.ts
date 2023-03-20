import { Component, NgZone, OnDestroy } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-new-update',
  templateUrl: './new-update.component.html',
  styleUrls: ['./new-update.component.scss']
})
export class NewUpdateComponent implements OnDestroy {

  updateWhenReady: boolean = false;
  ready: boolean = false;
  progress: number = 0;

  private downloadListener: any;
  private progressListener: any;

  constructor(public dialogRef: MatDialogRef<NewUpdateComponent>, public _user: UserService, private zone: NgZone) {
    this.setupListeners();
  }

  setupListeners() {
    this.downloadListener = (window as any).electron.receive("update-downloaded", () => {
      this.downloadListener();
      this.progressListener();
      this.ready = true;
      if (this.updateWhenReady)
        this._user.installUpdate();
    });
    this.progressListener = (window as any).electron.receive("update-progress", (progress: number) => {
      this.zone.run(() => {
        this.progress = progress;
      });
    });
  }

  update() {
    this.updateWhenReady = true;
    if (this.ready)
      this._user.installUpdate();
  }

  close() {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    if (this.downloadListener) this.downloadListener();
    if (this.progressListener) this.progressListener();
  }
}
