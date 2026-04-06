import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

// ---------------------------------------------------------------------------
// DB row types (snake_case matches Supabase columns)
// ---------------------------------------------------------------------------
export interface DbUser {
  id: string;
  full_name: string;
  username: string;
  email: string;
  password_hash: string;
  phone: string;
  birth_date: string;
  address: string;
  is_super_admin: boolean;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbGroup {
  id: string;
  name: string;
  description: string;
  llm_model: string;
  llm_color: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbGroupMember {
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface DbPermission {
  id: string;
  key: string;
  description: string;
}

export interface DbUserGroupPermission {
  id: string;
  group_id: string;
  user_id: string;
  permission_id: string;
  granted_by: string | null;
  granted_at: string;
}

export interface DbTicketStatus {
  id: string;
  name: string;
  sort_order: number;
}

export interface DbTicketPriority {
  id: string;
  name: string;
  sort_order: number;
}

export interface DbTicket {
  id: string;
  code: string;
  group_id: string;
  title: string;
  description: string;
  created_by: string;
  assignee_id: string | null;
  status_id: string;
  priority_id: string;
  due_date: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  message: string;
  created_at: string;
}

export interface DbTicketHistory {
  id: string;
  ticket_id: string;
  actor_id: string;
  action: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly base = `${environment.supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  private readonly key = environment.supabaseAnonKey;

  constructor(private readonly http: HttpClient) {}

  // --- Users ---
  getUsers(): Observable<DbUser[]> {
    return this.get<DbUser[]>('users', p().set('select', '*').set('order', 'created_at.asc'));
  }

  getUserByEmail(email: string): Observable<DbUser | null> {
    return this.get<DbUser[]>(
      'users',
      p().set('select', '*').set('email', `eq.${email}`).set('limit', '1'),
    ).pipe(
      map(rows => (Array.isArray(rows) && rows.length ? rows[0] : null)),
      catchError(() => of(null)),
    );
  }

  createUser(payload: Partial<DbUser>): Observable<DbUser[]> {
    return this.post<DbUser[]>('users', payload, true);
  }

  updateUser(id: string, patch: Partial<DbUser>): Observable<DbUser[]> {
    return this.patch<DbUser[]>('users', patch, p().set('id', `eq.${id}`), true);
  }

  softDeleteUser(id: string): Observable<unknown> {
    return this.patch<unknown>('users', { is_active: false }, p().set('id', `eq.${id}`), false);
  }

  // --- Groups ---
  getGroups(): Observable<DbGroup[]> {
    return this.get<DbGroup[]>('groups', p().set('select', '*').set('is_active', 'eq.true').set('order', 'created_at.asc'));
  }

  createGroup(payload: Partial<DbGroup>): Observable<DbGroup[]> {
    return this.post<DbGroup[]>('groups', payload, true);
  }

  updateGroup(id: string, patch: Partial<DbGroup>): Observable<DbGroup[]> {
    return this.patch<DbGroup[]>('groups', patch, p().set('id', `eq.${id}`), true);
  }

  softDeleteGroup(id: string): Observable<unknown> {
    return this.patch<unknown>('groups', { is_active: false }, p().set('id', `eq.${id}`), false);
  }

  // --- Group Members ---
  getMembersForGroup(groupId: string): Observable<DbGroupMember[]> {
    return this.get<DbGroupMember[]>('group_members', p().set('select', '*').set('group_id', `eq.${groupId}`));
  }

  getGroupsForUser(userId: string): Observable<DbGroupMember[]> {
    return this.get<DbGroupMember[]>('group_members', p().set('select', '*').set('user_id', `eq.${userId}`));
  }

  addGroupMember(groupId: string, userId: string): Observable<unknown> {
    return this.post<unknown>('group_members', { group_id: groupId, user_id: userId }, false);
  }

  removeGroupMember(groupId: string, userId: string): Observable<unknown> {
    return this.del('group_members', p().set('group_id', `eq.${groupId}`).set('user_id', `eq.${userId}`));
  }

  // --- Permissions catalog ---
  getPermissions(): Observable<DbPermission[]> {
    return this.get<DbPermission[]>('permissions', p().set('select', '*').set('order', 'key.asc'));
  }

  // --- User Group Permissions ---
  getUserGroupPermissions(userId: string, groupId: string): Observable<DbUserGroupPermission[]> {
    return this.get<DbUserGroupPermission[]>(
      'user_group_permissions',
      p().set('select', '*').set('user_id', `eq.${userId}`).set('group_id', `eq.${groupId}`),
    );
  }

  /** Replace all permissions for a user in a group (delete existing, then insert new) */
  setUserGroupPermissions(
    groupId: string,
    userId: string,
    permissionIds: string[],
    grantedBy: string | null,
  ): Observable<unknown> {
    const del$ = this.del(
      'user_group_permissions',
      p().set('group_id', `eq.${groupId}`).set('user_id', `eq.${userId}`),
    );
    if (!permissionIds.length) {
      return del$;
    }
    const rows = permissionIds.map(pid => ({
      group_id: groupId,
      user_id: userId,
      permission_id: pid,
      granted_by: grantedBy,
    }));
    return del$.pipe(
      switchMap(() => this.post<unknown>('user_group_permissions', rows, false)),
    );
  }

  // --- Ticket catalogs ---
  getTicketStatuses(): Observable<DbTicketStatus[]> {
    return this.get<DbTicketStatus[]>('ticket_statuses', p().set('select', '*').set('order', 'sort_order.asc'));
  }

  getTicketPriorities(): Observable<DbTicketPriority[]> {
    return this.get<DbTicketPriority[]>('ticket_priorities', p().set('select', '*').set('order', 'sort_order.asc'));
  }

  // --- Tickets ---
  getTicketsByGroup(groupId: string): Observable<DbTicket[]> {
    return this.get<DbTicket[]>('tickets', p().set('select', '*').set('group_id', `eq.${groupId}`).set('order', 'created_at.desc'));
  }

  getTickets(): Observable<DbTicket[]> {
    return this.get<DbTicket[]>('tickets', p().set('select', '*').set('order', 'created_at.desc'));
  }

  getTicketById(id: string): Observable<DbTicket[]> {
    return this.get<DbTicket[]>('tickets', p().set('select', '*').set('id', `eq.${id}`).set('limit', '1'));
  }

  createTicket(payload: Partial<DbTicket>): Observable<DbTicket[]> {
    return this.post<DbTicket[]>('tickets', payload, true);
  }

  updateTicket(id: string, patch: Partial<DbTicket>): Observable<DbTicket[]> {
    return this.patch<DbTicket[]>('tickets', patch, p().set('id', `eq.${id}`), true);
  }

  deleteTicket(id: string): Observable<unknown> {
    return this.del('tickets', p().set('id', `eq.${id}`));
  }

  // --- Ticket Comments ---
  getTicketComments(ticketId: string): Observable<DbTicketComment[]> {
    return this.get<DbTicketComment[]>(
      'ticket_comments',
      p().set('select', '*').set('ticket_id', `eq.${ticketId}`).set('order', 'created_at.asc'),
    );
  }

  addTicketComment(payload: Partial<DbTicketComment>): Observable<DbTicketComment[]> {
    return this.post<DbTicketComment[]>('ticket_comments', payload, true);
  }

  // --- Ticket History ---
  getTicketHistory(ticketId: string): Observable<DbTicketHistory[]> {
    return this.get<DbTicketHistory[]>(
      'ticket_history',
      p().set('select', '*').set('ticket_id', `eq.${ticketId}`).set('order', 'created_at.asc'),
    );
  }

  addTicketHistory(payload: Partial<DbTicketHistory>): Observable<DbTicketHistory[]> {
    return this.post<DbTicketHistory[]>('ticket_history', payload, true);
  }

  // ---------------------------------------------------------------------------
  // Private HTTP helpers
  // ---------------------------------------------------------------------------
  private headers(prefer?: string): HttpHeaders {
    let h = new HttpHeaders({
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    });
    if (prefer) h = h.set('Prefer', prefer);
    return h;
  }

  private get<T>(table: string, params?: HttpParams): Observable<T> {
    return this.http
      .get<T>(`${this.base}/${table}`, { headers: this.headers(), params })
      .pipe(catchError(() => of([] as unknown as T)));
  }

  private post<T>(table: string, body: unknown, returnRepresentation: boolean): Observable<T> {
    return this.http
      .post<T>(`${this.base}/${table}`, body, {
        headers: this.headers(returnRepresentation ? 'return=representation' : undefined),
      })
      .pipe(catchError(() => of([] as unknown as T)));
  }

  private patch<T>(table: string, body: unknown, params: HttpParams, returnRepresentation: boolean): Observable<T> {
    return this.http
      .patch<T>(`${this.base}/${table}`, body, {
        headers: this.headers(returnRepresentation ? 'return=representation' : undefined),
        params,
      })
      .pipe(catchError(() => of([] as unknown as T)));
  }

  private del(table: string, params: HttpParams): Observable<unknown> {
    return this.http
      .delete(`${this.base}/${table}`, { headers: this.headers(), params })
      .pipe(catchError(() => of(null)));
  }
}

function p(): HttpParams {
  return new HttpParams();
}
