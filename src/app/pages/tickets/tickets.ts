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
import { IfHasPermissionDirective } from '../../directives/has-permission';
import { AuthService } from '../../services/auth.service';
import { Permissions } from '../../services/permissions';
import {
  AppUser,
  PERMISSIONS_CATALOG,
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
  permissions = PERMISSIONS_CATALOG;
  statuses: TicketStatus[] = ['Pendiente', 'En progreso', 'Revision', 'Hecho', 'Bloqueado'];
  priorities: TicketPriority[] = ['Critica', 'Muy alta', 'Alta', 'Media', 'Baja', 'Muy baja', 'Bloqueado'];
  priorityOptions: Array<{ label: string; value: TicketPriority }> = [
    { label: 'Crítica', value: 'Critica' },
    { label: 'Muy alta', value: 'Muy alta' },
    { label: 'Alta', value: 'Alta' },
    { label: 'Media', value: 'Media' },
    { label: 'Baja', value: 'Baja' },
    { label: 'Muy baja', value: 'Muy baja' },
    { label: 'Bloqueado', value: 'Bloqueado' },
  ];

  tickets: Ticket[] = [];
  filteredTickets: Ticket[] = [];
  usersInGroup: AppUser[] = [];
  selectedTicket: Ticket | null = null;

  viewMode: 'kanban' | 'table' = 'kanban';
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
    const groupId = this.authService.getSession()?.selectedGroupId;
    if (!groupId) {
      this.router.navigate(['/groups']);
      return;
    }

    this.usersInGroup = this.dataService.getUsersInGroup(groupId);
    this.reloadTickets();
  }

  ticketsByStatus(status: TicketStatus): Ticket[] {
    return this.filteredTickets.filter(ticket => ticket.status === status);
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
      status: 'Pendiente',
      assigneeId: null,
      priority: 'Media',
      dueDate: new Date().toISOString().slice(0, 10),
    };
  }

  createTicket(): void {
    const groupId = this.authService.getSession()?.selectedGroupId;
    if (!groupId || !this.ticketDraft.title.trim()) {
      return;
    }

    const assignee = this.usersInGroup.find(user => user.id === this.ticketDraft.assigneeId) ?? null;

    this.dataService.createTicket({
      groupId,
      title: this.ticketDraft.title,
      description: this.ticketDraft.description,
      status: this.ticketDraft.status,
      priority: this.ticketDraft.priority,
      dueDate: this.ticketDraft.dueDate,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
    });

    this.createDialog = false;
    this.reloadTickets();
    this.messageService.add({ severity: 'success', summary: 'Ticket creado', detail: 'El ticket se agrego al tablero.' });
  }

  openDetail(ticket: Ticket): void {
    this.selectedTicket = { ...ticket };
    this.detailDialog = true;
    this.commentDraft = '';
  }

  saveDetail(): void {
    if (!this.selectedTicket) {
      return;
    }

    const actor = this.authService.getCurrentUser();
    if (!actor) {
      return;
    }

    const assignee = this.usersInGroup.find(user => user.id === this.selectedTicket?.assigneeId) ?? null;

    this.dataService.updateTicket(
      this.selectedTicket.id,
      {
        title: this.selectedTicket.title,
        description: this.selectedTicket.description,
        priority: this.selectedTicket.priority,
        dueDate: this.selectedTicket.dueDate,
        assigneeId: assignee?.id ?? null,
        assigneeName: assignee?.name ?? null,
        status: this.selectedTicket.status,
      },
      actor.name,
      'Detalle actualizado',
    );

    this.reloadTickets();
    this.messageService.add({ severity: 'success', summary: 'Cambios guardados', detail: 'Ticket actualizado.' });
  }

  addComment(): void {
    const actor = this.authService.getCurrentUser();
    if (!actor || !this.selectedTicket || !this.commentDraft.trim()) {
      return;
    }

    this.dataService.addTicketComment(this.selectedTicket.id, this.commentDraft.trim(), actor.id, actor.name);
    this.commentDraft = '';
    this.selectedTicket = this.dataService.getTicketById(this.selectedTicket.id);
    this.reloadTickets();
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

    const targetTicket = this.dataService.getTicketById(ticketId);
    if (!targetTicket || !this.canChangeStatus(targetTicket)) {
      return;
    }

    this.dataService.updateTicket(ticketId, { status }, currentUser.name, `Estado movido a ${status}`);
    this.reloadTickets();
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  deleteTicket(ticket: Ticket): void {
    this.dataService.deleteTicket(ticket.id);
    this.reloadTickets();
  }

  canEditFields(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    const isCreator = ticket.createdById === currentUser.id;
    const hasEditPermission = this.hasPermission(PERMISSIONS_CATALOG.TICKET_UPDATE);
    return isCreator && hasEditPermission;
  }

  canChangeStatus(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    return (
      this.hasPermission(PERMISSIONS_CATALOG.TICKET_CHANGE_STATUS) &&
      (ticket.createdById === currentUser.id || ticket.assigneeId === currentUser.id)
    );
  }

  canComment(ticket: Ticket): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    if (currentUser.isSuperAdmin) {
      return true;
    }

    return (
      this.hasPermission(PERMISSIONS_CATALOG.TICKET_COMMENT) &&
      (ticket.createdById === currentUser.id || ticket.assigneeId === currentUser.id)
    );
  }

  hasPermission(permission: typeof PERMISSIONS_CATALOG[keyof typeof PERMISSIONS_CATALOG]): boolean {
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

  private reloadTickets(): void {
    const groupId = this.authService.getSession()?.selectedGroupId;
    if (!groupId) {
      this.tickets = [];
      this.filteredTickets = [];
      return;
    }

    this.tickets = this.dataService.getTicketsByGroup(groupId);
    this.applyQuickFilter(this.quickFilter);
  }
}
