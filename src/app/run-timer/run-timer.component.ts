import { Component, Input } from '@angular/core';
import { Run } from '../common/run/run';

@Component({
  selector: 'app-run-timer',
  templateUrl: './run-timer.component.html',
  styleUrls: ['./run-timer.component.scss']
})
export class RunTimerComponent {
  
  @Input() run: Run | undefined;

}
