import { Component, OnDestroy } from '@angular/core';
import { MatSnackBarRef } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-snackbar-import',
  templateUrl: './snackbar-import.component.html',
  styleUrls: ['./snackbar-import.component.scss']
})
export class SnackbarImportComponent implements OnDestroy{

  downloadListener: any;
  fileListener: any;

  constructor(private snackRef: MatSnackBarRef<SnackbarImportComponent>, private router: Router) {
    this.router.events.subscribe((val) => {
      this.snackRef.dismiss();
    });
      
    this.downloadListener = (window as any).electron.receive("recordings-download-get", () => {
      this.snackRef.dismiss();
    });

    this.fileListener = (window as any).electron.receive("recordings-fetch-get", () => {
      this.snackRef.dismiss();
    });
  }

  ngOnDestroy(): void {
    this.downloadListener();
    this.fileListener();
  }

}
