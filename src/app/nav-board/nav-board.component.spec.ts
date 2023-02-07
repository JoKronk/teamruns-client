import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavBoardComponent } from './nav-board.component';

describe('NavBoardComponent', () => {
  let component: NavBoardComponent;
  let fixture: ComponentFixture<NavBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NavBoardComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
