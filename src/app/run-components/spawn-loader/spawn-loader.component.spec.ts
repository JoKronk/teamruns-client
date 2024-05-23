import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SpawnLoaderComponent } from './spawn-loader.component';

describe('SpawnLoaderComponent', () => {
  let component: SpawnLoaderComponent;
  let fixture: ComponentFixture<SpawnLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SpawnLoaderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpawnLoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
