import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunSpectatorsComponent } from './run-spectators.component';

describe('RunSpectatorsComponent', () => {
  let component: RunSpectatorsComponent;
  let fixture: ComponentFixture<RunSpectatorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RunSpectatorsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunSpectatorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
