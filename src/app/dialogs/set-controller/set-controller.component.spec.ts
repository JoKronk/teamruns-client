import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetControllerComponent } from './set-controller.component';

describe('SetControllerComponent', () => {
  let component: SetControllerComponent;
  let fixture: ComponentFixture<SetControllerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SetControllerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
