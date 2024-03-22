import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SnackbarInstallComponent } from './snackbar-install.component';

describe('SnackbarInstallComponent', () => {
  let component: SnackbarInstallComponent;
  let fixture: ComponentFixture<SnackbarInstallComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SnackbarInstallComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnackbarInstallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
