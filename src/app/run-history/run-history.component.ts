import { Component } from '@angular/core';
import { UserService } from '../services/user.service';
import { FireStoreService } from '../services/fire-store.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DbRun } from '../common/firestore/db-run';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTableDataSource } from '@angular/material/table';
import { Category } from '../common/run/category';

@Component({
  selector: 'app-run-history',
  templateUrl: './run-history.component.html',
  styleUrls: ['./run-history.component.scss'],
  animations: [
    trigger('runExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ]
})
export class RunHistoryComponent {
  
  categoryOptions: Category[] = Category.GetGategories();
  usersCollection?: DbUsersCollection;

  runs: DbRun[] = [];
  
  dataSource: MatTableDataSource<DbRun> = new MatTableDataSource(this.runs);
  columns = ['name', 'category', 'time', 'version', 'date', 'players'];
  expandedRun: DbRun | null;
  
  constructor(public _user: UserService, private firestoreService: FireStoreService, private router: Router) {

    this.firestoreService.getUsers().then(collection => {
      this.usersCollection = collection;
      
      if (!this.usersCollection) return;
      const runsSubscription = firestoreService.getUserRuns(_user.user.id).subscribe(runs => {
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