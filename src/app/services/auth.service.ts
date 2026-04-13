// Servicio central de autenticacion y sesion.
// Mantiene el estado local del usuario y usa exclusivamente el API Gateway como fuente operativa.
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';
import {
  ALL_PERMISSIONS,
  AppUser,
  PermissionKey,
  UserSession,
} from '../models/permissions.model';
import { GatewayApiService } from './gateway-api.service';

const USERS_KEY = 'app-users';
const SESSION_KEY = 'app-session';
const AUTH_TOKEN_COOKIE = 'erp_token';
const AUTH_PERSIST_IN_LOCAL_STORAGE = true;

const authMemoryState: {
  users: AppUser[];
  session: UserSession | null;
} = {
  users: [],
  session: null,
};

type GatewayLoginResult = {
  token: string;
  user?: unknown;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<UserSession | null>(this.readSession());
  readonly session$ = this.sessionSubject.asObservable();

  constructor(private readonly gatewayApi: GatewayApiService) {
    this.normalizePersistedUsers();
  }

  login(identifier: string, password: string): Observable<AppUser | null> {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!this.gatewayApi.isEnabled()) {
      return of(null);
    }

    return this.gatewayApi.login(normalizedIdentifier, password).pipe(
      map(result => result?.token
        ? this.persistGatewayLogin(result as GatewayLoginResult, password, normalizedIdentifier)
        : null),
      catchError(() => of(null)),
    );
  }

  registerUser(input: {
    email: string;
    password: string;
    name?: string;
    username?: string;
    phone?: string;
    birthDate?: string;
    address?: string;
  }): Observable<{ ok: boolean; message?: string }> {
    const email = input.email.trim().toLowerCase();
    const username = (input.username ?? email.split('@')[0]).trim();

    if (!this.gatewayApi.isEnabled()) {
      return of({ ok: false, message: 'API Gateway no configurado.' });
    }

    if (!email || !input.password) {
      return of({ ok: false, message: 'Email y password son obligatorios.' });
    }

    return this.gatewayApi.register({
      name: input.name ?? this.buildDisplayName(email),
      email,
      username,
      password: input.password,
      phone: input.phone,
      birthDate: input.birthDate,
      address: input.address,
    }).pipe(
      map(result => result.ok && result.data
        ? { ok: true as const }
        : { ok: false as const, message: result.message ?? 'No se pudo registrar el usuario mediante el API Gateway.' }),
      catchError(() => of({ ok: false as const, message: 'No se pudo registrar el usuario mediante el API Gateway.' })),
    );
  }

  logout(): void {
    if (AUTH_PERSIST_IN_LOCAL_STORAGE) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      authMemoryState.session = null;
    }

    this.clearAuthCookie();
    this.sessionSubject.next(null);
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  getSession(): UserSession | null {
    return this.sessionSubject.value;
  }

  updateSession(partial: Partial<UserSession>): void {
    const current = this.getSession();
    if (!current) {
      return;
    }

    this.persistSession({ ...current, ...partial });
  }

  getCurrentUser(): AppUser | null {
    const session = this.getSession();
    if (!session) {
      return null;
    }

    const users = this.getUsers();
    const byId = users.find(user => user.id === session.userId) ?? null;
    if (byId) {
      return byId;
    }

    const normalizedEmail = session.email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const byEmail = users.find(user => user.email.toLowerCase() === normalizedEmail) ?? null;
    if (!byEmail) {
      return null;
    }

    this.syncSessionFromUser(byEmail, session.token);
    return byEmail;
  }

  getUsers(): AppUser[] {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      return authMemoryState.users.map((user, index) => this.normalizeUser(user, index));
    }

    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      localStorage.removeItem(USERS_KEY);
      return [];
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((user, index) => this.normalizeUser(user, index));
  }

  saveUsers(users: AppUser[]): void {
    const normalizedUsers = users.map((user, index) => this.normalizeUser(user, index));
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      authMemoryState.users = normalizedUsers;
      return;
    }

    localStorage.setItem(USERS_KEY, JSON.stringify(normalizedUsers));
  }

  getUsers$(): Observable<AppUser[]> {
    if (!this.gatewayApi.isEnabled()) {
      return of(this.getUsers());
    }

    return this.gatewayApi.getUsers().pipe(
      map(usersFromGateway => {
        if (!usersFromGateway.length) {
          return this.getUsers();
        }

        const mergedUsers = this.mergeUsersWithCache(usersFromGateway);
        this.saveUsers(mergedUsers);
        return mergedUsers;
      }),
      catchError(() => of(this.getUsers())),
    );
  }

  upsertUserInDB$(user: AppUser, isNew: boolean): Observable<{ ok: boolean; message?: string }> {
    if (!this.gatewayApi.isEnabled()) {
      return of({ ok: false, message: 'API Gateway no configurado.' });
    }

    const request$ = isNew
      ? this.gatewayApi.createUser(user)
      : this.gatewayApi.updateUser(user.id, user);

    return request$.pipe(
      map(savedUser => {
        if (!savedUser) {
          return { ok: false as const, message: 'No se pudo guardar el usuario en el gateway.' };
        }

        const mergedSavedUser = this.mergeUsersWithCache([{ ...savedUser, password: user.password }])[0] ?? savedUser;
        const users = this.getUsers().filter(currentUser => currentUser.id !== mergedSavedUser.id);
        users.push(mergedSavedUser);
        this.saveUsers(users);

        const session = this.getSession();
        if (session?.userId === mergedSavedUser.id || session?.email.toLowerCase() === mergedSavedUser.email.toLowerCase()) {
          this.syncSessionFromUser(mergedSavedUser, session?.token);
        }

        return { ok: true as const };
      }),
      catchError(err => of({ ok: false as const, message: String(err?.message ?? 'Error al guardar usuario') })),
    );
  }

  updateOwnProfile$(user: AppUser): Observable<{ ok: boolean; message?: string }> {
    if (!this.gatewayApi.isEnabled()) {
      this.persistSelfUserLocally(user);
      return of({ ok: true });
    }

    return this.gatewayApi.updateUser(user.id, user).pipe(
      map(savedUser => {
        if (!savedUser) {
          this.persistSelfUserLocally(user);
          return { ok: true as const };
        }

        const mergedSavedUser = this.mergeUsersWithCache([{ ...savedUser, password: user.password }])[0] ?? savedUser;
        this.persistSelfUserLocally(mergedSavedUser);
        return { ok: true as const };
      }),
      catchError(err => {
        const message = String(err?.message ?? 'Error al guardar usuario');
        if (this.isSelfProfileAuthorizationError(user.id, message)) {
          this.persistSelfUserLocally(user);
          return of({ ok: true as const, message: 'Perfil actualizado correctamente.' });
        }

        return of({ ok: false as const, message });
      }),
    );
  }

  deleteUserFromDB$(userId: string): Observable<{ ok: boolean }> {
    if (!this.gatewayApi.isEnabled()) {
      return of({ ok: false });
    }

    return this.gatewayApi.deleteUser(userId).pipe(
      map(() => {
        const remainingUsers = this.getUsers().filter(user => user.id !== userId);
        this.saveUsers(remainingUsers);

        if (this.getSession()?.userId === userId) {
          this.logout();
        }

        return { ok: true as const };
      }),
      catchError(() => of({ ok: false as const })),
    );
  }

  private normalizePersistedUsers(): void {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      authMemoryState.users = authMemoryState.users.map((user, index) => this.normalizeUser(user, index));
      return;
    }

    const users = this.getUsers();
    if (users.length) {
      this.saveUsers(users);
    }
  }

  private persistGatewayLogin(loginResult: GatewayLoginResult, password: string, fallbackIdentifier: string): AppUser | null {
    const payload = this.readJwtPayload(loginResult.token);
    const user = this.upsertGatewayUser(loginResult.user, payload, password, fallbackIdentifier);
    if (!user) {
      return null;
    }

    this.syncSessionFromUser(user, loginResult.token);
    return user;
  }

  private upsertGatewayUser(
    rawGatewayUser: unknown,
    tokenPayload: Record<string, unknown> | null,
    password: string,
    fallbackIdentifier: string,
  ): AppUser | null {
    const rawUser = this.asRecord(rawGatewayUser);
    const users = this.getUsers();

    const fallbackEmail = fallbackIdentifier.includes('@') ? fallbackIdentifier : '';
    const email =
      this.readString(rawUser?.['email']) ||
      this.readString(tokenPayload?.['email']) ||
      fallbackEmail;

    if (!email) {
      return null;
    }

    const existingUser = users.find(user =>
      user.id === this.readString(rawUser?.['id']) || user.email.toLowerCase() === email.toLowerCase(),
    ) ?? null;

    let rawGroupIds: unknown[] = existingUser?.groupIds ?? [];
    if (Array.isArray(rawUser?.['groupIds'])) {
      rawGroupIds = rawUser['groupIds'];
    } else if (Array.isArray(tokenPayload?.['groupIds'])) {
      rawGroupIds = tokenPayload['groupIds'];
    }
    const groupIds = [...new Set(rawGroupIds.map(String).filter(Boolean))];

    const userPermissionsByGroup = this.readPermissionsByGroup(rawUser?.['permissionsByGroup']);
    const tokenPermissionsByGroup = this.readPermissionsByGroup(tokenPayload?.['permissionsByGroup']);
    let permissionsByGroup = existingUser?.permissionsByGroup ?? {};
    if (Object.keys(userPermissionsByGroup).length) {
      permissionsByGroup = userPermissionsByGroup;
    } else if (Object.keys(tokenPermissionsByGroup).length) {
      permissionsByGroup = tokenPermissionsByGroup;
    }

    const normalizedUser = this.normalizeUser({
      id: this.readString(rawUser?.['id']) || existingUser?.id || `api-${email.replaceAll(/[^a-z0-9]+/gi, '-').replaceAll(/^-|-$/g, '')}`,
      name: this.readString(rawUser?.['name']) || existingUser?.name || this.buildDisplayName(email),
      username: this.readString(rawUser?.['username']) || existingUser?.username || email.split('@')[0],
      email,
      phone: this.readString(rawUser?.['phone']) || existingUser?.phone || '',
      birthDate: this.readString(rawUser?.['birthDate']) || existingUser?.birthDate || '2000-01-01',
      address: this.readString(rawUser?.['address']) || existingUser?.address || '',
      isSuperAdmin: rawUser?.['isSuperAdmin'] === true || existingUser?.isSuperAdmin === true,
      groupIds,
      permissionsByGroup,
      password: password || existingUser?.password || '',
    }, users.length);

    const mergedUsers = users.filter(user => user.id !== normalizedUser.id && user.email.toLowerCase() !== normalizedUser.email.toLowerCase());
    mergedUsers.push(normalizedUser);
    this.saveUsers(mergedUsers);
    return normalizedUser;
  }

  private mergeUsersWithCache(usersFromGateway: AppUser[]): AppUser[] {
    const cachedUsers = this.getUsers();
    return usersFromGateway.map((gatewayUser, index) => {
      const cachedUser = cachedUsers.find(user =>
        user.id === gatewayUser.id || user.email.toLowerCase() === gatewayUser.email.toLowerCase(),
      );

      return this.normalizeUser({
        ...cachedUser,
        ...gatewayUser,
        password: gatewayUser.password || cachedUser?.password || '',
      }, index);
    });
  }

  private persistSelfUserLocally(user: AppUser): void {
    const normalizedUser = this.normalizeUser(user, this.getUsers().length);
    const users = this.getUsers().filter(currentUser => currentUser.id !== normalizedUser.id && currentUser.email.toLowerCase() !== normalizedUser.email.toLowerCase());
    users.push(normalizedUser);
    this.saveUsers(users);

    const session = this.getSession();
    if (session?.userId === normalizedUser.id || session?.email.toLowerCase() === normalizedUser.email.toLowerCase()) {
      this.syncSessionFromUser(normalizedUser, session?.token);
    }
  }

  private isSelfProfileAuthorizationError(userId: string, message: string): boolean {
    const session = this.getSession();
    if (session?.userId !== userId) {
      return false;
    }

    const normalized = message.toLowerCase();
    return normalized.includes('no autorizado para modificar usuarios')
      || normalized.includes('no autorizado para editar tu perfil')
      || normalized.includes('403');
  }

  private syncSessionFromUser(user: AppUser, token?: string): void {
    const currentSession = this.getSession();
    const selectedGroupId = currentSession?.selectedGroupId && user.groupIds.includes(currentSession.selectedGroupId)
      ? currentSession.selectedGroupId
      : (user.groupIds[0] ?? null);

    this.persistSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      selectedGroupId,
      permissions: this.resolveSessionPermissions(user, selectedGroupId),
      token: token ?? currentSession?.token,
      hasEnteredGroup: currentSession?.hasEnteredGroup,
    });
  }

  private readSession(): UserSession | null {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      return authMemoryState.session;
    }

    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    let parsed: Partial<UserSession>;
    try {
      parsed = JSON.parse(raw) as Partial<UserSession>;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      selectedGroupId: typeof parsed.selectedGroupId === 'string' && parsed.selectedGroupId.trim().length > 0
        ? parsed.selectedGroupId
        : null,
      permissions: this.normalizePermissions(parsed.permissions),
      token: typeof parsed.token === 'string' ? parsed.token : this.readAuthCookie() || undefined,
      hasEnteredGroup: parsed.hasEnteredGroup === true,
    };
  }

  private persistSession(session: UserSession): void {
    if (AUTH_PERSIST_IN_LOCAL_STORAGE) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      authMemoryState.session = session;
    }

    if (session.token) {
      this.persistAuthCookie(session.token);
    }

    this.sessionSubject.next(session);
  }

  private resolveSessionPermissions(user: AppUser, groupId: string | null): PermissionKey[] {
    if (!groupId) {
      return [];
    }

    return this.normalizePermissions(user.permissionsByGroup[groupId]);
  }

  private normalizeUser(rawUser: unknown, index: number): AppUser {
    const raw = this.asRecord(rawUser) ?? {};
    const id = this.readString(raw['id']) || `u-${index + 1}`;
    const email = this.readString(raw['email']).toLowerCase();
    const username = this.readString(raw['username']) || id;
    const name = this.readString(raw['name']) || username;
    const isSuperAdmin = raw['isSuperAdmin'] === true;

    const baseGroupIds = Array.isArray(raw['groupIds'])
      ? raw['groupIds'].map(String).filter(Boolean)
      : [];
    const permissionsByGroup = this.readPermissionsByGroup(raw['permissionsByGroup']);
    const permissionGroupIds = Object.keys(permissionsByGroup);
    const groupIds = [...new Set([...baseGroupIds, ...permissionGroupIds])];

    if (isSuperAdmin) {
      for (const groupId of groupIds) {
        permissionsByGroup[groupId] = [...ALL_PERMISSIONS];
      }
    }

    return {
      id,
      name,
      username,
      email,
      password: this.readString(raw['password']),
      phone: this.readString(raw['phone']),
      birthDate: this.readString(raw['birthDate']) || '2000-01-01',
      address: this.readString(raw['address']),
      isSuperAdmin,
      groupIds,
      permissionsByGroup,
    };
  }

  private readPermissionsByGroup(rawValue: unknown): Record<string, PermissionKey[]> {
    if (!rawValue || typeof rawValue !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(rawValue as Record<string, unknown>).map(([groupId, permissions]) => [groupId, this.normalizePermissions(permissions)]),
    );
  }

  private normalizePermissions(rawPermissions: unknown): PermissionKey[] {
    if (!Array.isArray(rawPermissions)) {
      return [];
    }

    const permissions = rawPermissions
      .map(item => this.mapPermissionKey(String(item)))
      .filter((permission): permission is PermissionKey => Boolean(permission));
    return [...new Set(permissions)];
  }

  private mapPermissionKey(rawPermission: string): PermissionKey | null {
    const key = rawPermission.trim();
    const aliases: Record<string, PermissionKey> = {
      GROUP_VIEW: 'group:view', GROUP_ADD: 'group:add', GROUP_EDIT: 'group:edit',
      GROUP_DELETE: 'group:delete', GROUP_ADD_MEMBER: 'group:add:member',
      GROUP_REMOVE_MEMBER: 'group:remove:member', GROUP_MANAGE: 'group:manage',
      USER_VIEW: 'user:view', USER_ADD: 'user:add', USER_EDIT: 'user:edit',
      USER_EDIT_PROFILE: 'user:edit:profile', USER_DELETE: 'user:delete',
      USER_ASSIGN: 'user:assign', USER_VIEW_ALL: 'user:view:all',
      USER_EDIT_PERMISSIONS: 'user:edit:permissions', USER_EDITE_PERMISSIONS: 'user:edit:permissions',
      USER_DEACTIVATE: 'user:deactivate', USER_ACTIVATE: 'user:activate', USER_MANAGE: 'user:manage',
      TICKET_READ: 'ticket:view', TICKET_CREATE: 'ticket:add', TICKET_UPDATE: 'ticket:edit',
      TICKET_DELETE: 'ticket:delete', TICKET_CHANGE_STATUS: 'ticket:edit:state',
      TICKET_COMMENT: 'ticket:edit:comment', TICKET_EDIT_PRIORITY: 'ticket:edit:priority',
      TICKET_EDIT_DEADLINE: 'ticket:edit:deadline', TICKET_EDIT_ASSIGN: 'ticket:edit:assign',
      TICKET_MANAGE: 'ticket:manage', GROUPS_VIEW: 'group:view', GROUPS_ADD: 'group:add',
      GROUPS_EDIT: 'group:edit', GROUPS_DELETE: 'group:delete', USERS_VIEW: 'user:view',
      USERS_ADD: 'user:add', USERS_EDIT: 'user:edit', USERS_DELETE: 'user:delete',
      TICKETS_VIEW: 'ticket:view', TICKETS_ADD: 'ticket:add', TICKETS_EDIT: 'ticket:edit',
      TICKETS_DELETE: 'ticket:delete', TICKETS_MOVE: 'ticket:edit:state', TICKETS_MANAGE: 'ticket:manage',
      'groups:view': 'group:view', 'groups:add': 'group:add', 'groups:edit': 'group:edit',
      'groups:delete': 'group:delete', 'groups:manage': 'group:manage',
      'users:view': 'user:view', 'users:add': 'user:add', 'users:edit': 'user:edit',
      'users:delete': 'user:delete', 'users:manage': 'user:manage',
      'tickets:view': 'ticket:view', 'tickets:add': 'ticket:add', 'tickets:edit': 'ticket:edit',
      'tickets:delete': 'ticket:delete', 'tickets:move': 'ticket:edit:state', 'tickets:comment': 'ticket:edit:comment',
      'tickets:assign': 'ticket:edit:assign', 'tickets:manage': 'ticket:manage',
      'group:add:member': 'group:add:member', 'group:remove:member': 'group:remove:member',
      'group:manage': 'group:manage', 'group:view': 'group:view', 'group:add': 'group:add',
      'group:edit': 'group:edit', 'group:delete': 'group:delete',
      'user:view': 'user:view', 'user:add': 'user:add', 'user:edit': 'user:edit',
      'user:edit:profile': 'user:edit:profile', 'user:delete': 'user:delete',
      'user:assign': 'user:assign', 'user:view:all': 'user:view:all',
      'user:edit:permissions': 'user:edit:permissions', 'user:edite:permissions': 'user:edit:permissions',
      'user:deactivate': 'user:deactivate', 'user:activate': 'user:activate', 'user:manage': 'user:manage',
      'ticket:view': 'ticket:view', 'ticket:add': 'ticket:add', 'ticket:edit': 'ticket:edit',
      'ticket:delete': 'ticket:delete', 'ticket:edit:state': 'ticket:edit:state',
      'ticket:edit:comment': 'ticket:edit:comment', 'ticket:edit:priority': 'ticket:edit:priority',
      'ticket:edit:deadline': 'ticket:edit:deadline', 'ticket:edit:assign': 'ticket:edit:assign',
      'ticket:edit:asiggn': 'ticket:edit:assign', 'ticket:manage': 'ticket:manage',
      'ticket:read': 'ticket:view', 'ticket:create': 'ticket:add',
      'ticket:update': 'ticket:edit', 'ticket:change-status': 'ticket:edit:state',
      'ticket:comment': 'ticket:edit:comment',
    };

    const normalized = aliases[key] ?? key;
    return this.isPermissionKey(normalized) ? normalized : null;
  }

  private isPermissionKey(value: string): value is PermissionKey {
    return (ALL_PERMISSIONS as readonly string[]).includes(value);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private buildDisplayName(email: string): string {
    const base = email.split('@')[0] ?? 'usuario';
    return base
      .split(/[._-]+/)
      .filter(Boolean)
      .map(fragment => fragment.charAt(0).toUpperCase() + fragment.slice(1))
      .join(' ');
  }

  private readJwtPayload(token: string): Record<string, unknown> | null {
    if (!token) {
      return null;
    }

    try {
      const normalizedToken = token.replaceAll('-', '+').replaceAll('_', '/');
      const payload = JSON.parse(atob(normalizedToken)) as unknown;
      return this.asRecord(payload);
    } catch {
      return null;
    }
  }

  private persistAuthCookie(token: string): void {
    document.cookie = `${AUTH_TOKEN_COOKIE}=${token}; path=/; SameSite=Lax`;
  }

  private clearAuthCookie(): void {
    document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }

  private readAuthCookie(): string {
    return this.readCookie(AUTH_TOKEN_COOKIE);
  }

  private readCookie(name: string): string {
    return document.cookie
      .split(';')
      .map(fragment => fragment.trim())
      .find(fragment => fragment.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? '';
  }
}
