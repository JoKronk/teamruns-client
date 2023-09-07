import { AfterViewInit, Component, NgZone, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { UserService } from '../services/user.service';
import { PositionData, UserPositionDataTimestamp } from '../common/playback/position-data';
import { Timer } from '../common/run/timer';
import { PositionHandler } from '../common/playback/position-handler';
import { DbUserPositionData } from '../common/playback/db-user-position-data';
import { UserBase } from '../common/user/user';
import { RunState } from '../common/run/run-state';
import { OG } from '../common/opengoal/og';
import { MatDialog } from '@angular/material/dialog';
import { ImportFileComponent } from '../dialogs/import-file/import-file.component';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.component.html',
  styleUrls: ['./practice.component.scss']
})
export class PracticeComponent implements OnDestroy {

  runState = RunState;
  timer: Timer = new Timer(1, false);
  positionHandler: PositionHandler;

  positionListener: any;

  loadOnRecord: string = "false";
  usePlayback: string = "true";

  replay: boolean = false;
  replayId: string = crypto.randomUUID();
  nextRecordingId: number = 1;
  currentRecording: string = "none";

  recordings: DbUserPositionData[] = [];
  dataSource: MatTableDataSource<DbUserPositionData> = new MatTableDataSource(this.recordings);
  columns: string[] = ["player", "time", "options"];


  constructor(public _user: UserService, private dialog: MatDialog, private zone: NgZone) {
    this.positionHandler = new PositionHandler(_user);

    this.positionListener = (window as any).electron.receive("og-position-update", (target: PositionData) => {
      if (this.timer.totalMs === 0) return;
        this.positionHandler.updatePosition(new UserPositionDataTimestamp(target, this.timer.totalMs, this._user.getId()));
    });
  }

  startRecording() {
    this.checkStop();
    this.currentRecording = this.usePlayback === "true" ? "all" : "none";

    this.usePlayback === "true" ? this.playAllRecordings(false) : this.replayId = crypto.randomUUID();
    this.replay = false;

    if (this.loadOnRecord === "true")
      this.loadCheckpoint();

    this.timer.startTimer();
  }

  stopRecording() {
    const saveRecording = this.timer.totalMs > 0;

    this.checkStop();
    this.positionHandler.resetGetRecordings().forEach(recording => {
      if (saveRecording) {
        recording.fillFrontendValues("Recording-" + this.nextRecordingId);
        this.nextRecordingId += 1;
        this.recordings.push(recording);
      }
    });
    this.dataSource = new MatTableDataSource(this.recordings);
  }

  storeCheckpoint() {
    OG.runCommand("(store-temp-checkpoint)");
  }

  loadCheckpoint() {
    OG.runCommand("(spawn-temp-checkpoint)");
  }

  importRecording() {
    const dialogRef = this.dialog.open(ImportFileComponent, { data: "Recording-" + this.nextRecordingId });
    const dialogSubscription = dialogRef.afterClosed().subscribe(recording => {
      dialogSubscription.unsubscribe();
      if (!recording) return;
      if (typeof recording === 'string') this._user.sendNotification(recording);
      
      this.nextRecordingId += 1;
      this.recordings.push(recording);
      this.zone.run(() => {
        this.dataSource = new MatTableDataSource(this.recordings);
      });
    });
  }

  exportRecording(recording: DbUserPositionData) {
    const fileData = JSON.stringify(recording.playback);
    const blob = new Blob([fileData], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'recording.json';
    link.href = url;
    link.click();
  }


  deleteRecording(id: string) {
    this.recordings = this.recordings.filter(x => x.id !== id);
    this.dataSource = new MatTableDataSource(this.recordings);
  }

  playRecording(id: string) {
    const rec = this.recordings.find(x => x.id === id);
    if (!rec) return;

    this.checkStop();
    this.startPlayback([rec], true);
  }

  playAllRecordings(selfStop: boolean = true) {
    if (this.checkStop()) return;
    this.startPlayback(this.recordings, selfStop);
  }


  startPlayback(giveRecordings: DbUserPositionData[], selfStop: boolean) {
    this.replay = true;
    this.replayId = crypto.randomUUID();
    const startId = this.replayId;

    this.positionHandler.resetGetRecordings();
    this.currentRecording = giveRecordings.length === 1 ? giveRecordings[0].id : "all";
    giveRecordings.forEach((rec, index) => {
      this.positionHandler.addRecording(rec, new UserBase(rec.id, rec.nameFrontend ?? "Name not found"));
    })

    const longestRecordingTime = this.getLongestRecordingTime(giveRecordings);

    if (selfStop && giveRecordings.length !== 0) {
      setTimeout(() => {
        if (this.replayId === startId)
          this.checkStop();
      }, longestRecordingTime + (this.timer.countdownSeconds * 1000) - 1000);
    }

    this.timer.startTimer();
  }

  checkStop(): boolean {
    if (this.timer.runState !== RunState.Waiting) {
      this.timer.reset();
      this.positionHandler.onTimerReset();
      return true;
    }
    return false;
  }

  getLongestRecordingTime(recordings: DbUserPositionData[]): number {
    if (recordings.length === 0) return 0;

    let longest: number = recordings[0].playback[0].time;

    for (var i = 0; i < recordings.length; i++) {
      if (recordings[i].playback[0].time > longest) {
        longest = recordings[i].playback[0].time;
      }
    }

    return longest;
  }

  ngOnDestroy(): void {
    this.positionListener();
    this.positionHandler.destroy();
  }

}
