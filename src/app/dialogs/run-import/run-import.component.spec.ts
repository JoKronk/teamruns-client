import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RunImportComponent } from './run-import.component';

describe('RunImportComponent', () => {
  let component: RunImportComponent;
  let fixture: ComponentFixture<RunImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RunImportComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RunImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
