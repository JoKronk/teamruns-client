import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunTeamComponent } from './run-team.component';

describe('RunTeamComponent', () => {
  let component: RunTeamComponent;
  let fixture: ComponentFixture<RunTeamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RunTeamComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunTeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
