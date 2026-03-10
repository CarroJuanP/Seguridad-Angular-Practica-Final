import { Injectable } from '@angular/core';
import {
  AppGroup,
  AppUser,
  MOCK_GROUPS,
  MOCK_TICKETS,
  PermissionKey,
  Ticket,
  TicketComment,
  TicketHistoryEntry,
  TicketPriority,
  TicketStatus,
} from '../models/permissions.model';
import { AuthService } from './auth.service';

const GROUPS_KEY = 'app-groups';
const TICKETS_KEY = 'app-tickets';

@Injectable({ providedIn: 'root' })
export class Permissions {
  constructor(private readonly authService: AuthService) {
    this.ensureSeedData();
  }

  getGroups(): AppGroup[] {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? (JSON.parse(raw) as AppGroup[]) : [];
  }

  saveGroups(groups: AppGroup[]): void {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }

  getGroupById(groupId: string): AppGroup | null {
    return this.getGroups().find(group => group.id === groupId) ?? null;
  }

  getCurrentGroupPermissions(user: AppUser, groupId: string): PermissionKey[] {
    if (user.isSuperAdmin) {
      return [...new Set(Object.values(user.permissionsByGroup).flat())];
    }

    return user.permissionsByGroup[groupId] ?? [];
  }

  getTicketsByGroup(groupId: string): Ticket[] {
    return this.getTickets().filter(ticket => ticket.groupId === groupId);
  }

  getTicketById(ticketId: string): Ticket | null {
    return this.getTickets().find(ticket => ticket.id === ticketId) ?? null;
  }

  createTicket(input: {
    groupId: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    dueDate: string;
    assigneeId: string | null;
    assigneeName: string | null;
  }): Ticket {
    const user = this.authService.getCurrentUser();
    if (!user) {
      throw new Error('No hay usuario autenticado.');
    }

    const createdAt = new Date().toISOString();
    const ticket: Ticket = {
      id: this.generateTicketId(),
      groupId: input.groupId,
      title: input.title,
      description: input.description,
      status: input.status,
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
      createdById: user.id,
      createdByName: user.name,
      priority: input.priority,
      createdAt,
      dueDate: input.dueDate,
      comments: [],
      history: [
        {
          id: this.generateId('h'),
          at: createdAt,
          actorName: user.name,
          action: 'Ticket creado',
        },
      ],
    };

    const tickets = this.getTickets();
    tickets.unshift(ticket);
    this.saveTickets(tickets);
    return ticket;
  }

  updateTicket(ticketId: string, updates: Partial<Ticket>, actorName: string, action: string): Ticket | null {
    const tickets = this.getTickets();
    const index = tickets.findIndex(ticket => ticket.id === ticketId);
    if (index === -1) {
      return null;
    }

    const updated: Ticket = {
      ...tickets[index],
      ...updates,
      history: [
        ...tickets[index].history,
        {
          id: this.generateId('h'),
          at: new Date().toISOString(),
          actorName,
          action,
        },
      ],
    };

    tickets[index] = updated;
    this.saveTickets(tickets);
    return updated;
  }

  deleteTicket(ticketId: string): void {
    const tickets = this.getTickets().filter(ticket => ticket.id !== ticketId);
    this.saveTickets(tickets);
  }

  addTicketComment(ticketId: string, message: string, authorId: string, authorName: string): Ticket | null {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) {
      return null;
    }

    const comment: TicketComment = {
      id: this.generateId('c'),
      authorId,
      authorName,
      message,
      createdAt: new Date().toISOString(),
    };

    const historyEntry: TicketHistoryEntry = {
      id: this.generateId('h'),
      at: new Date().toISOString(),
      actorName: authorName,
      action: 'Comentario agregado',
    };

    return this.updateTicket(
      ticketId,
      {
        comments: [...ticket.comments, comment],
        history: [...ticket.history, historyEntry],
      },
      authorName,
      'Actividad registrada',
    );
  }

  getUsersInGroup(groupId: string): AppUser[] {
    return this.authService.getUsers().filter(user => user.groupIds.includes(groupId));
  }

  private getTickets(): Ticket[] {
    const raw = localStorage.getItem(TICKETS_KEY);
    return raw ? (JSON.parse(raw) as Ticket[]) : [];
  }

  private saveTickets(tickets: Ticket[]): void {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  }

  private ensureSeedData(): void {
    if (!localStorage.getItem(GROUPS_KEY)) {
      this.saveGroups(MOCK_GROUPS);
    }

    if (!localStorage.getItem(TICKETS_KEY)) {
      this.saveTickets(MOCK_TICKETS);
    }
  }

  private generateTicketId(): string {
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `TK-${random}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
