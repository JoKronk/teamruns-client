import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlinePlayersComponent } from './online-players.component';

describe('OnlinePlayersComponent', () => {
  let component: OnlinePlayersComponent;
  let fixture: ComponentFixture<OnlinePlayersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OnlinePlayersComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OnlinePlayersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
