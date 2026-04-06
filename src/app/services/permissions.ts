
import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import {
	AppGroup,
	AppUser,
	MOCK_GROUPS,
	PermissionKey,
	Ticket,
	TicketComment,
	TicketHistoryEntry,
	TicketPriority,
	TicketStatus,
} from '../models/permissions.model';
import { SupabaseService, DbTicketStatus, DbTicketPriority } from './supabase.service';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------
function dbGroupToApp(g: { id: string; name: string; description: string; llm_model: string; llm_color: string }): AppGroup {
	return {
		id: g.id,
		name: g.name ?? '',
		description: g.description ?? '',
		llmModel: g.llm_model ?? '',
		llmColor: g.llm_color ?? '#3b82f6',
	};
}

@Injectable({ providedIn: 'root' })
export class Permissions {
	private statusCache: DbTicketStatus[] = [];
	private priorityCache: DbTicketPriority[] = [];

	constructor(
		private readonly db: SupabaseService,
		private readonly authService: AuthService,
	) {}

	// ---------------------------------------------------------------------------
	// Groups — DB
	// ---------------------------------------------------------------------------

	getGroups$(): Observable<AppGroup[]> {
		return this.db.getGroups().pipe(map(rows => rows.map(r => dbGroupToApp(r))));
	}

	/** Synchronous fallback for session group label — returns from MOCK if not in DB yet */
	getGroupById(groupId: string): AppGroup | null {
		return MOCK_GROUPS.find(g => g.id === groupId) ?? null;
	}

	getGroupById$(groupId: string): Observable<AppGroup | null> {
		return this.db.getGroups().pipe(
			map(rows => {
				const found = rows.find(r => r.id === groupId);
				return found ? dbGroupToApp(found) : null;
			}),
		);
	}

	createGroup$(group: Partial<AppGroup>, createdBy: string | null): Observable<AppGroup | null> {
		return this.db.createGroup({
			name: group.name ?? '',
			description: group.description ?? '',
			llm_model: group.llmModel ?? '',
			llm_color: group.llmColor ?? '#3b82f6',
			created_by: createdBy,
			is_active: true,
		}).pipe(map(rows => (rows[0] ? dbGroupToApp(rows[0]) : null)));
	}

	updateGroup$(id: string, group: Partial<AppGroup>): Observable<AppGroup | null> {
		return this.db.updateGroup(id, {
			name: group.name,
			description: group.description,
			llm_model: group.llmModel,
			llm_color: group.llmColor,
		}).pipe(map(rows => (rows[0] ? dbGroupToApp(rows[0]) : null)));
	}

	deleteGroup$(id: string): Observable<void> {
		return this.db.softDeleteGroup(id).pipe(map(() => void 0));
	}

	// ---------------------------------------------------------------------------
	// Group members — DB
	// ---------------------------------------------------------------------------

	getUsersInGroup$(groupId: string): Observable<AppUser[]> {
		return this.db.getMembersForGroup(groupId).pipe(
			switchMap(members => {
				if (!members.length) return of([]);
				return this.db.getUsers().pipe(
					map(users =>
						users
							.filter(u => members.some(m => m.user_id === u.id))
							.map(u => this.authService.dbUserToAppUser(u, [], {})),
					),
				);
			}),
		);
	}

	addMemberToGroup$(groupId: string, userId: string): Observable<void> {
		return this.db.addGroupMember(groupId, userId).pipe(map(() => void 0));
	}

	removeMemberFromGroup$(groupId: string, userId: string): Observable<void> {
		return this.db.removeGroupMember(groupId, userId).pipe(map(() => void 0));
	}

	// ---------------------------------------------------------------------------
	// Permissions (session-level, synchronous)
	// ---------------------------------------------------------------------------

	getCurrentGroupPermissions(user: AppUser, groupId: string): PermissionKey[] {
		return user.permissionsByGroup[groupId] ?? [];
	}

	getTicketStatuses$(): Observable<TicketStatus[]> {
		return this.ensureStatusCache$().pipe(
			map(statuses => statuses.map(status => status.name as TicketStatus)),
		);
	}

