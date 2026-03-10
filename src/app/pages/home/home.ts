import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { Permissions } from '../../services/permissions';
import { AppGroup, PERMISSIONS_CATALOG, Ticket } from '../../models/permissions.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, TagModule, IfHasPermissionDirective],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  permissions = PERMISSIONS_CATALOG;
  selectedGroup: AppGroup | null = null;
  tickets: Ticket[] = [];
  recentTickets: Ticket[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: Permissions,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const session = this.authService.getSession();
    const currentUser = this.authService.getCurrentUser();
    const selectedGroupId = session?.selectedGroupId ?? currentUser?.groupIds[0] ?? null;

    if (!selectedGroupId) {
      this.router.navigate(['/groups']);
      return;
    }

    if (selectedGroupId !== session?.selectedGroupId) {
      this.authService.updateSession({ selectedGroupId });
    }

    this.selectedGroup = this.dataService.getGroupById(selectedGroupId);
    this.tickets = this.dataService.getTicketsByGroup(selectedGroupId);
    this.recentTickets = [...this.tickets].slice(0, 4);
  }

  get totalTickets(): number {
    return this.tickets.length;
  }

  byStatus(status: Ticket['status']): number {
    return this.tickets.filter(ticket => ticket.status === status).length;
  }

  openKanban(): void {
    this.router.navigate(['/tickets']);
  }
}
