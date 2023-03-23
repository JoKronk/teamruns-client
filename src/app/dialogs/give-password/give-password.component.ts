import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-give-password',
  templateUrl: './give-password.component.html',
  styleUrls: ['./give-password.component.scss']
})
export class GivePasswordComponent {

  passwordAttempt: string;

  constructor(@Inject(MAT_DIALOG_DATA) private password: string, public dialogRef: MatDialogRef<GivePasswordComponent>) {

  }

  close() {
    this.dialogRef.close();
  }

  tryJoin() {
    this.dialogRef.close(this.password.toLowerCase() === this.passwordAttempt.toLowerCase());
  }

}
