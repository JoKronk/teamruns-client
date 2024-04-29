import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SnackbarImportComponent } from './snackbar-import.component';

describe('SnackbarImportComponent', () => {
  let component: SnackbarImportComponent;
  let fixture: ComponentFixture<SnackbarImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SnackbarImportComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnackbarImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
