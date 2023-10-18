import { Injectable, OnDestroy } from '@angular/core';
import { RunState } from '../common/run/run-state';
import { Timer } from '../common/run/timer';
import { OG } from '../common/opengoal/og';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TimerService implements OnDestroy {

  time: string;
  timeMs: string;
  countdownSeconds: number = 15;

  totalMs: number = 0;
  startDateMs: number | null;
  private pauseDateMs: number | null = null;
  private endTimeMs: number | null = null;

  private timerUpdateRateMs: number = 10;

  hasSpawnedPlayer: boolean = false;
  timerEndSubject: Subject<boolean> = new Subject();

  freezePlayerInCountdown: boolean = true;
  runState: RunState;

  private resetEverything: boolean = false; //used to flag a reset to the update cycle

  constructor() {
    this.resetTimer();
  }
  
  importTimer(timer: TimerService) {
    this.time = timer.time;
    this.timeMs = timer.timeMs;
    this.startDateMs = timer.startDateMs;
    this.countdownSeconds = timer.countdownSeconds;
    this.totalMs = timer.totalMs;
    this.runState = timer.runState;
    this.resetEverything = timer.resetEverything;
  }

  setStartConditions(countdownSeconds: number, freezeWhileInCountdown: boolean = true) {
    this.freezePlayerInCountdown = freezeWhileInCountdown;
    this.countdownSeconds = countdownSeconds;
    this.resetTimer();
  }

  reset() {
    if (this.runIsOngoing())
      this.resetEverything = true;
    else
      this.resetTimer();
  }

  togglePause() { //!NOTE: Don't know if this can be relied up in runs due to start time ms dependancies, check before usage there
    if (!this.startDateMs) return;

    if (!this.pauseDateMs)
      this.pauseDateMs = new Date().getTime();
    else {
      var currentTimeMs = new Date().getTime();
      this.startDateMs += (currentTimeMs - this.pauseDateMs);
      this.pauseDateMs = null;
    }
  }

  onPlayerLoad() {
    if (this.runState === RunState.Countdown && this.freezePlayerInCountdown)
      OG.runCommand("(process-grab? *target*)");
  }

  isPaused() {
    return this.pauseDateMs !== null;
  }

  runIsOngoing() {
    return this.runState === RunState.Countdown || this.runState === RunState.Started;
  }

  shiftTimerByMs(ms: number) {
    if (this.startDateMs)
      this.startDateMs += ms;
  }

  private resetTimer() {
    this.startDateMs = null;
    this.hasSpawnedPlayer = false;
    this.pauseDateMs = null;
    this.runState = RunState.Waiting;
    this.time = "-0:00:" + ("0" + this.countdownSeconds).slice(-2);
    this.timeMs = ".0";
    this.totalMs = 0;
  }

  startTimer(startDateMs: number | undefined = undefined, spawnInGeyser: boolean = true, endTimeMs: number | null = null) {
    this.resetEverything = false;

    if (!startDateMs) {
      let startDate = new Date();
      startDate.setSeconds(startDate.getSeconds() + (this.countdownSeconds > 0 ? (this.countdownSeconds - 1) : this.countdownSeconds));
      startDateMs = startDate.getTime();
    }
    this.startDateMs = startDateMs;
    this.endTimeMs = endTimeMs;
    this.runState = RunState.Countdown;

    if (!spawnInGeyser)
      this.hasSpawnedPlayer = true;
    
    this.updateTimer();
  }



  async updateTimer() {
    if (this.runState === RunState.Ended)
      return;

    var currentTimeMs = new Date().getTime();


    //start run check
    if (this.runState === RunState.Countdown) {
      if (!this.hasSpawnedPlayer && this.startDateMs! <= currentTimeMs + 1400) {
        OG.runCommand("(safe-release-from-grab)");
        OG.startRun();
        this.hasSpawnedPlayer = true;
      }
      else if (this.hasSpawnedPlayer && this.startDateMs! <= currentTimeMs + 10)
        OG.runCommand("(safe-release-from-grab)");
      
      if (this.startDateMs! <= currentTimeMs)
        this.runState = RunState.Started;
    }

    const newTotalTimeMs = currentTimeMs - this.startDateMs!
    const updateText: boolean = Math.floor(newTotalTimeMs / 100) !== Math.floor(this.totalMs / 100);

    if (!this.pauseDateMs)
      this.totalMs = newTotalTimeMs;
      

    //only update text if timer has increased by .1
    if (updateText) {
      this.time = this.runState === RunState.Started ? (Timer.msToTimeFormat(this.totalMs)) : ("-0:00:" + Timer.getSecond(this.totalMs));
      this.timeMs = "." + this.getMs(this.totalMs);
    }

    
    if (!this.endTimeMs || this.endTimeMs >= this.totalMs)
      await new Promise(r => setTimeout(r, this.timerUpdateRateMs));
    else {
      this.timerEndSubject.next(true);
      this.resetEverything = true;
    }

    if (this.resetEverything)
      this.resetTimer();
    else
      this.updateTimer();
  }



  private getMs(ms: number): number {
    return this.runState === RunState.Started ? Math.trunc(Math.floor((ms % 1000)) / 100) : Math.trunc(Math.abs(Math.floor((ms % 1000)) / 100));
  }

  ngOnDestroy(): void {
    this.reset();
  }
}
