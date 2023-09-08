import { Injectable } from '@angular/core';
import { RunState } from '../common/run/run-state';
import { Timer } from '../common/run/timer';
import { OG } from '../common/opengoal/og';

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  time: string;
  timeMs: string;
  startDateMs: number | null;
  countdownSeconds: number = 15;
  totalMs: number = 0;
  spawnInGeyserOnZero: boolean = true;

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
    this.spawnInGeyserOnZero = timer.spawnInGeyserOnZero;
    this.runState = timer.runState;
    this.resetEverything = timer.resetEverything;
  }

  setStartConditions(countdownSeconds: number, spawnInGeyserOnZero: boolean = true) {
    this.countdownSeconds = countdownSeconds;
    this.spawnInGeyserOnZero = spawnInGeyserOnZero;
    this.resetTimer();
  }
  
  reset() {
    if (this.runIsOngoing())
      this.resetEverything = true;
    else
      this.resetTimer();
  }

  runIsOngoing() {
    return this.runState === RunState.Countdown || this.runState === RunState.Started;
  }

  private resetTimer() {
    this.startDateMs = null;
    this.runState = RunState.Waiting;
    this.time = "-0:00:" + ("0" + this.countdownSeconds).slice(-2);
    this.timeMs = ".0";
    this.totalMs = 0;
  }

  startTimer(startDateMs: number | undefined = undefined) {
    this.resetEverything = false;

    if (!startDateMs) {
      let startDate = new Date();
      startDate.setSeconds(startDate.getSeconds() + (this.countdownSeconds > 0 ? (this.countdownSeconds - 1) : this.countdownSeconds));
      startDateMs = startDate.getTime();
    }
    this.startDateMs = startDateMs;
    this.runState = RunState.Countdown;
    this.updateTimer();
  }



  async updateTimer(hasSpawnedPlayer: boolean = false) { //parameter as we can't store local player data in run model currently
    if (this.runState === RunState.Ended)
      return;

    var currentTimeMs = new Date().getTime();

    //start run check
    if (this.runState === RunState.Countdown) {
      if (this.spawnInGeyserOnZero && !hasSpawnedPlayer && this.startDateMs! <= currentTimeMs + 1400) {
        OG.startRun();
        hasSpawnedPlayer = true;
      }
      if (this.startDateMs! <= currentTimeMs)
        this.runState = RunState.Started;
    }


    this.totalMs = currentTimeMs - this.startDateMs!;

    this.time = this.runState === RunState.Started
      ? (Timer.msToTimeFormat(this.totalMs))
      : ("-0:00:" + Timer.getSecond(this.totalMs));

    this.timeMs = "." + this.getMs(this.totalMs);

    await new Promise(r => setTimeout(r, 100));

    if (this.resetEverything)
      this.resetTimer();
    else
      this.updateTimer(hasSpawnedPlayer);
  }

  private getMs(ms: number): number {
    return this.runState === RunState.Started ? Math.trunc(Math.floor((ms % 1000)) / 100) : Math.trunc(Math.abs(Math.floor((ms % 1000)) / 100));
  }
}
