import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObsRunComponent } from './obs-run.component';

describe('ObsRunComponent', () => {
  let component: ObsRunComponent;
  let fixture: ComponentFixture<ObsRunComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ObsRunComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ObsRunComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
