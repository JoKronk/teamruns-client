import { Component, Input } from '@angular/core';
import { Timer } from '../common/run/timer';
import { TimerService } from '../services/timer.service';

@Component({
  selector: 'app-run-timer',
  templateUrl: './run-timer.component.html',
  styleUrls: ['./run-timer.component.scss']
})
export class RunTimerComponent {
  
  @Input() hideText: boolean = false;
  @Input() hideBorder: boolean = false;

  height: number = 80;

  constructor(public timer: TimerService) {
    
  }
}
