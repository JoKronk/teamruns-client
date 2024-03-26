import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveLoaderComponent } from './save-loader.component';

describe('SaveLoaderComponent', () => {
  let component: SaveLoaderComponent;
  let fixture: ComponentFixture<SaveLoaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SaveLoaderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaveLoaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
