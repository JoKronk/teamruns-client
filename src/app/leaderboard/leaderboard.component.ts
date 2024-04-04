import { Component } from '@angular/core';
import { UserService } from '../services/user.service';
import { FireStoreService } from '../services/fire-store.service';
import { Subscription } from 'rxjs';
import { DbUsersCollection } from '../common/firestore/db-users-collection';
import { Category, CategoryOption } from '../common/run/category';
import { MatTableDataSource } from '@angular/material/table';
import { DbLeaderboardPb } from '../common/firestore/db-leaderboard-pb';
import { DbLeaderboard } from '../common/firestore/db-leaderboard';
import { Chart } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
Chart.register(zoomPlugin);
import 'chartjs-adapter-date-fns';
import { Timer } from '../common/run/timer';
import { Team } from '../common/run/team';
import { Task } from '../common/opengoal/task';
import { DbRun } from '../common/firestore/db-run';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { PbCommentDialogComponent } from '../dialogs/pb-comment-dialog/pb-comment-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { DbRunUserContent } from '../common/firestore/db-run-user-content';
import { AccountDialogComponent, AccountReply } from '../dialogs/account-dialog/account-dialog.component';
import { DbPb } from '../common/firestore/db-pb';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss'],
  animations: [
    trigger('runExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ])
  ]
})
export class LeaderboardComponent {

  categoryOptions: Category[] = Category.GetGategories();
  usersCollection?: DbUsersCollection;
  playerOptions: number[] = [1, 2, 3, 4, 5, 6];

  toggleSaved: boolean = false;
  wrHistoryLoaded: boolean = false;
  boardHasLoaded: boolean = false;
  showWrHistory: boolean = false;

  selectedCategory: CategoryOption = CategoryOption.NoLts;
  sameLevel: string = "false";
  players: number = 2;

  chart: any;

  leaderboard: DbLeaderboard = new DbLeaderboard(this.selectedCategory, this.sameLevel === "true", this.players);
  dataSource: MatTableDataSource<DbLeaderboardPb> = new MatTableDataSource();
  columns: string[] = ["position", "players", "time", "date", "version", "options"];

  selectedRun: DbLeaderboardPb | null = null;
  selectedTeam: Team | null = null;

  constructor(public _user: UserService, private firestoreService: FireStoreService, private dialog: MatDialog) {

    this.firestoreService.getUsers().then(collection => {
      this.usersCollection = collection;
      this.updateContent();
    });
  }

  changeCategory(category: number) {
    this.selectedCategory = category;
    this.updateContent();
  }

  changePlayerCount() {
    if (this.players === 1)
      this.sameLevel = "false";
    this.updateContent();
  }


  updateContent(iscontentToggle: boolean = false) {
    if (!iscontentToggle)
      this.toggleSaved = false;
    

    if (iscontentToggle ? this.showWrHistory : !this.showWrHistory)
      this.updateLeaderboard();
    else
      this.getWrChartData();

    
    if (iscontentToggle) {
      this.toggleSaved = true;
      this.showWrHistory = !this.showWrHistory;
    }

    this.selectedRun = null;
    this.selectedTeam = null;
  }

  updateLeaderboard() {
    if (!this.usersCollection || this.toggleSaved) return;

    const leaderboardSubscription = this.firestoreService.getLeaderboard(this.selectedCategory, this.sameLevel === "true", this.players).subscribe(dbLeaderboards => {
      leaderboardSubscription.unsubscribe();
      
      if (!dbLeaderboards || dbLeaderboards.length === 0)
        this.leaderboard = new DbLeaderboard(this.selectedCategory, this.sameLevel === "true", this.players);
      else
        this.leaderboard = Object.assign(new DbLeaderboard(dbLeaderboards[0].category, dbLeaderboards[0].sameLevel, dbLeaderboards[0].players), dbLeaderboards[0]);

      this.leaderboard.pbs = this.leaderboard.pbs.sort((a, b) => a.endTimeMs - b.endTimeMs);
      this.leaderboard.pbs.forEach((pb, index) => {
        this.leaderboard.pbs[index] = Object.assign(new DbLeaderboardPb(), pb);
        this.leaderboard.pbs[index].fillFrontendValues(this.usersCollection!, this._user.user.id, (index + 1));
      });

      this.dataSource = new MatTableDataSource(this.leaderboard.pbs);
      this.boardHasLoaded = true;
    });
  }

