// Smoke test del modulo visual de tickets.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tickets } from './tickets';

describe('Ticket', () => {
  let component: Tickets;
  let fixture: ComponentFixture<Tickets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tickets]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Tickets);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
