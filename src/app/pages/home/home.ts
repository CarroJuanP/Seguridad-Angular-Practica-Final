import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { Permissions } from '../../services/permissions';
import { AppGroup, Ticket } from '../../models/permissions.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, TagModule, IfHasPermissionDirective],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  selectedGroup: AppGroup | null = null;
  tickets: Ticket[] = [];
  recentTickets: Ticket[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: Permissions,
    private readonly router: Router,
  ) {}

  get userName(): string {
    return this.authService.getCurrentUser()?.name ?? 'Usuario';
  }

  get isSuperAdmin(): boolean {
    return this.authService.getCurrentUser()?.isSuperAdmin ?? false;
  }

  get canSeeGroups(): boolean {
    return this.hasModuleAccess('group:');
  }

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    const session = this.authService.getSession();
    const selectedGroupId = session?.selectedGroupId;
    const hasEnteredGroup = session?.hasEnteredGroup;

    // Solo cargar dashboard si el usuario formalmente ha entrado a un grupo
    if (selectedGroupId && hasEnteredGroup) {
      this.dataService.getGroupById$(selectedGroupId).subscribe(group => {
        this.selectedGroup = group;
      });
      this.dataService.getTicketsByGroup$(selectedGroupId).subscribe(tickets => {
        this.tickets = tickets;
        this.recentTickets = [...tickets].slice(0, 4);
      });
    }
    // Si no, mostrar solo bienvenida
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

  onGoToGroups(): void {
    this.router.navigate(['/groups']);
  }

  private hasModuleAccess(prefix: 'group:' | 'user:' | 'ticket:'): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.isSuperAdmin) return true;

    const userPermissions = currentUser
      ? Object.values(currentUser.permissionsByGroup).flat()
      : [];
    const sessionPermissions = this.authService.getSession()?.permissions ?? [];
    const allPermissions = [...new Set([...userPermissions, ...sessionPermissions])];

    return allPermissions.some(permission => permission.startsWith(prefix));
  }
}
