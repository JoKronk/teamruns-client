import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { LocalSave } from 'src/app/common/level/local-save';
import { ConfirmComponent } from 'src/app/dialogs/confirm/confirm.component';
import { MatDialog } from '@angular/material/dialog';
import { RunStateHandler } from 'src/app/common/level/run-state-handler';
import { OrbCollection } from 'src/app/common/level/orb-collection';

@Component({
  selector: 'app-save-loader',
  templateUrl: './save-loader.component.html',
  styleUrls: ['./save-loader.component.scss']
})
export class SaveLoaderComponent implements OnDestroy {

  @Input() hideFiles: boolean = false;
  @Output() onLoadSave: EventEmitter<LocalSave> = new EventEmitter<LocalSave>();
  
  saveFiles: LocalSave[];
  fileListener: any;

  constructor(private dialog: MatDialog) {
    (window as any).electron.send('save-fetch');
    this.fileListener = (window as any).electron.receive("save-get", (saves: LocalSave[]) => {
      this.saveFiles = saves;
    });
  }

  loadSave(save: LocalSave) {
    const dialogSubscription = this.dialog.open(ConfirmComponent, { data: "Are you sure you want to load " + save.name + "?" }).afterClosed().subscribe(confirmed => {
      dialogSubscription.unsubscribe();
      if (confirmed) {
        save = Object.assign(new RunStateHandler(), save);
        save.orbValidations.forEach((orb, index) => { //called on orb dupe checks, other objects in class doesn't really have any functions that are called after they are stored atm, but can ofc create bugs in the future..
          const collectors = save.orbValidations[index].collectedByIds;
          save.orbValidations[index] = Object.assign(new OrbCollection(save.orbValidations[index].entityName, ""), save.orbValidations[index]);
          save.orbValidations[index].collectedByIds = collectors;
        });
        this.onLoadSave.emit(save);
      }
    });
  }

  openSavesFolder() {
    (window as any).electron.send('save-open');
  }

  ngOnDestroy(): void {
    this.fileListener();
  }
}
