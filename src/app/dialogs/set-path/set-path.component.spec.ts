import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetPathComponent } from './set-path.component';

describe('SetPathComponent', () => {
  let component: SetPathComponent;
  let fixture: ComponentFixture<SetPathComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SetPathComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetPathComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
