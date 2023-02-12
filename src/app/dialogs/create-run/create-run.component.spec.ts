import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRunComponent } from './create-run.component';

describe('CreateRunComponent', () => {
  let component: CreateRunComponent;
  let fixture: ComponentFixture<CreateRunComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateRunComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateRunComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