  getWrChartData() {
    if (this.toggleSaved && this.wrHistoryLoaded) return;
    this.wrHistoryLoaded = true;

    const wrSubscription = this.firestoreService.getWrs(this.selectedCategory, this.sameLevel === "true", this.players).subscribe(wrs => {
      wrSubscription.unsubscribe();


      wrs = wrs.sort((a, b) => a.date - b.date);
      let userCollection = this.usersCollection;
      if (this.chart)
        this.chart.destroy();
      this.chart = new Chart('WRchart', {
        type: 'line',
        data: {
          labels: Array.from(wrs, wr => new Date(wr.date)),
          datasets: [{
            data: Array.from(wrs, wr => wr.endTimeMs),
            stepped: true,
            borderColor: "#665229",
            borderWidth: 2,
            pointBorderWidth: 2,
            pointRadius: 5,
            pointBackgroundColor: '#d49012',
            pointBorderColor: '#d49012',
            pointStyle: 'triangle'
          }]
        },
        options: {
          responsive: true,
          interaction: {
            intersect: false,
            axis: 'x',
          },
          plugins: {
            legend: {
              display: false
            },
            zoom: {
              zoom: {
                wheel: {
                  enabled: true
                },
                pinch: {
                  enabled: true
                },
                mode: 'xy'
              },
              pan: {
                enabled: true
              }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  let wr = wrs.find(x => x.endTimeMs === context.parsed.y);
                  return wr?.players.flatMap(x => userCollection!.users.find(y => y.id === x.user.id)?.name).join(", ") + " · " + Timer.msToTimeTextFormat(context.parsed.y);
                }
              }
            },
          },
          scales: {
            y: {
              ticks: {
                callback: function (label, index, labels) {
                  return Timer.msToTimeTextFormat(+label);
                }
              }
            },
            x: {
              type: 'time',
              alignToPixels: true,
              offsetAfterAutoskip: true,
              time: {
                minUnit: 'day',
                tooltipFormat: "MMM dd, yyyy HH:mm",
              },
              ticks: {
                stepSize: 1
              }
            }
          },
          animation: {
            duration: 10
          }
        }
      });
    });
  }


  selectRun(run: DbLeaderboardPb) {
    if (run.id === this.selectedRun?.id) {
      this.selectedRun = null;
      this.selectedTeam = null;
    }
    else {
      this.selectedRun = run;
      let team = new Team(0, "");
      
      this.selectedRun.tasks.forEach(dbTask => {
        let task = Task.fromDbTask(dbTask);
        task.obtainedByName = this.usersCollection?.users.find(x => x.id === task.obtainedById)?.name ?? "Unknown";
        team.splits.push(task);
      });
      team.runState.cellCount = this.selectedRun.tasks.filter(x => x.isCell).length;
      this.selectedTeam = team;
    }
  }

  updateUserContent(pbId: string) {
    const pbSubscription = this.firestoreService.getPb(pbId).subscribe(pb => {
      pbSubscription.unsubscribe();
      if (!pb) {
        this._user.sendNotification("Unable to find PB.");
        return;
      }
      if (!pb.userContent)
        pb.userContent = [];

      let existingContent = pb.userContent.find(x => x.userId === this._user.getMainUserId());
      const dialogSubscription = this.dialog.open(PbCommentDialogComponent, { data: { newPb: false, content: existingContent } }).afterClosed().subscribe((content: DbRunUserContent) => {
        dialogSubscription.unsubscribe();
          if (content) {
            content.userId = this._user.user.id;
            
            const loginSubscription = this.dialog.open(AccountDialogComponent, { data: { isLogin: true } }).afterClosed().subscribe((response: AccountReply | undefined) => {
              loginSubscription.unsubscribe();
              if (!response || !pb) return;
              
              pb.userContent = pb.userContent.filter(x => x.userId !== content.userId);
              pb.userContent.push(content);
              pb = Object.assign(new DbPb(), pb);
              this.firestoreService.updatePb(pb).then(() => {
                this._user.sendNotification("Update successful!");

                //lazy solution
                setTimeout(() => {
                  this.updateLeaderboard();
                }, 1000);
                });
            });
        }
      });
    });
  }
}

