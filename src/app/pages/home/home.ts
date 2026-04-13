// Dashboard inicial despues de entrar a un grupo.
// Si aun no hay grupo seleccionado formalmente, actua como pantalla de bienvenida guiando al usuario.
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { PermissionsService } from '../../services/permissions.service';
import { Permissions } from '../../services/permissions';
import { AppGroup, Ticket } from '../../models/permissions.model';

type GroupTicketSummary = {
  groupId: string;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, TagModule, SelectModule, TableModule, IfHasPermissionDirective],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home implements OnInit {
  // Grupo activo sobre el que se calculan metricas y tickets recientes.
  selectedGroup: AppGroup | null = null;
  userGroups: AppGroup[] = [];
  tickets: Ticket[] = [];
  visibleTickets: Ticket[] = [];
  recentTickets: Ticket[] = [];
  selectedGroupId: string | null = null;
  ticketSummary: GroupTicketSummary | null = null;
  ticketAccessMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
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

  get groupSelectorOptions(): Array<{ label: string; value: string }> {
    return this.userGroups.map(group => ({ label: group.name, value: group.id }));
  }

  get ticketsByStatusSummary(): Array<{ label: string; total: number }> {
    return [
      { label: 'Pendiente', total: this.byStatus('Pendiente') },
      { label: 'En progreso', total: this.byStatus('En progreso') },
      { label: 'Revision', total: this.byStatus('Revision') },
      { label: 'Hecho', total: this.byStatus('Hecho') },
      { label: 'Bloqueado', total: this.byStatus('Bloqueado') },
    ];
  }

  get ticketsByPrioritySummary(): Array<{ label: string; total: number }> {
    return [
      { label: 'Critica', total: this.byPriority('Critica') },
      { label: 'Muy alta', total: this.byPriority('Muy alta') },
      { label: 'Alta', total: this.byPriority('Alta') },
      { label: 'Media', total: this.byPriority('Media') },
      { label: 'Baja', total: this.byPriority('Baja') },
      { label: 'Muy baja', total: this.byPriority('Muy baja') },
    ];
  }

  get ticketsByGroupSummary(): Array<{ groupName: string; total: number }> {
    return this.userGroups.map(group => ({
      groupName: group.name,
      total: this.selectedGroupId === group.id && this.ticketSummary
        ? this.ticketSummary.total
        : this.visibleTickets.filter(ticket => ticket.groupId === group.id).length,
    }));
  }

  get canViewSelectedGroupTickets(): boolean {
    return this.selectedGroupId ? this.hasTicketAccessForGroup(this.selectedGroupId) : false;
  }

  ngOnInit(): void {
    // El dashboard depende de un usuario autenticado y de un grupo ya "entrado" desde la pagina Groups.
    this.authService.hydrateCurrentUser$().subscribe(currentUser => {
      if (!currentUser) {
        this.router.navigate(['/login']);
        return;
      }

      const session = this.authService.getSession();
      const selectedGroupId = session?.selectedGroupId;
      const hasEnteredGroup = session?.hasEnteredGroup;
      this.selectedGroupId = selectedGroupId ?? null;

      this.dataService.getGroups$().subscribe(groups => {
        this.userGroups = currentUser.isSuperAdmin
          ? groups
          : groups.filter(group => currentUser.groupIds.includes(group.id));
      });

      this.dataService.getAllTickets$().subscribe(tickets => {
        this.visibleTickets = currentUser.isSuperAdmin
          ? tickets
          : tickets.filter(ticket => currentUser.groupIds.includes(ticket.groupId));
      });

      // Solo cargar dashboard si el usuario formalmente ha entrado a un grupo
      if (selectedGroupId && hasEnteredGroup) {
        this.dataService.getGroupById$(selectedGroupId).subscribe(group => {
          this.selectedGroup = group;
        });
        this.loadGroupTicketContext(selectedGroupId);
      }
      // Si no, mostrar solo bienvenida
    });
  }

  get totalTickets(): number {
    return this.ticketSummary?.total ?? this.tickets.length;
  }

  byStatus(status: Ticket['status']): number {
    // Conteo simple reutilizado por las tarjetas de resumen.
    return this.ticketSummary?.byStatus[status] ?? this.tickets.filter(ticket => ticket.status === status).length;
  }

  byPriority(priority: Ticket['priority']): number {
    return this.ticketSummary?.byPriority[priority] ?? this.tickets.filter(ticket => ticket.priority === priority).length;
  }

  openKanban(): void {
    if (!this.canViewSelectedGroupTickets) {
      this.ticketAccessMessage = 'No tienes permiso de ver tickets.';
      return;
    }

    this.router.navigate(['/tickets']);
  }

  onGoToGroups(): void {
    this.router.navigate(['/groups']);
  }

  onGroupSelectionChange(groupId: string | null): void {
    if (!groupId) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    const targetGroup = this.userGroups.find(group => group.id === groupId);
    if (!currentUser || !targetGroup) {
      return;
    }

    const permissions = this.dataService.getCurrentGroupPermissions(currentUser, groupId);
    this.authService.updateSession({ selectedGroupId: groupId, permissions, hasEnteredGroup: true });
    this.permissionsService.refreshPermissionsForGroup(groupId);
    this.selectedGroupId = groupId;
    this.selectedGroup = targetGroup;
    this.loadGroupTicketContext(groupId);
  }

  private loadGroupTicketContext(groupId: string): void {
    if (this.hasTicketAccessForGroup(groupId)) {
      this.ticketSummary = null;
      this.ticketAccessMessage = '';
      this.dataService.getTicketsByGroup$(groupId).subscribe(tickets => {
        this.tickets = tickets;
        this.recentTickets = [...tickets].slice(0, 4);
      });
      return;
    }

    this.ticketAccessMessage = 'No tienes permiso de ver tickets.';
    this.tickets = [];
    this.recentTickets = [];
    this.dataService.getGroupTicketSummary$(groupId).subscribe(summary => {
      this.ticketSummary = summary;
    });
  }

  private hasTicketAccessForGroup(groupId: string): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    const permissions = currentUser.permissionsByGroup[groupId] ?? [];
    return permissions.includes('ticket:view') || permissions.includes('ticket:manage');
  }

  private hasModuleAccess(prefix: 'group:' | 'user:' | 'ticket:'): boolean {
    // Replica la logica de Sidebar para mantener consistente la visibilidad entre home y menu lateral.
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
