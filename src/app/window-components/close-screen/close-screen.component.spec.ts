import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloseScreenComponent } from './close-screen.component';

describe('CloseScreenComponent', () => {
  let component: CloseScreenComponent;
  let fixture: ComponentFixture<CloseScreenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CloseScreenComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CloseScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
