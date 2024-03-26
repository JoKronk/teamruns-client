import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunCasualComponent } from './run-casual.component';

describe('RunCasualComponent', () => {
  let component: RunCasualComponent;
  let fixture: ComponentFixture<RunCasualComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RunCasualComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunCasualComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
