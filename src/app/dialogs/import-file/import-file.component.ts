import { Component, ElementRef, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Recording } from 'src/app/common/playback/recording';
import { PositionDataTimestamp } from 'src/app/common/playback/position-data';

@Component({
  selector: 'app-import-file',
  templateUrl: './import-file.component.html',
  styleUrls: ['./import-file.component.scss']
})
export class ImportFileComponent implements OnDestroy {

  name: string;
  file: any;
  size: string;
  allowedFileTypes: string[] = ['.json'];
  allowedFileTypesString = this.allowedFileTypes.toString();

  fileListener: any;

  @ViewChild("fileDropRef", { static: false }) fileDropEl: ElementRef;

  constructor(@Inject(MAT_DIALOG_DATA) public defaultName: string, private dialogRef: MatDialogRef<ImportFileComponent>) {

    this.name = defaultName ?? "Recording";

    this.fileListener = (window as any).electron.receive("file-get", (data: any) => {
      if (!Array.isArray(data) || data.length === 0 || !(data[0] instanceof PositionDataTimestamp))
        this.dialogRef.close("File was not recognized as a recording.");
        
      const recording: Recording = new Recording(crypto.randomUUID());
      recording.userId = recording.id;
      recording.playback = data;
      recording.fillFrontendValues(this.name);
      this.dialogRef.close(recording);
    });
   }

  onFile(file: any) {
    this.file = file;
    this.size = this.formatBytes(this.file.size);
  }

  handleFile(event: any) {
    this.onFile(event.target.files.item(0))
  }

  onSubmit() {
    (window as any).electron.send('file-fetch', this.file.path);
  }

  ngOnDestroy(): void {
    this.fileListener();
  }

  private formatBytes(bytes: number, decimals: number = 2) {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const dm = decimals <= 0 ? 0 : decimals || 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
