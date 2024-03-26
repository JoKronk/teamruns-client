import { AfterViewInit, Component, NgZone, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { UserService } from '../../services/user.service';
import { Recording, SelectableRecording } from '../../common/socket/recording';
import { UserBase } from '../../common/user/user';
import { RunState } from '../../common/run/run-state';
import { RecordingImport } from '../../common/socket/recording-import';
import { Subscription } from 'rxjs';
import { MultiplayerState } from '../../common/opengoal/multiplayer-state';
import { RunHandler } from '../../common/run/run-handler';
import { FireStoreService } from '../../services/fire-store.service';
import { LocalPlayerData } from '../../common/user/local-player-data';
import { EventType } from '../../common/peer/event-type';
import { OgCommand } from '../../common/socket/og-command';
import pkg from 'app/package.json';
import { OG } from '../../common/opengoal/og';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-practice',
  templateUrl: './practice.component.html',
  styleUrls: ['./practice.component.scss']
})
export class PracticeComponent implements OnDestroy {

  runState = RunState;
  multiplayerStates = MultiplayerState;

  //checks
  recordingsState: MultiplayerState = MultiplayerState.interactive;
  loadOnRecord: string = "true";
  usePlayback: string = "true";
  resetWorld: string = "true";
  inFreecam: boolean = false;
  hasStoredCheckpoint: boolean = false;

  //replay
  replay: boolean = false;
  replayId: string = crypto.randomUUID();
  nextRecordingId: number = 1;
  currentRecording: string = "none";
  recordingBeingEdited: string | null = null;

  //recording mediaplayer
  recordingsEndtime: number = 0;
  recordingDragStart: number = 0;
  recordingPaused: boolean = false;
  recordingPausedBeforeDrag: boolean = false;

  //recordings
  imports: RecordingImport[] = [];
  recordings: SelectableRecording[] = [];
  dataSource: MatTableDataSource<SelectableRecording> = new MatTableDataSource(this.recordings);
  columns: string[] = ["player", "name", "time", "options"];

  //handlers
  runHandler: RunHandler;

  mainLocalPlayer: LocalPlayerData;

  //listeners
  fileListener: any;
  timerEndSubscription: Subscription;


  constructor(public _user: UserService, firestoreSerivce: FireStoreService, private dialog: MatDialog, private zone: NgZone) {
    this.mainLocalPlayer = new LocalPlayerData(this._user.user, OG.mainPort, zone);
    this._user.localUsers = [ this.mainLocalPlayer ];
    this.runHandler = new RunHandler(undefined, firestoreSerivce, _user, dialog, zone, true);
    this.mainLocalPlayer.socketHandler.timer.setStartConditions(1);

    //recording import listener
    this.fileListener = (window as any).electron.receive("recordings-get", (data: any) => {

      if (data.length === 0 || !data.version || !data.playback || !Array.isArray(data.playback)) {
        if (!this.checkTransformOldRecording(data))
          this._user.sendNotification("File was not recognized as a recording.");
        
        this.imports.shift();
        this.checkAddImport();
        return;
      }

      const recording: SelectableRecording = new SelectableRecording(crypto.randomUUID());
      recording.userId = recording.id;
      recording.playback = data.playback;
      recording.fillFrontendValues(data.displayName ?? this.imports[0].name);
      this.nextRecordingId += 1;
      this.recordings.push(recording);
      this.zone.run(() => {
        this.dataSource = new MatTableDataSource(this.recordings);
      });
      this.imports.shift();
      this.checkAddImport();

    });

    //timer end listener
    this.timerEndSubscription = this.mainLocalPlayer.socketHandler.timer.timerEndSubject.subscribe(ended => {
      this.stopPlaybackIfIsRunning();
    });
  }

  //!TODO: This should be deleted after current recordings have been migrated
  checkTransformOldRecording(data: any): boolean {
    if (Array.isArray(data) && data.length !== 0 && (data[0].transX !== undefined && data[0].quatW !== undefined && data[0].tgtState !== undefined)) {
      let rec: Recording = new Recording(crypto.randomUUID());
      for (let i = data.length - 1; i >= 0; i--)
        rec.addPositionData(data[i]);
      this.exportRecording(rec);
      return true;
    }
    return false;
  }

  startRecording() {
    this.stopPlaybackIfIsRunning();
    this.currentRecording = this.usePlayback === "true" ? "all" : "none";

    this.usePlayback === "true" ? this.playAllRecordings(false) : this.replayId = crypto.randomUUID();
    this.replay = false;

    if (this.resetWorld === "true" && this.usePlayback === "false")
      this.mainLocalPlayer.socketHandler.addCommand(OgCommand.ResetGame);
      

    if (this.inFreecam && this.loadOnRecord !== "true")
      this.toggleFreecam();

    if (this.loadOnRecord === "true") {
      this.loadCheckpoint();
      this.inFreecam = false;
    }

    this.runHandler.setupRunStart();
    this.mainLocalPlayer.socketHandler.timer.startTimer(null, null, false, !this.inFreecam);
  }

  stopRecording() {
    const saveRecording = this.mainLocalPlayer.socketHandler.timer.totalMs > 0;

    this.stopPlaybackIfIsRunning();
    this.mainLocalPlayer.socketHandler.resetGetRecordings().forEach(recording => {
      if (saveRecording) {
        recording.fillFrontendValues("Rec-" + this.nextRecordingId);
        this.nextRecordingId += 1;
        (recording as SelectableRecording).selected = true;
        this.recordings.push(recording as SelectableRecording);
      }
    });
    this.dataSource = new MatTableDataSource(this.recordings);
  }

