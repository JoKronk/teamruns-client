import { Component, Input } from '@angular/core';
import { Timer } from '../../common/run/timer';

@Component({
  selector: 'app-run-timer',
  templateUrl: './run-timer.component.html',
  styleUrls: ['./run-timer.component.scss']
})
export class RunTimerComponent {
  
  @Input() timer: Timer | undefined;
  @Input() hideText: boolean = false;
  @Input() hideBorder: boolean = false;

  height: number = 80;

  constructor() {
    
  }
}
