import { Component } from '@angular/core';
import { UserService } from '../services/user.service';
import { FireStoreService } from '../services/fire-store.service';
import { DbRun } from '../common/firestore/db-run';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Category } from '../common/run/category';
import { HeaderComponent } from '../window-components/header/header.component';
import { DatePipe } from '@angular/common';
import { RunSplitsComponent } from '../run-components/run-splits/run-splits.component';
import { FooterComponent } from '../window-components/footer/footer.component';

@Component({
    selector: 'app-run-history',
    templateUrl: './run-history.component.html',
    styleUrls: ['./run-history.component.scss'],
    imports: [HeaderComponent, RunSplitsComponent, FooterComponent, DatePipe, MatTableModule]
})
export class RunHistoryComponent {
  
  categoryOptions: Category[] = Category.GetGategories();
  usersCollection?: DbUsersCollection;

  runs: DbRun[] = [];
  
  dataSource: MatTableDataSource<DbRun> = new MatTableDataSource(this.runs);
  columns = ['name', 'category', 'time', 'version', 'date', 'players'];
  expandedRun: DbRun | null;
  
  constructor(public _user: UserService, private firestoreService: FireStoreService) { }

  ngOnInit() {
    this.firestoreService.getUsers().then(collection => {
      this.usersCollection = collection;
      
      if (!this.usersCollection) return;
      const runsSubscription = this.firestoreService.getUserRuns(this._user.user.id).subscribe(runs => {
        runsSubscription.unsubscribe();
        runs.sort((a, b) => b.date - a.date);
        runs.forEach((run, index) => {
          runs[index] = Object.assign(new DbRun(), run);
          runs[index].userIdsToMap();
          runs[index].fillFrontendValues(this.usersCollection!);
        });

        this.runs = runs;
        this.dataSource = new MatTableDataSource(this.runs);
      });
    });
  }
}