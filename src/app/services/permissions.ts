// Fachada de dominio para grupos, usuarios de grupo, tickets y catalogos.
// La UI consume este servicio, pero la fuente de datos operativa es siempre el API Gateway.
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
	AppGroup,
	AppUser,
	PermissionKey,
	Ticket,
	TicketPriority,
	TicketStatus,
} from '../models/permissions.model';
import { AuthService } from './auth.service';
import { GatewayApiService, type GroupTicketSummary } from './gateway-api.service';

@Injectable({ providedIn: 'root' })
export class Permissions {
	constructor(
		private readonly authService: AuthService,
		private readonly gatewayApi: GatewayApiService,
	) {}

	getGroups$(): Observable<AppGroup[]> {
		return this.gatewayApi.getGroups();
	}

	getGroupById$(groupId: string): Observable<AppGroup | null> {
		return this.gatewayApi.getGroupById(groupId);
	}

	createGroup$(group: Partial<AppGroup>, createdBy: string | null): Observable<AppGroup | null> {
		return this.gatewayApi.createGroup({
			name: group.name ?? '',
			description: group.description ?? '',
			llmModel: group.llmModel ?? '',
			llmColor: group.llmColor ?? '#3b82f6',
			createdBy,
		});
	}

	updateGroup$(id: string, group: Partial<AppGroup>): Observable<AppGroup | null> {
		return this.gatewayApi.updateGroup(id, group);
	}

	deleteGroup$(id: string): Observable<void> {
		return this.gatewayApi.deleteGroup(id);
	}

	getUsersInGroup$(groupId: string): Observable<AppUser[]> {
		return this.gatewayApi.getUsersInGroup(groupId);
	}

	getGroupTicketSummary$(groupId: string): Observable<GroupTicketSummary | null> {
		return this.gatewayApi.getGroupTicketSummary(groupId);
	}

	addMemberToGroup$(groupId: string, userId: string): Observable<void> {
		return this.gatewayApi.addMemberToGroup(groupId, userId);
	}

	removeMemberFromGroup$(groupId: string, userId: string): Observable<void> {
		return this.gatewayApi.removeMemberFromGroup(groupId, userId);
	}

	getCurrentGroupPermissions(user: AppUser, groupId: string): PermissionKey[] {
		return user.permissionsByGroup[groupId] ?? [];
	}

	getTicketStatuses$(): Observable<TicketStatus[]> {
		return this.gatewayApi.getTicketStatuses();
	}

	getTicketPriorities$(): Observable<TicketPriority[]> {
		return this.gatewayApi.getTicketPriorities();
	}

	getTicketsByGroup$(groupId: string): Observable<Ticket[]> {
		return this.gatewayApi.getAllTickets(groupId);
	}

	getAllTickets$(): Observable<Ticket[]> {
		return this.gatewayApi.getAllTickets();
	}

	getTicketById$(ticketId: string): Observable<Ticket | null> {
		return this.gatewayApi.getTicketById(ticketId);
	}

	createTicket$(input: {
		groupId: string;
		title: string;
		description: string;
		status: TicketStatus;
		priority: TicketPriority;
		dueDate: string;
		assigneeId: string | null;
	}): Observable<Ticket | null> {
		const actor = this.authService.getCurrentUser();
		if (!actor) {
			return of(null);
		}

		return this.gatewayApi.createTicket({
			...input,
			createdBy: actor.id,
		});
	}

	updateTicket$(
		ticketId: string,
		updates: {
			title?: string;
			description?: string;
			status?: TicketStatus;
			priority?: TicketPriority;
			dueDate?: string;
			assigneeId?: string | null;
		},
		actorId: string,
		action: string,
	): Observable<Ticket | null> {
		return this.gatewayApi.updateTicket(ticketId, {
			title: updates.title,
			description: updates.description,
			status: updates.status,
			priority: updates.priority,
			dueDate: updates.dueDate,
			assigneeId: updates.assigneeId,
			actorId,
			action,
		});
	}

	deleteTicket$(ticketId: string): Observable<void> {
		return this.gatewayApi.deleteTicket(ticketId);
	}

	addTicketComment$(ticketId: string, message: string, authorId: string): Observable<Ticket | null> {
		return this.gatewayApi.addTicketComment(ticketId, { authorId, message });
	}
}

