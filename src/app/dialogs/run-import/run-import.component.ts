import { Component, Inject, NgZone, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { DbLeaderboard } from 'src/app/common/firestore/db-leaderboard';
import { DbLeaderboardPb } from 'src/app/common/firestore/db-leaderboard-pb';
import { DbUsersCollection } from 'src/app/common/firestore/db-users-collection';
import { RecordingImport } from 'src/app/common/recording/recording-import';
import { FireStoreService } from 'src/app/services/fire-store.service';
import { UserService } from 'src/app/services/user.service';
import { RecordingFile } from 'src/app/common/recording/recording-file';
import { DbRecordingFile } from 'src/app/common/firestore/db-recording-file';
import { Run } from 'src/app/common/run/run';
import { SelectableRecording } from 'src/app/common/recording/selectable-recording';
import { RecordingPackage } from 'src/app/common/recording/recording-package';

@Component({
  selector: 'app-run-import',
  templateUrl: './run-import.component.html',
  styleUrls: ['./run-import.component.scss']
})
export class RunImportComponent implements OnDestroy {

  phase: number = 0;

  usersCollection?: DbUsersCollection;
  players: number = this.run.getPlayerTeam(this._user.getMainUserId())?.players.length ?? 1;
  playerOptions: number[] = [1, 2, 3, 4, 5, 6];
  sameLevel: boolean = this.run.data.requireSameLevel;

  leaderboardPbs: number = 0; 
  leaderboardHasLoaded: boolean = false; 
  leaderboard: DbLeaderboard = new DbLeaderboard(this.run.data.category, this.sameLevel, this.players);
  leaderboardSource: MatTableDataSource<DbLeaderboardPb> = new MatTableDataSource();
  leaderboardColumns: string[] = ["position", "players", "time"];

  selectedTeamId: number = this.run.teams.length > 1 ? this.run.teams[this.run.teams.length - 1].id : 0;
  recordings: SelectableRecording[] = [];
  recordingsSource: MatTableDataSource<SelectableRecording> = new MatTableDataSource();
  recordingColumns: string[] = ["selected", "name", "time"];
  
  fileListener: any;
  downloadListener: any;
  
  constructor(@Inject(MAT_DIALOG_DATA) public run: Run, private _user: UserService, private _firestore: FireStoreService, private zone: NgZone, public dialogRef: MatDialogRef<RunImportComponent>) {
    
    this._firestore.getUsers().then(collection => {
      this.usersCollection = collection;
    });

    this.fileListener = (window as any).electron.receive("recordings-fetch-get", (data: RecordingFile) => {
      this.zone.run(() => {
        this.recordings = SelectableRecording.fromRecordingFile(data);
        this.recordingsSource = new MatTableDataSource(this.recordings);
        this.phase = 4;
      });
    });
    
    this.downloadListener = (window as any).electron.receive("recordings-download-get", (data: DbRecordingFile) => {
      this.zone.run(() => {
        this.recordings = SelectableRecording.fromDbRecording(data, this.usersCollection);
        this.recordingsSource = new MatTableDataSource(this.recordings);
        this.phase = 4;
      });
    });
  }

  gotoLeaderboardPhase() {
    this.phase = 1;
    this.updateContent();
  }

  changePlayerCount() {
    this.sameLevel = this.players === 1 ? false : this.run.data.requireSameLevel;
    this.updateContent();
  }

  updateContent() {
    const leaderboardSubscription = this._firestore.getLeaderboard(this.run.data.category, this.sameLevel, this.players).subscribe(dbLeaderboards => {
      leaderboardSubscription.unsubscribe();
      
      if (!dbLeaderboards || dbLeaderboards.length === 0)
        this.leaderboard = new DbLeaderboard(this.run.data.category, this.sameLevel, this.players);
      else
        this.leaderboard = Object.assign(new DbLeaderboard(dbLeaderboards[0].category, dbLeaderboards[0].sameLevel, dbLeaderboards[0].players), dbLeaderboards[0]);

      this.leaderboard.pbs = this.leaderboard.pbs.sort((a, b) => a.endTimeMs - b.endTimeMs);
      this.leaderboard.pbs.forEach((pb, index) => {
        this.leaderboard.pbs[index] = Object.assign(new DbLeaderboardPb(), pb);
        this.leaderboard.pbs[index].fillFrontendValues(this.usersCollection!, this._user.user.id, (index + 1));
      });

      let leaderboardPbs = this.leaderboard.pbs.filter(x => x.playbackAvailable);
      this.leaderboardSource = new MatTableDataSource(leaderboardPbs);
      this.leaderboardHasLoaded = true;
      this.leaderboardPbs = leaderboardPbs.length;
    });
  }

  selectRun(pb: DbLeaderboardPb) {
    this.phase = 3;
    const downloadSubscription = this._firestore.downloadRecording(pb.id ?? "").subscribe(found => {
     downloadSubscription.unsubscribe();
     if (!found)
      this._user.sendNotification("Failed to fetch recording.");
   });
  }

  
  onFilesDrop(files: FileList) {
    let recording: RecordingImport = new RecordingImport(files.item(0));
    if (recording) {
      this.phase = 3;
      (window as any).electron.send('recordings-fetch', recording.path);
    }
  }

  importRecordings() {
    this.dialogRef.close(new RecordingPackage(this.selectedTeamId, this.recordings.filter(x => x.selected)));
  }

  ngOnDestroy(): void {
    this.fileListener();
    this.downloadListener();
  }
}
