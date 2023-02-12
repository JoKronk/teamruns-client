import { Component, NgZone } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Player } from '../common/player/player';
import { State } from '../common/player/state';
import { User } from '../common/player/user';
import { Run } from '../common/run/run';
import { Task } from '../common/run/task';
import { UserService } from '../services/user.service';
import pkg from 'app/package.json';

@Component({
  selector: 'app-run',
  templateUrl: './run.component.html',
  styleUrls: ['./run.component.scss']
})
export class RunComponent {

  buildVersion: string = pkg.version;
  run: Run | undefined;
  ready: boolean = false;
  wantsToReset: boolean = false;

  constructor(public _user: UserService, private route: ActivatedRoute, private zone: NgZone) {
    //let name: string = this.route.snapshot.paramMap.get('name')!;
    this.setupListeners();

    let localRun = _user.getLocalRunStorage();
    if (localRun)
      this.run = localRun;

    this.getInitPlayerState();
  }

  toggleReady() {
    this.ready = !this.ready;
    this._user._goal.runCommand("(send-event *target* 'loading)");
    this.run!.toggleReady(this._user.getName(), this.ready);

    //check if everyone is ready, send start call if so
    if (this.run!.everyIsReady()) {
      this.run!.start(new Date());
    }
  }

  toggleReset() {
    this.wantsToReset = !this.wantsToReset;
    if (this.run!.toggleVoteReset(this._user.getName(), this.wantsToReset)) {
      this._user._goal.runCommand("(send-event *target* 'loading)");
      this.ready = false;
      this.wantsToReset = false;
    }
  }

  getRun() { //get route param and get run from id, set current player afterwards if loaded in first

  }

  setupListeners() {
    //handles refreshing
    (window as any).electron.receive("settings-get", (data: User) => {
      if (this.run) { //set user if run loaded in first
        this.run.addNewPlayer(new Player(this._user.getName()));
      }
    });

    //state update
    (window as any).electron.receive("og-state-update", (state: State) => {
      this.zone.run(() => {
        if (this.run)
          this.run.updateState(this._user.getName(), state);
        //send api call for state update
      });
    });

    //on task get
    (window as any).electron.receive("og-task-update", (task: string) => {
      this.zone.run(() => {
        if (Task.isCell(task) && this.run && this.run.timer.runHasStarted) {
          var cell = new Task(task, this._user.getName(), this.run.getTimerShortenedFormat());
          this.run.addSplit(cell);
        }
        //send api call for cell obtain!
      });
    });
  }

  //state read
  getInitPlayerState(): void {
    (window as any).electron.send('og-state-read');
  }

}
