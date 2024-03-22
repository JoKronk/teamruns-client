import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunTimerComponent } from './run-timer.component';

describe('RunTimerComponent', () => {
  let component: RunTimerComponent;
  let fixture: ComponentFixture<RunTimerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RunTimerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunTimerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
