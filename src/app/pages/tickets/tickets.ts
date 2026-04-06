import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { Permissions } from '../../services/permissions';
import {
  AppGroup,
  AppUser,
  PermissionKey,
  Ticket,
  TicketPriority,
  TicketStatus,
} from '../../models/permissions.model';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    CardModule,
    TabsModule,
    ToastModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './tickets.html',
  styleUrls: ['./tickets.css'],
  providers: [MessageService],
})
export class Tickets implements OnInit {
  selectedGroup: AppGroup | null = null;
  visibleGroupIds: string[] = [];
  statuses: TicketStatus[] = ['Pendiente', 'En progreso', 'Revision', 'Hecho', 'Bloqueado'];
  priorities: TicketPriority[] = ['Critica', 'Muy alta', 'Alta', 'Media', 'Baja', 'Muy baja', 'Bloqueado'];
  priorityOptions: Array<{ label: string; value: TicketPriority }> = [];

  tickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  usersInGroup: AppUser[] = [];
  selectedTicket: Ticket | null = null;
  isLoading = false;

  viewMode: 'kanban' | 'table' = 'kanban';
  showTableView = false; // true = table, false = kanban
  createDialog = false;
  detailDialog = false;
  quickFilter: 'all' | 'mine' | 'unassigned' | 'high' = 'all';
  commentDraft = '';