	getTicketPriorities$(): Observable<TicketPriority[]> {
		return this.ensurePriorityCache$().pipe(
			map(priorities => priorities.map(priority => priority.name as TicketPriority)),
		);
	}

	// ---------------------------------------------------------------------------
	// Tickets — DB
	// ---------------------------------------------------------------------------

	getTicketsByGroup$(groupId: string): Observable<Ticket[]> {
		return forkJoin([
			this.db.getTicketsByGroup(groupId),
			this.ensureStatusCache$(),
			this.ensurePriorityCache$(),
			this.db.getUsers(),
		]).pipe(
			switchMap(([tickets, statuses, priorities, users]) => {
				const source$ = tickets.length
					? of(tickets)
					: this.db.getTickets().pipe(map(all => all.filter(ticket => ticket.group_id === groupId)));

				return source$.pipe(
					map(effectiveTickets =>
						effectiveTickets.map(t => ({
							id: t.id,
							groupId: t.group_id,
							title: t.title,
							description: t.description ?? '',
							status: (statuses.find(s => s.id === t.status_id)?.name ?? 'Pendiente') as TicketStatus,
							assigneeId: t.assignee_id,
							assigneeName: t.assignee_id
								? (users.find(u => u.id === t.assignee_id)?.full_name ?? null)
								: null,
							createdById: t.created_by,
							createdByName: users.find(u => u.id === t.created_by)?.full_name ?? 'Desconocido',
							priority: (priorities.find(p => p.id === t.priority_id)?.name ?? 'Media') as TicketPriority,
							createdAt: t.created_at,
							dueDate: t.due_date ?? '',
							comments: [],
							history: [],
						})),
					),
				);
			}),
		);
	}

	getAllTickets$(): Observable<Ticket[]> {
		return forkJoin([
			this.db.getTickets(),
			this.ensureStatusCache$(),
			this.ensurePriorityCache$(),
			this.db.getUsers(),
		]).pipe(
			map(([tickets, statuses, priorities, users]) =>
				tickets.map(t => ({
					id: t.id,
					groupId: t.group_id,
					title: t.title,
					description: t.description ?? '',
					status: (statuses.find(s => s.id === t.status_id)?.name ?? 'Pendiente') as TicketStatus,
					assigneeId: t.assignee_id,
					assigneeName: t.assignee_id
						? (users.find(u => u.id === t.assignee_id)?.full_name ?? null)
						: null,
					createdById: t.created_by,
					createdByName: users.find(u => u.id === t.created_by)?.full_name ?? 'Desconocido',
					priority: (priorities.find(p => p.id === t.priority_id)?.name ?? 'Media') as TicketPriority,
					createdAt: t.created_at,
					dueDate: t.due_date ?? '',
					comments: [],
					history: [],
				})),
			),
		);
	}

