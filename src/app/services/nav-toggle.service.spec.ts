import { TestBed } from '@angular/core/testing';

import { NavToggleService } from './nav-toggle.service';

describe('NavToggleService', () => {
  let service: NavToggleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NavToggleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
