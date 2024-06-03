import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DbRunUserContent } from 'src/app/common/firestore/db-run-user-content';

@Component({
  selector: 'app-pb-comment-dialog',
  templateUrl: './pb-comment-dialog.component.html',
  styleUrls: ['./pb-comment-dialog.component.scss']
})
export class PbCommentDialogComponent {

  content: DbRunUserContent = new DbRunUserContent();
  showVideoLinkInfo: boolean = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: PbCommentData, public dialogRef: MatDialogRef<PbCommentDialogComponent>) {
    if (data.newPb)
      dialogRef.disableClose = true;
    
    if (data.content)
      this.content = data.content;
  }

  close() {
    this.dialogRef.close();
  }

  confirm() {
    if (this.hasValidVideoLink())
      this.dialogRef.close(this.content);
    else
      this.showVideoLinkInfo = true;
  }

  hasValidVideoLink(): boolean {
    if (this.content.videoLink === undefined || this.content.videoLink === '')
      return true;

    
    var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\?v=)([^#\&\?]*).*/;
    var match = this.content.videoLink.match(regExp);
    return (match && match[2].length == 11 || this.content.videoLink.startsWith("https://www.twitch.tv/") || this.content.videoLink.startsWith("www.twitch.tv/") || this.content.videoLink.startsWith("twitch.tv/"))
  }
}


export class PbCommentData {
  newPb: boolean;
  content?: DbRunUserContent;
}
