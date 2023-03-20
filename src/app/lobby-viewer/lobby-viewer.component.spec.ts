import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LobbyViewerComponent } from './lobby-viewer.component';

describe('LobbyViewerComponent', () => {
  let component: LobbyViewerComponent;
  let fixture: ComponentFixture<LobbyViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LobbyViewerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LobbyViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
