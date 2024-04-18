import { AfterViewInit, Component, NgZone, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { UserService } from '../../services/user.service';
import { Recording } from '../../common/recording/recording';
import { SelectableRecording } from 'src/app/common/recording/selectable-recording';
import { UserBase } from '../../common/user/user';
import { RunState } from '../../common/run/run-state';
import { RecordingImport } from '../../common/recording/recording-import';
import { Subscription } from 'rxjs';
import { MultiplayerState } from '../../common/opengoal/multiplayer-state';
import { RunHandler } from '../../common/run/run-handler';
import { FireStoreService } from '../../services/fire-store.service';
import { LocalPlayerData } from '../../common/user/local-player-data';
import { EventType } from '../../common/peer/event-type';
import { OgCommand } from '../../common/socket/og-command';
import { OG } from '../../common/opengoal/og';
import { MatDialog } from '@angular/material/dialog';
import { RecordingFile } from 'src/app/common/recording/recording-file';
import { RecordingPackage } from 'src/app/common/recording/recording-package';

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
  loadOnRecord: string = "false";
  usePlayback: string = "true";
  resetWorld: string = "true";
  inFreecam: boolean = false;
  hasStoredCheckpoint: boolean = false;

  //replay
  replay: boolean = false;
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

  mainLocalPlayer: LocalPlayerData | undefined;
  timerInWait: boolean = true;

  //listeners
  fileListener: any;
  timerStateSubscription: Subscription;
  runSetupSubscription: Subscription;


  constructor(public _user: UserService, firestoreSerivce: FireStoreService, private dialog: MatDialog, private zone: NgZone) {

    this.runHandler = new RunHandler(undefined, firestoreSerivce, _user, dialog, zone, true);
    this.runSetupSubscription = this.runHandler.runSetupCompleteSubject.subscribe(runData => {
      if (!runData || !this.runHandler.run || this.mainLocalPlayer) return;
      
      this.mainLocalPlayer = new LocalPlayerData(this._user.user, OG.mainPort, this.runHandler.run, this.zone);
      this._user.resetLocalPlayersToNewMain(this.mainLocalPlayer);
      this.runHandler.run.timer.setStartConditions(1);
      

      //timer end listener
      this.timerStateSubscription = this.mainLocalPlayer.socketHandler.timer.timerSubject.subscribe(state => {
        this.timerInWait = state === RunState.Waiting;
        
        if (state === RunState.Ended)
          this.stopPlaybackIfIsRunning();
      });
    });



    //recording import listener
    this.fileListener = (window as any).electron.receive("recordings-fetch-get", (data: RecordingFile) => {
      
      SelectableRecording.fromRecordingFile(data).forEach(recording => {
        this.recordings.push(recording);
      });

      this.zone.run(() => {
        this.dataSource = new MatTableDataSource(this.recordings);
      });

      this.imports.shift();
      this.checkAddImport();

    });
  }

  startRecording() {
    if (!this.mainLocalPlayer) return;
    this.stopPlaybackIfIsRunning();
    this.currentRecording = this.usePlayback === "true" ? "all" : "none";

    if (this.usePlayback === "true")
      this.playAllRecordings(false, false);

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
    this.mainLocalPlayer.socketHandler.timer.startTimer(null, null);
  }

  stopRecording() {
    if (!this.mainLocalPlayer) return;
    const saveRecording = this.mainLocalPlayer.socketHandler.timer.totalMs > 0;

    this.stopPlaybackIfIsRunning();
    this.mainLocalPlayer.socketHandler.resetGetRecordings().forEach(recording => {
      if (saveRecording) {
        recording.username = "Rec-" + this.nextRecordingId;
        this.nextRecordingId += 1;
        let newRecording = SelectableRecording.fromRecordingBase(recording);
        newRecording.fillFrontendValues();
        this.recordings.push(newRecording);
      }
    });
    this.dataSource = new MatTableDataSource(this.recordings);
  }

  storeCheckpoint() {
    if (!this.mainLocalPlayer) return;
    this.mainLocalPlayer.socketHandler.addCommand(OgCommand.TempCheckpointStore);
    this.hasStoredCheckpoint = true;
  }

  loadCheckpoint() {
    if (!this.mainLocalPlayer) return;
    this.mainLocalPlayer.socketHandler.addCommand(OgCommand.TempCheckpointLoad);
  }

  toggleFreecam() {
    if (!this.mainLocalPlayer) return;
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

  deleteRecording(id: string) {
    this.recordings = this.recordings.filter(x => x.id !== id);
    this.dataSource = new MatTableDataSource(this.recordings);
  }



  shiftPlaybackStart() {
    if (!this.mainLocalPlayer) return;
    this.recordingPausedBeforeDrag = this.recordingPaused;
    if (!this.recordingPausedBeforeDrag)
      this.pause();

    this.recordingDragStart = this.mainLocalPlayer.socketHandler.timer.totalMs;
  }

  shiftPlaybackEnd() {
    if (!this.mainLocalPlayer) return;
    this.mainLocalPlayer.socketHandler.timer.shiftTimerByMs(this.recordingDragStart - this.mainLocalPlayer.socketHandler.timer.totalMs);
    this.recordingDragStart = 0;

    if (!this.recordingPausedBeforeDrag)
    this.pause();
  }

  pause() {
    if (!this.mainLocalPlayer) return;
    this.mainLocalPlayer.socketHandler.timer.togglePause();
    this.recordingPaused = this.mainLocalPlayer.socketHandler.timer.isPaused();
  }


  playRecording(id: string) {
    const rec = this.recordings.find(x => x.id === id);
    if (!rec) return;

    this.stopPlaybackIfIsRunning();
    this.startPlayback([rec], true, true);
  }

  playAllRecordings(selfStop: boolean = true, startTimerFromPlayback: boolean = true) {
    if (this.stopPlaybackIfIsRunning()) return;
    this.startPlayback(this.recordings.filter(x => x.selected), selfStop, startTimerFromPlayback);
  }

  startPlayback(giveRecordings: Recording[], selfStop: boolean, startTimer: boolean) {
    if (!this.mainLocalPlayer) return;
    this.replay = true;

    this.runHandler.run?.checkForRunReset(true);
    this.runHandler.removeAllSelfRecordings();
    this.currentRecording = giveRecordings.length === 1 ? giveRecordings[0].id : "all";

    this.runHandler.importRecordingsFromLocal(new RecordingPackage(0, giveRecordings, this.recordingsState));

    this.recordingsEndtime = this.getLongestRecordingTimeMs(giveRecordings);

    if (this.resetWorld === "true")
      this.mainLocalPlayer.socketHandler.addCommand(OgCommand.ResetGame);

    this.runHandler.setupRunStart();
    if (startTimer)
      this.mainLocalPlayer.socketHandler.timer.startTimer(undefined, selfStop && giveRecordings.length !== 0 ? this.recordingsEndtime : null);

    this.mainLocalPlayer.socketHandler.startDrawPlayers();
  }

  stopPlaybackIfIsRunning(): boolean {
    if (!this.mainLocalPlayer) return false;

    if (this.mainLocalPlayer.socketHandler.timer.runState !== RunState.Waiting) {
      this.mainLocalPlayer.socketHandler.timer.reset();

      this.mainLocalPlayer.socketHandler.recordings.forEach(rec => {
        this.runHandler.sendEvent(EventType.Disconnect, rec.id, new UserBase(rec.id, rec.username ?? ""));
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
    if (this.runSetupSubscription) this.runSetupSubscription.unsubscribe();
    if (this.timerStateSubscription) this.timerStateSubscription.unsubscribe();
    this.runHandler.destroy();
  }

}
