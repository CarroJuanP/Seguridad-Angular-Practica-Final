import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppGroup, AppUser, Ticket, TicketPriority, TicketStatus } from '../models/permissions.model';

type GatewayEnvelope<T> = {
  statusCode?: number;
  intOpCode?: string;
  data?: T | null;
  message?: string;
};

type GatewayLoginData = {
  token: string;
  user: AppUser;
};

type GatewayRegisterPayload = {
  name: string;
  email: string;
  username: string;
  password: string;
  phone?: string;
  birthDate?: string;
  address?: string;
};

type GatewayMutationResult<T> = {
  ok: boolean;
  data: T | null;
  message?: string;
  statusCode?: number;
};

export type GroupTicketSummary = {
  groupId: string;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

const SESSION_KEY = 'app-session';
const AUTH_TOKEN_COOKIE = 'erp_token';

@Injectable({ providedIn: 'root' })
export class GatewayApiService {
  private readonly baseUrl = environment.gatewayApiUrl.trim();

  constructor(private readonly http: HttpClient) {}

  isEnabled(): boolean {
    return this.baseUrl.length > 0;
  }

  login(identifier: string, password: string): Observable<GatewayLoginData | null> {
    return this.post<GatewayLoginData | null>('/auth/login', { identifier, password }, null);
  }

  register(payload: GatewayRegisterPayload): Observable<GatewayMutationResult<AppUser>> {
    return this.postResult<AppUser>('/auth/register', payload);
  }

  getGroups(): Observable<AppGroup[]> {
    return this.get<AppGroup[]>('/groups', []);
  }

  getGroupById(groupId: string): Observable<AppGroup | null> {
    return this.get<AppGroup | null>(`/groups/${groupId}`, null);
  }

  createGroup(payload: { name: string; description: string; llmModel: string; llmColor: string; createdBy: string | null }): Observable<AppGroup | null> {
    return this.postMutation<AppGroup | null>('/groups', payload, null);
  }

  updateGroup(groupId: string, payload: Partial<AppGroup>): Observable<AppGroup | null> {
    return this.patchMutation<AppGroup | null>(`/groups/${groupId}`, payload, null);
  }

  deleteGroup(groupId: string): Observable<void> {
    return this.deleteMutation(`/groups/${groupId}`);
  }

  getUsers(): Observable<AppUser[]> {
    return this.get<AppUser[]>('/users', []);
  }

  createUser(user: AppUser): Observable<AppUser | null> {
    return this.postMutation<AppUser | null>('/users', user, null);
  }

  updateUser(userId: string, user: AppUser): Observable<AppUser | null> {
    return this.patchMutation<AppUser | null>(`/users/${userId}`, user, null);
  }

  deleteUser(userId: string): Observable<void> {
    return this.deleteMutation(`/users/${userId}`);
  }

  getUsersInGroup(groupId: string): Observable<AppUser[]> {
    return this.get<AppUser[]>(`/groups/${groupId}/users`, []);
  }

  getGroupTicketSummary(groupId: string): Observable<GroupTicketSummary | null> {
    return this.get<GroupTicketSummary | null>(`/groups/${groupId}/ticket-summary`, null);
  }

  addMemberToGroup(groupId: string, userId: string): Observable<void> {
    return this.postMutation(`/groups/${groupId}/users`, { userId }, null).pipe(map(() => void 0));
  }

  removeMemberFromGroup(groupId: string, userId: string): Observable<void> {
    return this.deleteMutation(`/groups/${groupId}/users/${userId}`);
  }

  getTicketStatuses(): Observable<TicketStatus[]> {
    return this.get<TicketStatus[]>('/catalogs/ticket-statuses', []);
  }

  getTicketPriorities(): Observable<TicketPriority[]> {
    return this.get<TicketPriority[]>('/catalogs/ticket-priorities', []);
  }

  getAllTickets(groupId?: string): Observable<Ticket[]> {
    const suffix = groupId ? `/tickets?groupId=${encodeURIComponent(groupId)}` : '/tickets';
    return this.get<Ticket[]>(suffix, []);
  }

  getTicketById(ticketId: string): Observable<Ticket | null> {
    return this.get<Ticket | null>(`/tickets/${ticketId}`, null);
  }

  createTicket(payload: {
    groupId: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    dueDate: string;
    assigneeId: string | null;
    createdBy: string;
  }): Observable<Ticket | null> {
    return this.postMutation<Ticket | null>('/tickets', payload, null);
  }

  updateTicket(ticketId: string, payload: {
    title?: string;
    description?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    dueDate?: string;
    assigneeId?: string | null;
    actorId?: string;
    action?: string;
  }): Observable<Ticket | null> {
    return this.patchMutation<Ticket | null>(`/tickets/${ticketId}`, payload, null);
  }

  deleteTicket(ticketId: string): Observable<void> {
    return this.deleteMutation(`/tickets/${ticketId}`);
  }

  addTicketComment(ticketId: string, payload: { authorId: string; message: string }): Observable<Ticket | null> {
    return this.postMutation<Ticket | null>(`/tickets/${ticketId}/comments`, payload, null);
  }

  private get<T>(path: string, fallback: T): Observable<T> {
    if (!this.isEnabled()) {
      return of(fallback);
    }

    return this.http.get<GatewayEnvelope<T>>(`${this.baseUrl}${path}`, { headers: this.buildAuthHeaders() }).pipe(
      map(response => response.data ?? fallback),
      catchError(() => of(fallback)),
    );
  }

  private post<T>(path: string, payload: unknown, fallback: T): Observable<T> {
    if (!this.isEnabled()) {
      return of(fallback);
    }

    return this.http.post<GatewayEnvelope<T>>(`${this.baseUrl}${path}`, payload, { headers: this.buildAuthHeaders() }).pipe(
      map(response => response.data ?? fallback),
      catchError(() => of(fallback)),
    );
  }

  private postResult<T>(path: string, payload: unknown): Observable<GatewayMutationResult<T>> {
    if (!this.isEnabled()) {
      return of({ ok: false, data: null, message: 'API Gateway no configurado.' });
    }

    return this.http.post<GatewayEnvelope<T>>(`${this.baseUrl}${path}`, payload, { headers: this.buildAuthHeaders() }).pipe(
      map(response => ({
        ok: true,
        data: response.data ?? null,
        message: response.message,
        statusCode: response.statusCode,
      })),
      catchError(error => of(this.toGatewayMutationError<T>(error))),
    );
  }

  private postMutation<T>(path: string, payload: unknown, fallback: T): Observable<T> {
    if (!this.isEnabled()) {
      return throwError(() => new Error('API Gateway no configurado.'));
    }

    return this.http.post<GatewayEnvelope<T>>(`${this.baseUrl}${path}`, payload, { headers: this.buildAuthHeaders() }).pipe(
      map(response => response.data ?? fallback),
      catchError(error => this.asMutationFailure(error)),
    );
  }

  private patch<T>(path: string, payload: unknown, fallback: T): Observable<T> {
    if (!this.isEnabled()) {
      return of(fallback);
    }

    return this.http.patch<GatewayEnvelope<T>>(`${this.baseUrl}${path}`, payload, { headers: this.buildAuthHeaders() }).pipe(
      map(response => response.data ?? fallback),
      catchError(() => of(fallback)),
    );
  }

  private patchMutation<T>(path: string, payload: unknown, fallback: T): Observable<T> {
    if (!this.isEnabled()) {
      return throwError(() => new Error('API Gateway no configurado.'));
    }

    return this.http.patch<GatewayEnvelope<T>>(`${this.baseUrl}${path}`, payload, { headers: this.buildAuthHeaders() }).pipe(
      map(response => response.data ?? fallback),
      catchError(error => this.asMutationFailure(error)),
    );
  }

  private delete(path: string): Observable<void> {
    if (!this.isEnabled()) {
      return of(void 0);
    }

    return this.http.delete<GatewayEnvelope<unknown>>(`${this.baseUrl}${path}`, { headers: this.buildAuthHeaders() }).pipe(
      map(() => void 0),
      catchError(() => of(void 0)),
    );
  }

  private deleteMutation(path: string): Observable<void> {
    if (!this.isEnabled()) {
      return throwError(() => new Error('API Gateway no configurado.'));
    }

    return this.http.delete<GatewayEnvelope<unknown>>(`${this.baseUrl}${path}`, { headers: this.buildAuthHeaders() }).pipe(
      map(() => void 0),
      catchError(error => this.asMutationFailure(error)),
    );
  }

  private buildAuthHeaders(): HttpHeaders {
    const token = this.readToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private readToken(): string {
    const cookieToken = this.readCookie(AUTH_TOKEN_COOKIE);
    if (cookieToken) {
      return cookieToken;
    }

    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      return '';
    }

    try {
      const parsed = JSON.parse(rawSession) as { token?: unknown };
      return typeof parsed.token === 'string' ? parsed.token : '';
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return '';
    }
  }

  private readCookie(name: string): string {
    return document.cookie
      .split(';')
      .map(fragment => fragment.trim())
      .find(fragment => fragment.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? '';
  }

  private toGatewayMutationError<T>(error: unknown): GatewayMutationResult<T> {
    if (error instanceof HttpErrorResponse) {
      const envelope = this.asGatewayEnvelope<T>(error.error);
      return {
        ok: false,
        data: null,
        message: envelope?.message || this.readErrorMessage(error.error) || error.message || 'Error inesperado del API Gateway.',
        statusCode: envelope?.statusCode ?? error.status,
      };
    }

    return {
      ok: false,
      data: null,
      message: 'Error inesperado del API Gateway.',
    };
  }

  private asGatewayEnvelope<T>(value: unknown): GatewayEnvelope<T> | null {
    if (value !== null && typeof value === 'object') {
      return value as GatewayEnvelope<T>;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed !== null && typeof parsed === 'object'
          ? parsed as GatewayEnvelope<T>
          : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private readErrorMessage(value: unknown): string {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }

      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown };
        return typeof parsed.message === 'string' ? parsed.message : trimmed;
      } catch {
        return trimmed;
      }
    }

    if (value !== null && typeof value === 'object' && 'message' in value) {
      const candidate = (value as { message?: unknown }).message;
      return typeof candidate === 'string' ? candidate : '';
    }

    return '';
  }

  private asMutationFailure(error: unknown): Observable<never> {
    const gatewayError = this.toGatewayMutationError(error);
    return throwError(() => new Error(gatewayError.message || 'Error inesperado del API Gateway.'));
  }

}
