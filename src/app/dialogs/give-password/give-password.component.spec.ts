import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GivePasswordComponent } from './give-password.component';

describe('GivePasswordComponent', () => {
  let component: GivePasswordComponent;
  let fixture: ComponentFixture<GivePasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GivePasswordComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GivePasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
