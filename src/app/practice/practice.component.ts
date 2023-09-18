import { AfterViewInit, Component, NgZone, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { UserService } from '../services/user.service';
import { PositionData, UserPositionDataTimestamp } from '../common/playback/position-data';
import { Recording } from '../common/playback/recording';
import { UserBase } from '../common/user/user';
import { RunState } from '../common/run/run-state';
import { OG } from '../common/opengoal/og';
import { MatDialog } from '@angular/material/dialog';
import { ImportFileComponent } from '../dialogs/import-file/import-file.component';
import { PositionService } from '../services/position.service';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.component.html',
  styleUrls: ['./practice.component.scss']
})
export class PracticeComponent {

  runState = RunState;

  loadOnRecord: string = "false";
  usePlayback: string = "true";

  replay: boolean = false;
  replayId: string = crypto.randomUUID();
  nextRecordingId: number = 1;
  currentRecording: string = "none";
  recordingBeingEdited: string | null = null;

  recordings: Recording[] = [];
  dataSource: MatTableDataSource<Recording> = new MatTableDataSource(this.recordings);
  columns: string[] = ["player", "name", "time", "options"];


  constructor(public _user: UserService, public positionHandler: PositionService, private dialog: MatDialog, private zone: NgZone) {
    this.positionHandler.timer.setStartConditions(1, false);
  }

  startRecording() {
    this.checkStop();
    this.currentRecording = this.usePlayback === "true" ? "all" : "none";

    this.usePlayback === "true" ? this.playAllRecordings(false) : this.replayId = crypto.randomUUID();
    this.replay = false;

    if (this.loadOnRecord === "true")
      this.loadCheckpoint();

    this.positionHandler.timer.startTimer();
  }

  stopRecording() {
    const saveRecording = this.positionHandler.timer.totalMs > 0;

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

  exportRecording(recording: Recording) {
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


  startPlayback(giveRecordings: Recording[], selfStop: boolean) {
    this.replay = true;
    this.replayId = crypto.randomUUID();
    const startId = this.replayId;

    this.positionHandler.resetGetRecordings();
    this.currentRecording = giveRecordings.length === 1 ? giveRecordings[0].id : "all";
    giveRecordings.forEach((rec, index) => {
      this.positionHandler.addRecording(rec, new UserBase(rec.id, " "));
    })

    const longestRecordingTime = this.getLongestRecordingTime(giveRecordings);

    if (selfStop && giveRecordings.length !== 0) {
      setTimeout(() => {
        if (this.replayId === startId)
          this.checkStop();
      }, longestRecordingTime + (this.positionHandler.timer.countdownSeconds * 1000) - 1000);
    }

    this.positionHandler.timer.startTimer();
    this.positionHandler.startDrawPlayers();
  }

  checkStop(): boolean {
    if (this.positionHandler.timer.runState !== RunState.Waiting) {
      this.positionHandler.timer.reset();
      this.positionHandler.stopDrawPlayers();
      return true;
    }
    return false;
  }

  getLongestRecordingTime(recordings: Recording[]): number {
    if (recordings.length === 0) return 0;

    let longest: number = recordings[0].playback[0].time;

    for (var i = 0; i < recordings.length; i++) {
      if (recordings[i].playback[0].time > longest) {
        longest = recordings[i].playback[0].time;
      }
    }

    return longest;
  }

}
