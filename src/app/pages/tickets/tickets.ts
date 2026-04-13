// Pantalla principal de tickets en vista kanban o tabla.
// Es uno de los componentes mas ricos: mezcla permisos, filtros, drag & drop y CRUD de detalle.
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
import { forkJoin, map, of } from 'rxjs';
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
  ],
  templateUrl: './tickets.html',
  styleUrls: ['./tickets.css'],
  providers: [MessageService],
})
export class Tickets implements OnInit {
  // Grupo actualmente mostrado y grupos sobre los que el usuario realmente tiene visibilidad.
  selectedGroup: AppGroup | null = null;
  groupNameMap: Record<string, string> = {};
  visibleGroupIds: string[] = [];
  statuses: TicketStatus[] = ['Pendiente', 'En progreso', 'Revision', 'Hecho', 'Bloqueado'];
  statusFilterOptions: Array<TicketStatus | 'all'> = ['all', 'Pendiente', 'En progreso', 'Revision', 'Hecho', 'Bloqueado'];
  priorities: TicketPriority[] = ['Critica', 'Muy alta', 'Alta', 'Media', 'Baja', 'Muy baja', 'Bloqueado'];
  priorityFilterOptions: Array<TicketPriority | 'all'> = ['all', 'Critica', 'Muy alta', 'Alta', 'Media', 'Baja', 'Muy baja', 'Bloqueado'];
  priorityOptions: Array<{ label: string; value: TicketPriority }> = [];
  assigneeFilterOptions = [
    { label: 'Todos', value: 'all' },
    { label: 'Mios', value: 'mine' },
    { label: 'Asignados', value: 'assigned' },
    { label: 'Sin asignar', value: 'unassigned' },
  ];

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
  statusFilter: TicketStatus | 'all' = 'all';
  priorityFilter: TicketPriority | 'all' = 'all';
  assigneeFilter: 'all' | 'mine' | 'assigned' | 'unassigned' = 'all';
  commentDraft = '';
  pendingActionLabel = '';

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
    // El componente refresca usuarios desde BD para calcular accesos con la informacion mas reciente posible.
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
      const enteredGroupId = session?.hasEnteredGroup ? (session.selectedGroupId ?? null) : null;
      const groupId = enteredGroupId && this.canKeepEnteredGroup(freshCurrentUser, enteredGroupId)
        ? enteredGroupId
        : this.resolveAccessibleGroupId(
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
      const users$ = this.loadAssignableUsers$(selectedGroupId);

      forkJoin([
        group$,
        users$,
        this.dataService.getGroups$(),
        this.dataService.getTicketStatuses$(),
        this.dataService.getTicketPriorities$(),
      ]).subscribe(([group, users, groups, statuses, priorities]) => {
        this.selectedGroup = group;
        this.usersInGroup = users;
        this.groupNameMap = Object.fromEntries(groups.map(item => [item.id, item.name]));
        if (statuses.length) {
          this.statuses = statuses;
          this.statusFilterOptions = ['all', ...statuses];
        }
        if (priorities.length) {
          this.priorities = priorities;
          this.priorityFilterOptions = ['all', ...priorities];
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

        this.reloadTickets(selectedGroupId ? [selectedGroupId] : []);
      });
    });
  }

  ticketsByStatus(status: TicketStatus): Ticket[] {
    // Fuente del tablero kanban, agrupando en memoria por estado.
    return this.filteredTickets.filter(ticket => ticket.status === status);
  }

  get visibleTicketCount(): number {
    return this.filteredTickets.length;
  }

  get hasActiveFilters(): boolean {
    return this.quickFilter !== 'all' || this.statusFilter !== 'all' || this.priorityFilter !== 'all' || this.assigneeFilter !== 'all';
  }

  get emptyStateMessage(): string {
    if (this.hasActiveFilters) {
      return 'No hay tickets que coincidan con los filtros actuales. Limpia filtros o cambia de grupo.';
    }

    return 'No hay tickets visibles para tus grupos/permisos. Crea uno con Crear ticket o ejecuta el seed de tickets demo.';
  }

  onViewModeChange(isTable: boolean): void {
    this.showTableView = isTable;
    this.viewMode = isTable ? 'table' : 'kanban';
  }

  applyQuickFilter(filter: 'all' | 'mine' | 'unassigned' | 'high'): void {
    // Filtros rapidos puramente visuales aplicados sobre la coleccion ya cargada.
    this.quickFilter = filter;
    this.applyCombinedFilters();
  }

  applyStructuredFilters(): void {
    this.applyCombinedFilters();
  }

  resetFilters(): void {
    this.quickFilter = 'all';
    this.statusFilter = 'all';
    this.priorityFilter = 'all';
    this.assigneeFilter = 'all';
    this.applyCombinedFilters();
  }

  groupLabel(groupId: string): string {
    return this.groupNameMap[groupId] ?? groupId;
  }

  get canCreateTickets(): boolean {
    const activeGroupId = this.authService.getSession()?.selectedGroupId ?? this.selectedGroup?.id ?? null;
    if (!activeGroupId) {
      return false;
    }

    return this.hasPermissionForGroup(activeGroupId, 'ticket:add')
      || this.hasPermissionForGroup(activeGroupId, 'ticket:manage');
  }

  canMoveTicket(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    if (ticket.assigneeId !== currentUser.id) {
      return false;
    }

    return this.hasPermissionForGroup(ticket.groupId, 'ticket:edit:state')
      || this.hasPermissionForGroup(ticket.groupId, 'ticket:manage');
  }

  canDeleteTicket(ticket: Ticket): boolean {
    return this.hasPermissionForGroup(ticket.groupId, 'ticket:delete')
      || this.hasPermissionForGroup(ticket.groupId, 'ticket:manage');
  }

  moveSelectedTicket(): void {
    if (!this.selectedTicket || !this.canMoveTicket(this.selectedTicket)) {
      return;
    }

    this.saveDetail();
  }

  private applyCombinedFilters(): void {
    const currentUser = this.authService.getCurrentUser();

    this.filteredTickets = this.tickets.filter(ticket =>
      this.matchesQuickFilter(ticket, currentUser?.id ?? null) &&
      this.matchesStructuredFilters(ticket, currentUser?.id ?? null),
    );
  }

  openCreateDialog(): void {
    this.refreshUsersInGroup(this.authService.getSession()?.selectedGroupId ?? this.selectedGroup?.id ?? null);
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
    // Requiere grupo activo y titulo no vacio; el resto puede resolverse por defaults.
    const groupId = this.authService.getSession()?.selectedGroupId;
    if (!groupId || !this.ticketDraft.title.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Selecciona un grupo activo y escribe un titulo para crear el ticket.' });
      return;
    }

    const assignee = this.resolveAssignee(this.ticketDraft.assigneeId, groupId);

    this.pendingActionLabel = 'Creando ticket';
    this.isLoading = true;
    this.dataService.createTicket$({
      groupId,
      title: this.ticketDraft.title,
      description: this.ticketDraft.description,
      status: this.ticketDraft.status,
      priority: this.ticketDraft.priority,
      dueDate: this.ticketDraft.dueDate,
      assigneeId: assignee?.id ?? null,
    }).subscribe({
      next: created => {
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
      },
      error: error => {
        this.isLoading = false;
        this.pendingActionLabel = '';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo crear el ticket.') });
      },
    });
  }

  openDetail(ticket: Ticket): void {
    // Relee el ticket desde BD para mostrar comentarios e historial completos.
    this.dataService.getTicketById$(ticket.id).subscribe(full => {
      this.selectedTicket = full ? { ...full } : { ...ticket };
      this.refreshUsersInGroup(this.selectedTicket.groupId);
      this.detailDialog = true;
      this.commentDraft = '';
    });
  }

  saveDetail(): void {
    // Separa capacidad de editar campos de la capacidad de cambiar estado para no mezclar permisos.
    if (!this.selectedTicket) {
      return;
    }

    const canEdit = this.canEditFields(this.selectedTicket);
    const canUpdateStatus = this.canChangeStatus(this.selectedTicket);
    if (!canEdit && !canUpdateStatus) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Edicion no permitida',
        detail: 'Solo puedes editar segun tus permisos y mover estados en tickets asignados a ti donde tengas ese permiso.',
      });
      return;
    }

    const actor = this.authService.getCurrentUser();
    if (!actor) {
      return;
    }

    const assignee = this.resolveAssignee(this.selectedTicket.assigneeId, this.selectedTicket.groupId);

    this.pendingActionLabel = 'Guardando cambios';
    this.isLoading = true;
    const ticketUpdates = canEdit
      ? {
          title: this.selectedTicket.title,
          description: this.selectedTicket.description,
          priority: this.selectedTicket.priority,
          dueDate: this.selectedTicket.dueDate,
          assigneeId: assignee?.id ?? null,
          ...(canUpdateStatus ? { status: this.selectedTicket.status } : {}),
        }
      : {
          status: this.selectedTicket.status,
        };
    this.dataService.updateTicket$(
      this.selectedTicket.id,
      ticketUpdates,
      actor.id,
      canEdit ? 'Detalle actualizado' : `Estado actualizado a ${this.selectedTicket.status}`,
    ).subscribe({
      next: ticket => {
        this.isLoading = false;
        if (ticket) {
          this.selectedTicket = ticket;
        }
        this.reloadTickets();
        this.messageService.add({ severity: 'success', summary: 'Cambios guardados', detail: 'Ticket actualizado.' });
      },
      error: error => {
        this.isLoading = false;
        this.pendingActionLabel = '';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo actualizar el ticket.') });
      },
    });
  }

  addComment(): void {
    // El comentario se persiste y luego se limpia el borrador local.
    const actor = this.authService.getCurrentUser();
    if (!actor || !this.selectedTicket || !this.commentDraft.trim()) {
      return;
    }

    this.pendingActionLabel = 'Agregando comentario';
    this.isLoading = true;
    this.dataService.addTicketComment$(this.selectedTicket.id, this.commentDraft.trim(), actor.id).subscribe({
      next: ticket => {
        this.isLoading = false;
        if (ticket) {
          this.selectedTicket = ticket;
        }
        this.reloadTickets();
        this.messageService.add({ severity: 'success', summary: 'Comentario agregado', detail: 'La actividad del ticket se actualizo.' });
      },
      error: error => {
        this.isLoading = false;
        this.pendingActionLabel = '';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo agregar el comentario.') });
      },
    });
    this.commentDraft = '';
  }

  onDragStart(event: DragEvent, ticket: Ticket): void {
    // Guarda el id del ticket en el drag payload para recuperarlo al soltar.
    event.dataTransfer?.setData('ticketId', ticket.id);
  }

  onDrop(event: DragEvent, status: TicketStatus): void {
    // Soltar en una columna equivale a pedir un cambio de estado.
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
        this.messageService.add({ severity: 'warn', summary: 'Movimiento no permitido', detail: 'Solo puedes mover tickets asignados a ti y con permiso de cambio de estado.' });
        return;
      }
      this.pendingActionLabel = 'Moviendo estado';
      this.dataService
        .updateTicket$(ticketId, { status }, currentUser.id, `Estado movido a ${status}`)
        .subscribe({
          next: () => this.reloadTickets(),
          error: error => {
            this.pendingActionLabel = '';
            this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo mover el ticket.') });
          },
        });
    });
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  deleteTicket(ticket: Ticket): void {
    this.pendingActionLabel = 'Eliminando ticket';
    this.isLoading = true;
    this.dataService.deleteTicket$(ticket.id).subscribe({
      next: () => {
        this.isLoading = false;
        this.reloadTickets();
        this.messageService.add({ severity: 'success', summary: 'Ticket eliminado', detail: `Se elimino ${ticket.title}.` });
      },
      error: error => {
        this.isLoading = false;
        this.pendingActionLabel = '';
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.readErrorMessage(error, 'No se pudo eliminar el ticket.') });
      },
    });
  }

  canEditFields(ticket: Ticket): boolean {
    // En la implementacion actual basta con tener permiso de edicion global o manage.
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    return this.hasPermissionForGroup(ticket.groupId, 'ticket:edit') || this.hasPermissionForGroup(ticket.groupId, 'ticket:manage');
  }

  canChangeStatus(ticket: Ticket): boolean {
    return this.canMoveTicket(ticket);
  }

  canComment(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (this.hasPermissionForGroup(ticket.groupId, 'ticket:manage')) {
      return true;
    }

    return this.hasPermissionForGroup(ticket.groupId, 'ticket:edit:comment');
  }

  hasPermission(permission: string): boolean {
    // La pagina usa los permisos de la sesion ya resueltos para el grupo activo.
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.isSuperAdmin) {
      return true;
    }
    return this.authService.getSession()?.permissions.some(currentPermission => {
      if (currentPermission === permission) {
        return true;
      }

      const aliases: Record<string, PermissionKey> = {
        'tickets:view': 'ticket:view',
        'tickets:add': 'ticket:add',
        'tickets:edit': 'ticket:edit',
        'tickets:delete': 'ticket:delete',
        'tickets:move': 'ticket:edit:state',
        'tickets:comment': 'ticket:edit:comment',
        'tickets:assign': 'ticket:edit:assign',
        'tickets:manage': 'ticket:manage',
        'groups:manage': 'group:manage',
        'users:manage': 'user:manage',
      };

      return aliases[permission] === currentPermission;
    }) ?? false;
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
    // Carga global y luego filtra en cliente para simplificar reglas de visibilidad mixtas.
    const activeGroupId = this.authService.getSession()?.selectedGroupId ?? this.selectedGroup?.id ?? null;
    const defaultGroupScope = activeGroupId ? [activeGroupId] : this.visibleGroupIds;
    const effectiveGroupIds = (groupIds?.length ? groupIds : defaultGroupScope)
      .filter((id, index, arr) => arr.indexOf(id) === index);

    this.isLoading = true;
    this.dataService.getAllTickets$().subscribe(allTickets => {
      this.isLoading = false;
      this.pendingActionLabel = '';
      const scopedTickets = effectiveGroupIds.length
        ? allTickets.filter(ticket => effectiveGroupIds.includes(ticket.groupId))
        : allTickets;

      const sortedTickets = [...scopedTickets];
      sortedTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.tickets = sortedTickets;
      this.applyCombinedFilters();
    });
  }

  private matchesQuickFilter(ticket: Ticket, currentUserId: string | null): boolean {
    if (this.quickFilter === 'mine') {
      return ticket.assigneeId === currentUserId;
    }

    if (this.quickFilter === 'unassigned') {
      return !ticket.assigneeId;
    }

    if (this.quickFilter === 'high') {
      return ticket.priority === 'Critica' || ticket.priority === 'Muy alta' || ticket.priority === 'Alta';
    }

    return true;
  }

  private matchesStructuredFilters(ticket: Ticket, currentUserId: string | null): boolean {
    if (this.statusFilter !== 'all' && ticket.status !== this.statusFilter) {
      return false;
    }

    if (this.priorityFilter !== 'all' && ticket.priority !== this.priorityFilter) {
      return false;
    }

    if (this.assigneeFilter === 'mine') {
      return ticket.assigneeId === currentUserId;
    }

    if (this.assigneeFilter === 'assigned') {
      return Boolean(ticket.assigneeId);
    }

    if (this.assigneeFilter === 'unassigned') {
      return !ticket.assigneeId;
    }

    return true;
  }

  private hasAnyTicketPermission(user: AppUser | null, sessionPermissions: PermissionKey[]): boolean {
    // Determina si siquiera vale la pena dejar entrar al modulo de tickets.
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
    // Une memberships y grupos presentes en permissionsByGroup para cubrir datos parcialmente desincronizados.
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
    // Un grupo cuenta como visible si posee permiso de ver o gestionar tickets.
    if (user.isSuperAdmin) {
      return true;
    }
    const permissions = user.permissionsByGroup[groupId] ?? [];
    return permissions.includes('ticket:view') || permissions.includes('ticket:manage');
  }

  private canKeepEnteredGroup(user: AppUser | null, groupId: string): boolean {
    if (!user || !groupId) {
      return false;
    }

    if (user.isSuperAdmin) {
      return true;
    }

    return this.userBelongsToGroup(user, groupId) && this.hasTicketViewForGroup(user, groupId);
  }

  private loadAssignableUsers$(groupId: string | null) {
    if (!groupId) {
      return of([] as AppUser[]);
    }

    return forkJoin([
      this.dataService.getUsersInGroup$(groupId),
      this.authService.getUsers$(),
    ]).pipe(
      map(([groupUsers, allUsers]) => {
        const fallbackUsers = allUsers.filter(user => this.userBelongsToGroup(user, groupId));
        const mergedUsers = [...groupUsers, ...fallbackUsers];
        const uniqueUsers = new Map(mergedUsers.map(user => [user.id, user]));

        return [...uniqueUsers.values()].sort((left, right) => left.name.localeCompare(right.name));
      }),
    );
  }

  private refreshUsersInGroup(groupId: string | null): void {
    this.loadAssignableUsers$(groupId).subscribe(users => {
      this.usersInGroup = users;
    });
  }

  private resolveAssignee(assigneeId: string | null, groupId: string): AppUser | null {
    if (!assigneeId) {
      return null;
    }

    return this.usersInGroup.find(user => user.id === assigneeId)
      ?? this.authService.getUsers().find(user => user.id === assigneeId && this.userBelongsToGroup(user, groupId))
      ?? null;
  }

  private userBelongsToGroup(user: AppUser, groupId: string): boolean {
    return user.groupIds.includes(groupId) || Object.hasOwn(user.permissionsByGroup ?? {}, groupId);
  }

  private readErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  }

  private hasPermissionForGroup(groupId: string, permission: PermissionKey): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    const groupPermissions = currentUser.permissionsByGroup[groupId] ?? [];
    return groupPermissions.includes(permission);
  }
}
