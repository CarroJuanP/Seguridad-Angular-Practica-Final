import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  ALL_PERMISSIONS,
  ApiLoginResponseEnvelope,
  ApiLoginResult,
  AppUser,
  MOCK_GROUPS,
  MOCK_USERS,
  PermissionKey,
  UserSession,
} from '../models/permissions.model';
import { SupabaseService, DbUser } from './supabase.service';
import { environment } from '../../environments/environment';

const AUTH_API_BASE_URL = 'https://spatial-delcine-devemma-edfc3f92.koyeb.app';
const SUPABASE_REST_URL = `${environment.supabaseUrl.replace(/\/$/, '')}/rest/v1`;
const SUPABASE_ANON_KEY = environment.supabaseAnonKey;
const USERS_KEY = 'app-users';
const SESSION_KEY = 'app-session';
const DEMO_PASSWORD = ['Admin', '12345'].join('@');
const AUTH_PERSIST_IN_LOCAL_STORAGE = true;

const authMemoryState: {
  users: AppUser[];
  session: UserSession | null;
} = {
  users: [],
  session: null,
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<UserSession | null>(this.readSession());
  readonly session$ = this.sessionSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly sbSvc: SupabaseService,
  ) {
    this.ensureUsersSeeded();
  }

  // ---------------------------------------------------------------------------
  // login: Supabase first → external API → local fallback
  // ---------------------------------------------------------------------------
  login(email: string, password: string): Observable<AppUser | null> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.loginWithSupabase(normalizedEmail, password).pipe(
      switchMap(user => {
        if (user) return of(user);
        return this.http
          .post<ApiLoginResponseEnvelope>(`${AUTH_API_BASE_URL}/login`, {
            email: normalizedEmail,
            password,
          })
          .pipe(
            map(response => {
              const loginResult = this.extractApiLoginResult(response);
              return loginResult?.token
                ? this.persistApiLogin(loginResult, password, normalizedEmail)
                : this.loginLocally(normalizedEmail, password);
            }),
            catchError(() => of(this.loginLocally(normalizedEmail, password))),
          );
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // registerInSupabase: check duplicates → try API → save to Supabase
  // ---------------------------------------------------------------------------
  registerInSupabase(input: {
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

    if (!email || !input.password) {
      return of({ ok: false, message: 'Email y password son obligatorios.' });
    }

    const configIssue = this.getSupabaseConfigIssue();
    if (configIssue) {
      return of({ ok: false, message: configIssue });
    }

    const payload = {
      full_name: (input.name ?? this.buildDisplayName(email)).trim(),
      username,
      email,
      password_hash: input.password,
      phone: input.phone?.trim() || null,
      birth_date: input.birthDate?.trim() || null,
      address: input.address?.trim() || null,
      is_super_admin: false,
      is_active: true,
    };

    // 1. Check for duplicate email/username before inserting
    return this.checkUserConflict$(email, username).pipe(
      switchMap(conflict => {
        if (conflict) return of({ ok: false as const, message: conflict });

        // 2. Fire external API /register (best-effort — don't block on failure)
        this.http
          .post(`${AUTH_API_BASE_URL}/register`, {
            email,
            password: input.password,
            name: payload.full_name,
            username,
          })
          .pipe(catchError(() => of(null)))
          .subscribe();

        // 3. Save to Supabase (required for loginWithSupabase to work)
        return this.http
          .post<Record<string, unknown>[]>(`${SUPABASE_REST_URL}/users`, payload, {
            headers: this.getSupabaseHeaders({ preferRepresentation: true }),
          })
          .pipe(
            map(() => ({ ok: true as const })),
            catchError(error => {
              if (error?.status === 0) {
                return of({ ok: false as const, message: 'No se pudo conectar a Supabase. Verifica URL/API key o que tu proyecto este activo.' });
              }
              const msg =
                this.readString(error?.error?.message) ||
                this.readString(error?.message) ||
                '';
              if (msg.toLowerCase().includes('duplicate') || msg.includes('_email_key') || msg.includes('_username_key')) {
                return of({ ok: false as const, message: 'El email o nombre de usuario ya esta registrado.' });
              }
              return of({ ok: false as const, message: msg || 'No se pudo guardar el usuario en Supabase.' });
            }),
          );
      }),
    );
  }

  logout(): void {
    if (AUTH_PERSIST_IN_LOCAL_STORAGE) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      authMemoryState.session = null;
    }
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
    if (!current) return;
    this.persistSession({ ...current, ...partial });
  }

  getCurrentUser(): AppUser | null {
    const session = this.getSession();
    if (!session) return null;
    return this.getUsers().find(user => user.id === session.userId) ?? null;
  }

  getUsers(): AppUser[] {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      return authMemoryState.users.map((user, index) => this.normalizeUser(user, index));
    }
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((user, index) => this.normalizeUser(user, index));
  }

  saveUsers(users: AppUser[]): void {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      authMemoryState.users = users.map((user, index) => this.normalizeUser(user, index));
      return;
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  registerLocalUser(input: {
    email: string;
    password: string;
    name?: string;
    username?: string;
    phone?: string;
    birthDate?: string;
    address?: string;
  }): { ok: true; user: AppUser } | { ok: false; message: string } {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password) {
      return { ok: false, message: 'Email y password son obligatorios.' };
    }
    const users = this.getUsers();
    if (users.some(user => user.email.toLowerCase() === email)) {
      return { ok: false, message: 'Ese email ya existe.' };
    }
    const groupId = MOCK_GROUPS.find(group => group.id === 'g-support')?.id ?? MOCK_GROUPS[0]?.id;
    if (!groupId) {
      return { ok: false, message: 'No hay grupos configurados para asignar permisos.' };
    }
    const normalizedUsername =
      (input.username ?? email.split('@')[0])
        .toLowerCase()
        .replaceAll(/[^a-z0-9._-]+/g, '-')
        .replaceAll(/^-|-$/g, '') ||
      `user-${Date.now()}`;
    const user: AppUser = {
      id: `local-${Date.now()}`,
      name: (input.name ?? this.buildDisplayName(email)).trim(),
      username: normalizedUsername,
      email,
      password: input.password,
      phone: input.phone?.trim() ?? '',
      birthDate: input.birthDate?.trim() || '2000-01-01',
      address: input.address?.trim() ?? '',
      isSuperAdmin: false,
      groupIds: [groupId],
      permissionsByGroup: {
        [groupId]: ['user:view', 'user:edit:profile', 'group:view', 'ticket:view', 'ticket:add'],
      },
    };
    users.push(user);
    this.saveUsers(users);
    return { ok: true, user };
  }

  // ---------------------------------------------------------------------------
  // Public helper: maps a DbUser row to AppUser (called by Permissions service)
  // ---------------------------------------------------------------------------
  dbUserToAppUser(
    row: DbUser,
    groupIds: string[],
    permissionsByGroup: Record<string, PermissionKey[]>,
  ): AppUser {
    return {
      id: row.id,
      name: row.full_name ?? '',
      username: row.username ?? '',
      email: (row.email ?? '').toLowerCase(),
      password: row.password_hash ?? '',
      phone: row.phone ?? '',
      birthDate: row.birth_date ?? '2000-01-01',
      address: row.address ?? '',
      isSuperAdmin: row.is_super_admin ?? false,
      groupIds,
      permissionsByGroup,
    };
  }

  // ---------------------------------------------------------------------------
  // getUsers$: load all users from Supabase with their group memberships + permissions
  // ---------------------------------------------------------------------------
  getUsers$(): Observable<AppUser[]> {
    return forkJoin([
      this.sbSvc.getUsers(),
      this.http.get<Array<{ group_id: string; user_id: string }>>(
        `${SUPABASE_REST_URL}/group_members`,
        { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'group_id,user_id') },
      ).pipe(catchError(() => of([]))),
      this.http.get<Array<{ group_id: string; user_id: string; permission_id: string }>>(
        `${SUPABASE_REST_URL}/user_group_permissions`,
        { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'group_id,user_id,permission_id') },
      ).pipe(catchError(() => of([]))),
      this.http.get<Array<{ id: string; key: string }>>(
        `${SUPABASE_REST_URL}/permissions`,
        { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'id,key') },
      ).pipe(catchError(() => of([]))),
    ]).pipe(
      map(([users, members, ugp, permCatalog]) => {
        const permById = new Map(permCatalog.map(p => [p.id, p.key as PermissionKey]));
        return users.map(u => {
          const groupIds = members.filter(m => m.user_id === u.id).map(m => m.group_id);
          const permissionsByGroup: Record<string, PermissionKey[]> = {};
          for (const m of members.filter(row => row.user_id === u.id)) {
            const keys = ugp
              .filter(p => p.user_id === u.id && p.group_id === m.group_id)
              .map(p => permById.get(p.permission_id))
              .filter((k): k is PermissionKey => Boolean(k));
            permissionsByGroup[m.group_id] = keys;
          }
          return this.dbUserToAppUser(u, groupIds, permissionsByGroup);
        });
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // upsertUserInDB$: check duplicates → create/update + sync memberships/permissions
  // ---------------------------------------------------------------------------
  upsertUserInDB$(user: AppUser, isNew: boolean): Observable<{ ok: boolean; message?: string }> {
    const payload: Partial<DbUser> = {
      full_name: user.name,
      username: user.username,
      email: user.email,
      password_hash: user.password || 'Temporal@1234',
      phone: user.phone || '',
      birth_date: user.birthDate || '2000-01-01',
      address: user.address || '',
      is_super_admin: user.isSuperAdmin,
      is_active: true,
    };

    const save$ = isNew
      ? this.sbSvc.createUser(payload)
      : this.sbSvc.updateUser(user.id, payload);

    const excludeId = isNew ? undefined : user.id;
    return this.checkUserConflict$(user.email, user.username, excludeId).pipe(
      switchMap(conflict => {
        if (conflict) return of({ ok: false as const, message: conflict });
        return this.saveAndSyncMemberships$(save$, user);
      }),
      catchError(err => of({ ok: false as const, message: String(err?.message ?? 'Error al guardar usuario') })),
    );
  }

  // ---------------------------------------------------------------------------
  // deleteUserFromDB$: soft-delete a user row
  // ---------------------------------------------------------------------------
  deleteUserFromDB$(userId: string): Observable<{ ok: boolean }> {
    return this.sbSvc.softDeleteUser(userId).pipe(
      map(() => ({ ok: true as const })),
      catchError(() => of({ ok: false as const })),
    );
  }

  // ---------------------------------------------------------------------------
  // Private: sequential save → add/remove memberships → replace permissions
  // ---------------------------------------------------------------------------
  private saveAndSyncMemberships$(
    save$: Observable<DbUser[]>,
    user: AppUser,
  ): Observable<{ ok: boolean; message?: string }> {
    return save$.pipe(
      switchMap(rows => {
        const savedId = (rows[0]?.id ?? user.id) as string;
        return forkJoin([
          this.sbSvc.getGroupsForUser(savedId).pipe(catchError(() => of([]))),
          this.sbSvc.getPermissions(),
        ]).pipe(
          switchMap(([currentMemberships, catalog]) => {
            const currentGroupIds = currentMemberships.map(m => m.group_id);
            const targetGroupIds = [...new Set(user.groupIds)];
            const groupIdsToAdd = targetGroupIds.filter(id => !currentGroupIds.includes(id));
            const groupIdsToRemove = currentGroupIds.filter(id => !targetGroupIds.includes(id));
            const permCatalog = new Map(catalog.map(p => [p.key, p.id]));

            const memberOps$ = [
              ...groupIdsToAdd.map(gid => this.sbSvc.addGroupMember(gid, savedId).pipe(catchError(() => of(null)))),
              ...groupIdsToRemove.map(gid => this.sbSvc.removeGroupMember(gid, savedId).pipe(catchError(() => of(null)))),
            ];
            const applyMembers$ = memberOps$.length ? forkJoin(memberOps$) : of([null]);

            return applyMembers$.pipe(
              switchMap(() => {
                const permOps$ = [
                  ...groupIdsToRemove.map(gid =>
                    this.sbSvc.setUserGroupPermissions(gid, savedId, [], null).pipe(catchError(() => of(null))),
                  ),
                  ...targetGroupIds.map(gid => {
                    const ids = (user.permissionsByGroup[gid] ?? [])
                      .map(key => permCatalog.get(key))
                      .filter((id): id is string => Boolean(id));
                    return this.sbSvc.setUserGroupPermissions(gid, savedId, ids, null).pipe(catchError(() => of(null)));
                  }),
                ];
                return permOps$.length ? forkJoin(permOps$) : of([null]);
              }),
            );
          }),
          map(() => ({ ok: true as const })),
        );
      }),
      catchError(err => of({ ok: false as const, message: String(err?.message ?? 'Error al guardar usuario') })),
    );
  }

  // ---------------------------------------------------------------------------
  // loginWithSupabase: loads full user data (groups + permissions) from DB
  // ---------------------------------------------------------------------------
  private loginWithSupabase(email: string, password: string): Observable<AppUser | null> {
    if (this.getSupabaseConfigIssue()) return of(null);

    const loginParams = new HttpParams()
      .set('select', '*')
      .set('email', `eq.${email}`)
      .set('password_hash', `eq.${password}`)
      .set('is_active', 'eq.true')
      .set('limit', '1');

    return this.http
      .get<DbUser[]>(`${SUPABASE_REST_URL}/users`, {
        headers: this.getSupabaseHeaders(),
        params: loginParams,
      })
      .pipe(
        switchMap(rows => {
          if (!Array.isArray(rows) || !rows.length) return of(null);
          const row = rows[0];
          const userId = row.id;

          return forkJoin([
            this.http.get<Array<{ group_id: string; user_id: string }>>(
              `${SUPABASE_REST_URL}/group_members`,
              { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'group_id,user_id').set('user_id', `eq.${userId}`) },
            ).pipe(catchError(() => of([]))),
            this.http.get<Array<{ group_id: string; user_id: string; permission_id: string }>>(
              `${SUPABASE_REST_URL}/user_group_permissions`,
              { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'group_id,user_id,permission_id').set('user_id', `eq.${userId}`) },
            ).pipe(catchError(() => of([]))),
            this.http.get<Array<{ id: string; key: string }>>(
              `${SUPABASE_REST_URL}/permissions`,
              { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'id,key') },
            ).pipe(catchError(() => of([]))),
          ]).pipe(
            map(([members, ugp, permCatalog]) => {
              const permById = new Map(permCatalog.map(p => [p.id, p.key as PermissionKey]));
              const groupIds = members.map(m => m.group_id);
              const permissionsByGroup: Record<string, PermissionKey[]> = {};
              for (const m of members) {
                const keys = ugp
                  .filter(p => p.group_id === m.group_id)
                  .map(p => permById.get(p.permission_id))
                  .filter((k): k is PermissionKey => Boolean(k));
                permissionsByGroup[m.group_id] = keys.length
                  ? keys
                  : row.is_super_admin
                  ? [...ALL_PERMISSIONS]
                  : [];
              }

              const finalGroupIds = groupIds.length ? groupIds : this.getLocalGroupIds(row);
              if (!groupIds.length) {
                const defaultPerms: PermissionKey[] = row.is_super_admin
                  ? [...ALL_PERMISSIONS]
                  : [];
                for (const gid of finalGroupIds) {
                  permissionsByGroup[gid] = defaultPerms;
                }
              }

              const user = this.dbUserToAppUser(row, finalGroupIds, permissionsByGroup);

              const users = this.getUsers();
              const idx = users.findIndex(u => u.email.toLowerCase() === user.email);
              if (idx >= 0) { users[idx] = user; } else { users.push(user); }
              this.saveUsers(users);

              const selectedGroupId = user.groupIds[0] ?? null;
              this.persistSession({
                userId: user.id,
                name: user.name,
                email: user.email,
                selectedGroupId,
                permissions: user.permissionsByGroup[selectedGroupId ?? ''] ?? [],
              });
              return user;
            }),
          );
        }),
        catchError(() => of(null)),
      );
  }

  private getLocalGroupIds(row: DbUser): string[] {
    const local = this.getUsers().find(u => u.email.toLowerCase() === row.email?.toLowerCase());
    if (local?.groupIds?.length) return local.groupIds;
    return row.is_super_admin ? MOCK_GROUPS.map(g => g.id) : [MOCK_GROUPS[1].id];
  }

  // ---------------------------------------------------------------------------
  // Duplicate check: returns error message if email/username taken by another user
  // ---------------------------------------------------------------------------
  private checkUserConflict$(email: string, username: string, excludeId?: string): Observable<string | null> {
    if (this.getSupabaseConfigIssue()) return of(null);
    return forkJoin([
      this.http.get<Array<{ id: string }>>(
        `${SUPABASE_REST_URL}/users`,
        { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'id').set('email', `eq.${email}`).set('limit', '1') },
      ).pipe(catchError(() => of([]))),
      this.http.get<Array<{ id: string }>>(
        `${SUPABASE_REST_URL}/users`,
        { headers: this.getSupabaseHeaders(), params: new HttpParams().set('select', 'id').set('username', `eq.${username}`).set('limit', '1') },
      ).pipe(catchError(() => of([]))),
    ]).pipe(
      map(([emailRows, usernameRows]) => {
        if (emailRows.some(r => r.id !== excludeId)) return 'El email ya esta registrado por otro usuario.';
        if (usernameRows.some(r => r.id !== excludeId)) return 'El nombre de usuario ya esta en uso.';
        return null;
      }),
    );
  }

  private getSupabaseHeaders(options?: { preferRepresentation?: boolean }): HttpHeaders {
    let headers = new HttpHeaders({
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    });
    if (options?.preferRepresentation) {
      headers = headers.set('Prefer', 'return=representation');
    }
    return headers;
  }

  private getSupabaseConfigIssue(): string | null {
    const hasUrl = Boolean(environment.supabaseUrl) && /https?:\/\//.test(environment.supabaseUrl);
    if (!hasUrl || environment.supabaseUrl.includes('TU-PROYECTO')) {
      return 'Supabase URL invalida. Actualiza src/environments/environment.ts con tu Project URL real.';
    }
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('TU_SUPABASE_ANON_KEY')) {
      return 'Supabase key no configurada. Pega tu anon key de Project Settings > API.';
    }
    if (SUPABASE_ANON_KEY.startsWith('esb_publishable_')) {
      return 'Estas usando una publishable key. Para REST /rest/v1 necesitas la anon key (JWT) de Supabase.';
    }
    return null;
  }

  private persistApiLogin(loginResult: ApiLoginResult, password: string, fallbackEmail: string): AppUser | null {
    const payload = this.readJwtPayload(loginResult.token);
    const email =
      this.readString(payload?.['email']) ||
      this.readString(loginResult.email) ||
      this.readString(payload?.['sub']) ||
      fallbackEmail;
    const permissions = this.normalizePermissions(payload?.['permissions'] ?? loginResult.permissions);
    const user = this.upsertApiUser(email, password, permissions);
    if (!user) return null;

    if (this.readString(loginResult.name)) {
      user.name = this.readString(loginResult.name);
    }
    if (this.readString(loginResult.username)) {
      user.username = this.readString(loginResult.username);
    }

    const users = this.getUsers();
    const idx = users.findIndex(item => item.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
      this.saveUsers(users);
    }

    const selectedGroupId = user.groupIds[0] ?? null;
    this.persistSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      selectedGroupId,
      permissions: this.resolveSessionPermissions(user, selectedGroupId),
      token: loginResult.token,
    });
    return user;
  }

  private upsertApiUser(email: string, password: string, permissions: PermissionKey[]): AppUser | null {
    if (!email) return null;
    const users = this.getUsers();
    const index = users.findIndex(user => user.email.toLowerCase() === email.toLowerCase());
    const existingUser = index >= 0 ? users[index] : null;
    const groupIds = existingUser?.groupIds.length ? existingUser.groupIds : MOCK_GROUPS.map(group => group.id);
    const effectivePermissions: PermissionKey[] = permissions.length ? permissions : [];
    const permissionsByGroup = Object.fromEntries(
      groupIds.map(groupId => [groupId, [...effectivePermissions]]),
    ) as Record<string, PermissionKey[]>;

    const user: AppUser = {
      id: existingUser?.id ?? `api-${email.replaceAll(/[^a-z0-9]+/gi, '-').replaceAll(/^-|-$/g, '')}`,
      name: existingUser?.name || this.buildDisplayName(email),
      username: existingUser?.username || email.split('@')[0],
      email,
      password,
      phone: existingUser?.phone || '',
      birthDate: existingUser?.birthDate || '2000-01-01',
      address: existingUser?.address || '',
      isSuperAdmin: this.isApiSuperAdmin(email, effectivePermissions),
      groupIds,
      permissionsByGroup,
    };

    if (index >= 0) { users[index] = user; } else { users.push(user); }
    this.saveUsers(users);
    return this.getUsers().find(u => u.id === user.id) ?? user;
  }

  private ensureUsersSeeded(): void {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) {
      this.saveUsers(MOCK_USERS);
      return;
    }
    if (!localStorage.getItem(USERS_KEY)) {
      this.saveUsers(MOCK_USERS);
      return;
    }
    this.saveUsers(this.getUsers());
  }

  private readSession(): UserSession | null {
    if (!AUTH_PERSIST_IN_LOCAL_STORAGE) return authMemoryState.session;
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      selectedGroupId:
        typeof parsed.selectedGroupId === 'string' && parsed.selectedGroupId.trim().length > 0
          ? parsed.selectedGroupId
          : null,
      permissions: this.normalizePermissions(parsed.permissions),
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
    };
  }

  private persistSession(session: UserSession): void {
    if (AUTH_PERSIST_IN_LOCAL_STORAGE) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      authMemoryState.session = session;
    }
    this.sessionSubject.next(session);
  }

  private resolveSessionPermissions(user: AppUser, groupId: string | null): PermissionKey[] {
    if (!groupId) return [];
    return this.normalizePermissions(user.permissionsByGroup[groupId]);
  }

  private loginLocally(email: string, password: string): AppUser | null {
    const user = this.getUsers().find(
      item => item.email.toLowerCase() === email && item.password === password,
    );
    if (!user) return null;
    const selectedGroupId = user.groupIds.length ? user.groupIds[0] : null;
    this.persistSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      selectedGroupId,
      permissions: this.resolveSessionPermissions(user, selectedGroupId),
    });
    return user;
  }

  private normalizeUser(rawUser: unknown, index: number): AppUser {
    const raw = (rawUser ?? {}) as Record<string, unknown>;
    const id = this.readString(raw['id']) || `u-migrated-${index + 1}`;
    const email = (this.readString(raw['email']) || '').toLowerCase();
    const username = this.readString(raw['username']) || this.readString(raw['usuario']) || id;
    const name = this.readString(raw['name']) || this.readString(raw['nombreCompleto']) || username;

    const isSuperAdmin =
      raw['isSuperAdmin'] === true ||
      username.toLowerCase() === 'superadmin' ||
      email === 'superadmin@local';

    const baseGroupIds = Array.isArray(raw['groupIds'])
      ? raw['groupIds'].map(String).filter(Boolean)
      : [];
    const rawPermissionsByGroup = this.readPermissionsByGroup(raw['permissionsByGroup']);
    const permissionGroupIds = Object.keys(rawPermissionsByGroup);
    const groupIds = [...new Set([...baseGroupIds, ...permissionGroupIds])];
    if (!groupIds.length) {
      groupIds.push(isSuperAdmin ? MOCK_GROUPS[0].id : 'g-support');
    }

    const permissionsByGroup: Record<string, PermissionKey[]> = {};
    if (isSuperAdmin) {
      for (const groupId of groupIds) {
        permissionsByGroup[groupId] = [...ALL_PERMISSIONS];
      }
    } else if (permissionGroupIds.length) {
      for (const groupId of groupIds) {
        permissionsByGroup[groupId] = this.normalizePermissions(rawPermissionsByGroup[groupId]);
      }
    } else {
      const globalPermissions = this.normalizePermissions(raw['permissions']);
      const fallbackPermissions: PermissionKey[] = globalPermissions.length
        ? globalPermissions
        : [];
      for (const groupId of groupIds) {
        permissionsByGroup[groupId] = [...fallbackPermissions];
      }
    }

    return {
      id,
      name,
      username,
      email,
      password: this.readString(raw['password']) || DEMO_PASSWORD,
      phone: this.readString(raw['phone']) || this.readString(raw['telefono']) || '',
      birthDate: this.readString(raw['birthDate']) || this.readString(raw['fechaNacimiento']) || '2000-01-01',
      address: this.readString(raw['address']) || this.readString(raw['direccion']) || '',
      isSuperAdmin,
      groupIds,
      permissionsByGroup,
    };
  }

  private readPermissionsByGroup(rawValue: unknown): Record<string, PermissionKey[]> {
    if (!rawValue || typeof rawValue !== 'object') return {};
    const mapped: Record<string, PermissionKey[]> = {};
    for (const [groupId, permissions] of Object.entries(rawValue as Record<string, unknown>)) {
      mapped[groupId] = this.normalizePermissions(permissions);
    }
    return mapped;
  }

  private normalizePermissions(rawPermissions: unknown): PermissionKey[] {
    if (!Array.isArray(rawPermissions)) return [];
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
      TICKETS_DELETE: 'ticket:delete',
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

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private extractApiLoginResult(response: ApiLoginResponseEnvelope | null | undefined): ApiLoginResult | null {
    if (!response || typeof response !== 'object') return null;
    const data = response.data;
    if (Array.isArray(data)) return data.find(item => typeof item?.token === 'string') ?? null;
    if (data && typeof data === 'object' && typeof data.token === 'string') return data;
    return null;
  }

  private readJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
      return JSON.parse(atob(normalized)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private buildDisplayName(email: string): string {
    return email
      .split('@')[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private isApiSuperAdmin(email: string, permissions: PermissionKey[]): boolean {
    return (
      email === 'admin@marher.com' ||
      (['group:manage', 'user:manage', 'ticket:manage'] as PermissionKey[]).every(p =>
        permissions.includes(p),
      )
    );
  }
}