	getTicketById$(ticketId: string): Observable<Ticket | null> {
		return forkJoin([
			this.db.getTicketById(ticketId),
			this.ensureStatusCache$(),
			this.ensurePriorityCache$(),
			this.db.getUsers(),
			this.db.getTicketComments(ticketId),
			this.db.getTicketHistory(ticketId),
		]).pipe(
			map(([rows, statuses, priorities, users, comments, history]) => {
				const t = rows[0];
				if (!t) return null;
				const mappedComments: TicketComment[] = comments.map(c => ({
					id: c.id,
					authorId: c.author_id,
					authorName: users.find(u => u.id === c.author_id)?.full_name ?? 'Desconocido',
					message: c.message,
					createdAt: c.created_at,
				}));
				const mappedHistory: TicketHistoryEntry[] = history.map(h => ({
					id: h.id,
					at: h.created_at,
					actorName: users.find(u => u.id === h.actor_id)?.full_name ?? 'Desconocido',
					action: h.action,
				}));
				return {
					id: t.id,
					groupId: t.group_id,
					title: t.title,
					description: t.description ?? '',
					status: (statuses.find(s => s.id === t.status_id)?.name ?? 'Pendiente') as TicketStatus,
					assigneeId: t.assignee_id,
					assigneeName: t.assignee_id
						? (users.find(u => u.id === t.assignee_id)?.full_name ?? null)
						: null,
					createdById: t.created_by,
					createdByName: users.find(u => u.id === t.created_by)?.full_name ?? 'Desconocido',
					priority: (priorities.find(p => p.id === t.priority_id)?.name ?? 'Media') as TicketPriority,
					createdAt: t.created_at,
					dueDate: t.due_date ?? '',
					comments: mappedComments,
					history: mappedHistory,
				} as Ticket;
			}),
		);
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
		if (!actor) return of(null);

		return forkJoin([this.ensureStatusCache$(), this.ensurePriorityCache$()]).pipe(
			switchMap(([statuses, priorities]) => {
				const statusId = statuses.find(s => s.name === input.status)?.id;
				const priorityId = priorities.find(p => p.name === input.priority)?.id;
				if (!statusId || !priorityId) return of(null);

				const code = `TK-${Math.floor(Math.random() * 90000) + 10000}`;
				return this.db
					.createTicket({
						code,
						group_id: input.groupId,
						title: input.title,
						description: input.description,
						created_by: actor.id,
						assignee_id: input.assigneeId,
						status_id: statusId,
						priority_id: priorityId,
						due_date: input.dueDate || null,
					})
					.pipe(
						switchMap(rows => {
							if (!rows[0]) return of(null);
							this.db
								.addTicketHistory({ ticket_id: rows[0].id, actor_id: actor.id, action: 'Ticket creado' })
								.subscribe();
							return this.getTicketById$(rows[0].id);
						}),
					);
			}),
		);
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
		return forkJoin([this.ensureStatusCache$(), this.ensurePriorityCache$()]).pipe(
			switchMap(([statuses, priorities]) => {
				const patch: Record<string, unknown> = {};
				if (updates.title !== undefined) patch['title'] = updates.title;
				if (updates.description !== undefined) patch['description'] = updates.description;
				if (updates.dueDate !== undefined) patch['due_date'] = updates.dueDate || null;
				if (updates.assigneeId !== undefined) patch['assignee_id'] = updates.assigneeId;
				if (updates.status) {
					const s = statuses.find(s => s.name === updates.status);
					if (s) patch['status_id'] = s.id;
					if (updates.status === 'Hecho') patch['closed_at'] = new Date().toISOString();
				}
				if (updates.priority) {
					const pr = priorities.find(p => p.name === updates.priority);
					if (pr) patch['priority_id'] = pr.id;
				}

				return this.db.updateTicket(ticketId, patch as never).pipe(
					switchMap(() => {
						this.db
							.addTicketHistory({ ticket_id: ticketId, actor_id: actorId, action })
							.subscribe();
						return this.getTicketById$(ticketId);
					}),
				);
			}),
		);
	}

	deleteTicket$(ticketId: string): Observable<void> {
		return this.db.deleteTicket(ticketId).pipe(map(() => void 0));
	}

	addTicketComment$(
		ticketId: string,
		message: string,
		authorId: string,
	): Observable<Ticket | null> {
		return this.db
			.addTicketComment({ ticket_id: ticketId, author_id: authorId, message })
			.pipe(switchMap(() => this.getTicketById$(ticketId)));
	}

	// ---------------------------------------------------------------------------
	// Private catalog helpers
	// ---------------------------------------------------------------------------

	private ensureStatusCache$(): Observable<DbTicketStatus[]> {
		if (this.statusCache.length) return of(this.statusCache);
		return this.db.getTicketStatuses().pipe(map(s => { this.statusCache = s; return s; }));
	}

	private ensurePriorityCache$(): Observable<DbTicketPriority[]> {
		if (this.priorityCache.length) return of(this.priorityCache);
		return this.db.getTicketPriorities().pipe(map(p => { this.priorityCache = p; return p; }));
	}
}

