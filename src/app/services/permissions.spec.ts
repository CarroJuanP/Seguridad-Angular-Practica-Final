import { TestBed } from '@angular/core/testing';

import { Permissions } from './permissions';

describe('Permissions', () => {
  let service: Permissions;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Permissions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
