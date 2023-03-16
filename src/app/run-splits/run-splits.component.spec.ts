import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunSplitsComponent } from './run-splits.component';

describe('RunSplitsComponent', () => {
  let component: RunSplitsComponent;
  let fixture: ComponentFixture<RunSplitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RunSplitsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunSplitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
