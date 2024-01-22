import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PbCommentDialogComponent } from './pb-comment-dialog.component';

describe('PbCommentDialogComponent', () => {
  let component: PbCommentDialogComponent;
  let fixture: ComponentFixture<PbCommentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PbCommentDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PbCommentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
