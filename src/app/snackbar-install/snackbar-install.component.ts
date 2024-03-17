import { Component, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBarRef } from '@angular/material/snack-bar';

@Component({
  selector: 'app-snackbar-install',
  templateUrl: './snackbar-install.component.html',
  styleUrls: ['./snackbar-install.component.scss']
})
  
export class SnackbarInstallComponent implements OnDestroy {
  
  private clientUpdateStarted: boolean = false;
  install: InstallProgress = new InstallProgress(0, "Starting");

  private installListener: any;
  private updateListener: any;

  constructor(private snackRef: MatSnackBarRef<SnackbarInstallComponent>, private zone: NgZone) {
    this.setupInstallListeners();
    this.setupUpdateListener();
   }

  setupInstallListeners() {
    this.installListener = (window as any).electron.receive("install-progress", (installProgress: InstallProgress) => {
      if (!this.clientUpdateStarted) {
        this.zone.run(() => {
          this.install = installProgress;
  
          if (this.install.progress === 100) {
            setTimeout(() => {
              this.snackRef.dismiss();
            }, 2000);
          }
        });
      }
    });
  }

  setupUpdateListener() {
    this.updateListener = (window as any).electron.receive("update-progress", (progress: number) => {
      this.zone.run(() => {
        this.clientUpdateStarted = true;
        this.install.message = "Updating";
        this.install.progress = progress;
      });
    });
  }

  ngOnDestroy(): void {
    if (this.installListener) this.installListener();
    if (this.updateListener) this.updateListener();
  }
}


export class InstallProgress {
  progress: number;
  message: string;

  constructor(progress: number, message: string) {
    this.progress = progress;
    this.message = message;
  }
}