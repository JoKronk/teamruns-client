import { Component, EventEmitter, Input, NgZone, OnDestroy, Output } from '@angular/core';
import { LocalSave } from 'src/app/common/level/local-save';
import { ConfirmComponent } from 'src/app/dialogs/confirm/confirm.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-save-loader',
  templateUrl: './save-loader.component.html',
  styleUrls: ['./save-loader.component.scss']
})
export class SaveLoaderComponent implements OnDestroy {

  @Input() hideFiles: boolean = false;
  @Output() onLoadSave: EventEmitter<LocalSave> = new EventEmitter<LocalSave>();
  
  internalHideFiles: boolean = false;
  saveFiles: LocalSave[] = [];
  fileListener: any;

  constructor(private dialog: MatDialog, private zone: NgZone) {
    (window as any).electron.send('save-fetch');
    this.fileListener = (window as any).electron.receive("save-get", (saves: LocalSave[]) => {
      this.zone.run(() => {
        if (this.saveFiles.length !== 0)
          this.internalHideFiles = true;
        else
          this.saveFiles = saves;
      });
    });
  }

  loadSave(save: LocalSave) {
    const dialogSubscription = this.dialog.open(ConfirmComponent, { data: { message: "Are you sure you want to load " + save.name + "?" } }).afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed) {
        save = Object.assign(new LocalSave(), save);
        this.onLoadSave.emit(save);
      }
    });
  }

  ngOnDestroy(): void {
    this.fileListener();
  }
}