  ticketDraft: {
    title: string;
    description: string;
    status: TicketStatus;
    assigneeId: string | null;
    priority: TicketPriority;
    dueDate: string;
  } = {
    title: '',
    description: '',
    status: 'Pendiente',
    assigneeId: null,
    priority: 'Media',
    dueDate: new Date().toISOString().slice(0, 10),
  };

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: Permissions,
    private readonly messageService: MessageService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const session = this.authService.getSession();
    this.authService.getUsers$().subscribe(usersFromDb => {
      // Keep local cache aligned with DB so getCurrentUser/session-based checks use fresh permissions.
      this.authService.saveUsers(usersFromDb);

      const freshCurrentUser =
        usersFromDb.find(user => user.id === session?.userId) ??
        usersFromDb.find(user => user.email.toLowerCase() === (session?.email ?? '').toLowerCase()) ??
        this.authService.getCurrentUser();
      const accessibleGroupIds = this.getAccessibleGroupIds(freshCurrentUser);
      const hasTicketPermission = this.hasAnyTicketPermission(freshCurrentUser, session?.permissions ?? []);
      const groupId = this.resolveAccessibleGroupId(
        freshCurrentUser,
        session?.selectedGroupId ?? null,
      );

      if (!freshCurrentUser || (!groupId && !hasTicketPermission)) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin acceso a tickets',
          detail: 'No tienes un grupo con permiso para ver tickets.',
        });
        this.router.navigate(['/groups']);
        return;
      }

      const selectedGroupId = groupId ?? session?.selectedGroupId ?? null;
      const groupPermissions = selectedGroupId
        ? (freshCurrentUser.permissionsByGroup[selectedGroupId] ?? [])
        : (session?.permissions ?? []);
      this.authService.updateSession({ selectedGroupId, permissions: groupPermissions });
      this.visibleGroupIds = accessibleGroupIds;

      const group$ = selectedGroupId ? this.dataService.getGroupById$(selectedGroupId) : of(null);
      const users$ = selectedGroupId ? this.dataService.getUsersInGroup$(selectedGroupId) : of([] as AppUser[]);

      forkJoin([
        group$,
        users$,
        this.dataService.getTicketStatuses$(),
        this.dataService.getTicketPriorities$(),
      ]).subscribe(([group, users, statuses, priorities]) => {
        this.selectedGroup = group;
        this.usersInGroup = users;
        if (statuses.length) {
          this.statuses = statuses;
        }
        if (priorities.length) {
          this.priorities = priorities;
        }
        this.priorityOptions = this.priorities.map(priority => ({
          label: priority,
          value: priority,
        }));

        if (!this.statuses.includes(this.ticketDraft.status)) {
          this.ticketDraft.status = this.statuses[0] ?? 'Pendiente';
        }
        if (!this.priorities.includes(this.ticketDraft.priority)) {
          this.ticketDraft.priority = this.priorities[0] ?? 'Media';
        }

        this.reloadTickets(this.visibleGroupIds);
      });
    });
  }

  ticketsByStatus(status: TicketStatus): Ticket[] {
    return this.filteredTickets.filter(ticket => ticket.status === status);
  }

  onViewModeChange(isTable: boolean): void {
    this.showTableView = isTable;
    this.viewMode = isTable ? 'table' : 'kanban';
  }

  applyQuickFilter(filter: 'all' | 'mine' | 'unassigned' | 'high'): void {
    this.quickFilter = filter;
    const currentUser = this.authService.getCurrentUser();

    this.filteredTickets = this.tickets.filter(ticket => {
      if (filter === 'mine') {
        return ticket.assigneeId === currentUser?.id;
      }

      if (filter === 'unassigned') {
        return !ticket.assigneeId;
      }

      if (filter === 'high') {
        return ticket.priority === 'Critica' || ticket.priority === 'Muy alta' || ticket.priority === 'Alta';
      }

      return true;
    });
  }

  openCreateDialog(): void {
    this.createDialog = true;
    this.ticketDraft = {
      title: '',
      description: '',
      status: this.statuses[0] ?? 'Pendiente',
      assigneeId: null,
      priority: this.priorities[0] ?? 'Media',
      dueDate: new Date().toISOString().slice(0, 10),
    };
  }

  createTicket(): void {
    const groupId = this.authService.getSession()?.selectedGroupId;
    if (!groupId || !this.ticketDraft.title.trim()) {
      return;
    }

    const assignee = this.usersInGroup.find(user => user.id === this.ticketDraft.assigneeId) ?? null;

    this.isLoading = true;
    this.dataService.createTicket$({
      groupId,
      title: this.ticketDraft.title,
      description: this.ticketDraft.description,
      status: this.ticketDraft.status,
      priority: this.ticketDraft.priority,
      dueDate: this.ticketDraft.dueDate,
      assigneeId: assignee?.id ?? null,
    }).subscribe(created => {
      this.isLoading = false;
      if (!created) {
        this.messageService.add({
          severity: 'error',
          summary: 'No se pudo crear',
          detail: 'No se pudo crear el ticket con el catalogo actual de estado/prioridad.',
        });
        return;
      }
      this.createDialog = false;
      this.reloadTickets();
      this.messageService.add({ severity: 'success', summary: 'Ticket creado', detail: 'El ticket se agrego al tablero.' });
    });
  }

  openDetail(ticket: Ticket): void {
    this.dataService.getTicketById$(ticket.id).subscribe(full => {
      this.selectedTicket = full ? { ...full } : { ...ticket };
      this.detailDialog = true;
      this.commentDraft = '';
    });
  }

  saveDetail(): void {
    if (!this.selectedTicket) {
      return;
    }

    const canEdit = this.canEditFields(this.selectedTicket);
    const canUpdateStatus = this.canChangeStatus(this.selectedTicket);
    if (!canEdit && !canUpdateStatus) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Edicion no permitida',
        detail: 'Solo puedes editar tickets creados y asignados a ti.',
      });
      return;
    }

    const actor = this.authService.getCurrentUser();
    if (!actor) {
      return;
    }

    const assignee = this.usersInGroup.find(user => user.id === this.selectedTicket?.assigneeId) ?? null;

    this.isLoading = true;
    this.dataService.updateTicket$(
      this.selectedTicket.id,
      {
        title: this.selectedTicket.title,
        description: this.selectedTicket.description,
        priority: this.selectedTicket.priority,
        dueDate: this.selectedTicket.dueDate,
        assigneeId: assignee?.id ?? null,
        status: this.selectedTicket.status,
      },
      actor.id,
      'Detalle actualizado',
    ).subscribe(ticket => {
      this.isLoading = false;
      if (ticket) {
        this.selectedTicket = ticket;
      }
      this.reloadTickets();
      this.messageService.add({ severity: 'success', summary: 'Cambios guardados', detail: 'Ticket actualizado.' });
    });
  }

  addComment(): void {
    const actor = this.authService.getCurrentUser();
    if (!actor || !this.selectedTicket || !this.commentDraft.trim()) {
      return;
    }

    this.isLoading = true;
    this.dataService.addTicketComment$(this.selectedTicket.id, this.commentDraft.trim(), actor.id).subscribe(ticket => {
      this.isLoading = false;
      if (ticket) {
        this.selectedTicket = ticket;
      }
      this.reloadTickets();
    });
    this.commentDraft = '';
  }

  onDragStart(event: DragEvent, ticket: Ticket): void {
    event.dataTransfer?.setData('ticketId', ticket.id);
  }

  onDrop(event: DragEvent, status: TicketStatus): void {
    event.preventDefault();
    const ticketId = event.dataTransfer?.getData('ticketId');
    if (!ticketId) {
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    this.dataService.getTicketById$(ticketId).subscribe(targetTicket => {
      if (!targetTicket || !this.canChangeStatus(targetTicket)) {
        return;
      }
      this.dataService
        .updateTicket$(ticketId, { status }, currentUser.id, `Estado movido a ${status}`)
        .subscribe(() => this.reloadTickets());
    });
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  deleteTicket(ticket: Ticket): void {
    this.isLoading = true;
    this.dataService.deleteTicket$(ticket.id).subscribe(() => {
      this.isLoading = false;
      this.reloadTickets(this.visibleGroupIds);
    });
  }

  canEditFields(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    return this.hasPermission('ticket:edit') || this.hasPermission('ticket:manage');
  }

  canChangeStatus(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    return this.hasPermission('ticket:edit:state') || this.hasPermission('ticket:manage');
  }

  canComment(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (this.hasPermission('ticket:manage')) {
      return true;
    }

    return this.hasPermission('ticket:edit:comment');
  }

  hasPermission(permission: PermissionKey): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.isSuperAdmin) {
      return true;
    }
    return this.authService.getSession()?.permissions.includes(permission) ?? false;
  }

  userNameById(id: string | null): string {
    if (!id) {
      return 'Sin asignar';
    }

    return this.usersInGroup.find(user => user.id === id)?.name ?? 'Sin asignar';
  }

  priorityLabel(priority: TicketPriority): string {
    return this.priorityOptions.find(option => option.value === priority)?.label ?? priority;
  }

  private reloadTickets(groupIds?: string[]): void {
    const effectiveGroupIds = (groupIds?.length ? groupIds : this.visibleGroupIds)
      .filter((id, index, arr) => arr.indexOf(id) === index);

    this.isLoading = true;
    this.dataService.getAllTickets$().subscribe(allTickets => {
      this.isLoading = false;
      let scopedTickets = effectiveGroupIds.length
        ? allTickets.filter(ticket => effectiveGroupIds.includes(ticket.groupId))
        : allTickets;

      // Last-resort visibility fallback for desynced group mappings on newly created users.
      const finalTickets = (!scopedTickets.length && allTickets.length)
        ? allTickets
        : scopedTickets;

      this.tickets = finalTickets
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.applyQuickFilter(this.quickFilter);
    });
  }

  private hasAnyTicketPermission(user: AppUser | null, sessionPermissions: PermissionKey[]): boolean {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (sessionPermissions.includes('ticket:view') || sessionPermissions.includes('ticket:manage')) {
      return true;
    }

    return Object.values(user.permissionsByGroup ?? {}).some(groupPerms =>
      groupPerms.includes('ticket:view') || groupPerms.includes('ticket:manage'),
    );
  }

  private getAccessibleGroupIds(user: AppUser | null): string[] {
    if (!user) {
      return [];
    }
    const membershipGroupIds = user.groupIds ?? [];
    const permissionGroupIds = Object.keys(user.permissionsByGroup ?? {});
    const allGroupIds = [...new Set([...membershipGroupIds, ...permissionGroupIds])];
    const byPermissions = allGroupIds.filter(groupId => this.hasTicketViewForGroup(user, groupId));
    if (byPermissions.length) {
      return byPermissions;
    }

    // Fallback: if the per-group map is stale/empty, still allow membership-based visibility.
    return membershipGroupIds.length ? membershipGroupIds : allGroupIds;
  }

  private resolveAccessibleGroupId(user: AppUser | null, preferredGroupId: string | null): string | null {
    const accessibleGroupIds = this.getAccessibleGroupIds(user);
    if (preferredGroupId && accessibleGroupIds.includes(preferredGroupId)) {
      return preferredGroupId;
    }

    return accessibleGroupIds[0] ?? null;
  }

  private hasTicketViewForGroup(user: AppUser, groupId: string): boolean {
    if (user.isSuperAdmin) {
      return true;
    }
    const permissions = user.permissionsByGroup[groupId] ?? [];
    return permissions.includes('ticket:view') || permissions.includes('ticket:manage');
  }
}
