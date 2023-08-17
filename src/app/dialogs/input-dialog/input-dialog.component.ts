import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-input-dialog',
  templateUrl: './input-dialog.component.html',
  styleUrls: ['./input-dialog.component.scss']
})
export class InputDialogComponent {

  userInput: string;

  constructor(@Inject(MAT_DIALOG_DATA) public input: InputDialogData, @Inject(MAT_DIALOG_DATA) public title: string, public dialogRef: MatDialogRef<InputDialogComponent>) {
  
  }

  close() {
    this.dialogRef.close();
  }

  confirm() {
    if (this.input.passwordCheck)
      this.dialogRef.close(this.input.password?.toLowerCase() === this.userInput.toLowerCase());
    else
      this.dialogRef.close(this.userInput);
  }

}


export class InputDialogData {
  precursorTitle?: string;
  passwordCheck?: boolean;
  password?: string;
  title?: string;
  confirmText?: string;
}