  storeCheckpoint() {
    this.mainLocalPlayer.socketHandler.addCommand(OgCommand.TempCheckpointStore);
    this.hasStoredCheckpoint = true;
  }

  loadCheckpoint() {
    this.mainLocalPlayer.socketHandler.addCommand(OgCommand.TempCheckpointLoad);
  }

  toggleFreecam() {
    if (!this.inFreecam) {
      if (!this.hasStoredCheckpoint)
        this.storeCheckpoint();

      this.mainLocalPlayer.socketHandler.addCommand(OgCommand.FreeCamEnter);
    }
    else {
      this.loadCheckpoint();
      this.mainLocalPlayer.socketHandler.addCommand(OgCommand.FreeCamExit);
    }
    this.inFreecam = !this.inFreecam;
  }

  exportRecording(recording: Recording) {
    const url = URL.createObjectURL(recording.exportRecordingToBlob(pkg.version));
    const link = document.createElement('a');
    link.download = recording.nameFrontend + '.json';
    link.href = url;
    link.click();
  }

  deleteRecording(id: string) {
    this.recordings = this.recordings.filter(x => x.id !== id);
    this.dataSource = new MatTableDataSource(this.recordings);
  }



  shiftPlaybackStart() {
    this.recordingPausedBeforeDrag = this.recordingPaused;
    if (!this.recordingPausedBeforeDrag)
      this.pause();

    this.recordingDragStart = this.mainLocalPlayer.socketHandler.timer.totalMs;
  }

  shiftPlaybackEnd() {
    this.mainLocalPlayer.socketHandler.timer.shiftTimerByMs(this.recordingDragStart - this.mainLocalPlayer.socketHandler.timer.totalMs);
    this.recordingDragStart = 0;

    if (!this.recordingPausedBeforeDrag)
    this.pause();
  }

  pause() {
    this.mainLocalPlayer.socketHandler.timer.togglePause();
    this.recordingPaused = this.mainLocalPlayer.socketHandler.timer.isPaused();
  }


  playRecording(id: string) {
    const rec = this.recordings.find(x => x.id === id);
    if (!rec) return;

    this.stopPlaybackIfIsRunning();
    this.startPlayback([rec], true);
  }

  playAllRecordings(selfStop: boolean = true) {
    if (this.stopPlaybackIfIsRunning()) return;
    this.startPlayback(this.recordings.filter(x => x.selected), selfStop);
  }

  startPlayback(giveRecordings: Recording[], selfStop: boolean) {
    this.replay = true;
    this.replayId = crypto.randomUUID();

    this.runHandler.run?.checkForRunReset(true);
    this.mainLocalPlayer.socketHandler.resetGetRecordings();
    this.currentRecording = giveRecordings.length === 1 ? giveRecordings[0].id : "all";

    giveRecordings.forEach((rec, index) => {
      const recordingUser = new UserBase(rec.id, rec.nameFrontend ?? "");
      this.runHandler.sendEvent(EventType.Connect, rec.id, recordingUser);
      this.runHandler.sendEvent(EventType.ChangeTeam, rec.id, 0);
      this.mainLocalPlayer.socketHandler.addRecording(rec, recordingUser, this.recordingsState);
    });

    this.recordingsEndtime = this.getLongestRecordingTimeMs(giveRecordings);

    if (this.resetWorld === "true")
      this.mainLocalPlayer.socketHandler.addCommand(OgCommand.ResetGame);

    this.runHandler.setupRunStart();
    this.mainLocalPlayer.socketHandler.timer.startTimer(undefined, selfStop && giveRecordings.length !== 0 ? this.recordingsEndtime : null, false, !this.inFreecam);
    this.mainLocalPlayer.socketHandler.startDrawPlayers();
  }

  stopPlaybackIfIsRunning(): boolean {
    if (this.mainLocalPlayer.socketHandler.timer.runState !== RunState.Waiting) {
      this.mainLocalPlayer.socketHandler.timer.reset();

      this.mainLocalPlayer.socketHandler.recordings.forEach(rec => {
        this.runHandler.sendEvent(EventType.Disconnect, rec.userId, new UserBase(rec.userId, rec.nameFrontend ?? ""));
      });

      this.mainLocalPlayer.socketHandler.stopDrawPlayers();
      this.recordingPaused = false;
      this.replay = false;
      return true;
    }
    return false;
  }

  getLongestRecordingTimeMs(recordings: Recording[]): number {
    if (recordings.length === 0) return 0;

    let longest: number = recordings[0].playback[0].t;

    for (var i = 0; i < recordings.length; i++) {
      if (recordings[i].playback[0].t > longest) {
        longest = recordings[i].playback[0].t;
      }
    }

    return longest;
  }


  //--- IMPORT HANDLING ---
  onFilesDrop(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      this.imports.push(new RecordingImport(files.item(i)));
    }
    this.checkAddImport();
  }

  importRecordings(event: any) {
    this.onFilesDrop(event.target.files);
  }

  checkAddImport() {
    if (this.imports.length != 0)
      (window as any).electron.send('recordings-fetch', this.imports[0].path);
  }



  ngOnDestroy(): void {
    if (this.inFreecam)
      this.toggleFreecam();

    this.fileListener();
    this.timerEndSubscription.unsubscribe();
    this.runHandler.destroy();
  }

}
