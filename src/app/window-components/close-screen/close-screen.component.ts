import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-close-screen',
  templateUrl: './close-screen.component.html',
  styleUrls: ['./close-screen.component.scss']
})
export class CloseScreenComponent implements AfterViewInit {

  constructor() {

  }

  //works as a unified spot for closing the app if something needs to be done frontend side
  //convinent also for always making sure ngDestroy is ran in components
  ngAfterViewInit(): void {
    if ((window as any).electron)
      (window as any).electron.send('window-close');
  }
}
