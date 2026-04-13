import { createHash } from 'node:crypto';

export type ApiEnvelope<T> = {
  statusCode: number;
  intOpCode: string;
  data: T | null;
  message?: string;
};

export type AppGroup = {
  id: string;
  name: string;
  description: string;
  llmModel: string;
  llmColor: string;
};

export type AppUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  birthDate: string;
  address: string;
  isSuperAdmin: boolean;
  groupIds: string[];
  permissionsByGroup: Record<string, string[]>;
};

export type TicketComment = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
};

export type TicketHistoryEntry = {
  id: string;
  at: string;
  actorName: string;
  action: string;
};

export type Ticket = {
  id: string;
  groupId: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByName: string;
  priority: string;
  createdAt: string;
  dueDate: string;
  comments: TicketComment[];
  history: TicketHistoryEntry[];
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  groupIds: string[];
  permissionsByGroup: Record<string, string[]>;
  isSuperAdmin: boolean;
  iat: number;
};

export const TICKET_STATUSES = ['Pendiente', 'En progreso', 'Revision', 'Hecho', 'Bloqueado'] as const;
export const TICKET_PRIORITIES = ['Critica', 'Muy alta', 'Alta', 'Media', 'Baja', 'Muy baja', 'Bloqueado'] as const;
export const ALL_PERMISSIONS = [
  'group:view', 'group:add', 'group:edit', 'group:delete', 'group:add:member', 'group:remove:member', 'group:manage',
  'user:view', 'user:add', 'user:edit', 'user:edit:profile', 'user:delete', 'user:assign', 'user:view:all',
  'user:edit:permissions', 'user:deactivate', 'user:activate', 'user:manage',
  'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:delete', 'ticket:edit:state', 'ticket:edit:comment',
  'ticket:edit:priority', 'ticket:edit:deadline', 'ticket:edit:assign', 'ticket:manage',
] as const;

const PASSWORD_HASH_PREFIX = 'sha256:';

export function buildEnvelope<T>(statusCode: number, intOpCode: string, data: T | null, message?: string): ApiEnvelope<T> {
  return { statusCode, intOpCode, data, message };
}

export function normalizePermission(permission: string): string {
  const aliases: Record<string, string> = {
    'groups:view': 'group:view',
    'groups:add': 'group:add',
    'groups:edit': 'group:edit',
    'groups:delete': 'group:delete',
    'groups:manage': 'group:manage',
    'users:view': 'user:view',
    'users:add': 'user:add',
    'users:edit': 'user:edit',
    'users:delete': 'user:delete',
    'users:manage': 'user:manage',
    'tickets:view': 'ticket:view',
    'tickets:add': 'ticket:add',
    'tickets:edit': 'ticket:edit',
    'tickets:delete': 'ticket:delete',
    'tickets:move': 'ticket:edit:state',
    'tickets:comment': 'ticket:edit:comment',
    'tickets:assign': 'ticket:edit:assign',
    'tickets:manage': 'ticket:manage',
  };

  return aliases[permission.trim()] ?? permission.trim();
}

export function uniquePermissions(permissions: string[]): string[] {
  return [...new Set(permissions.map(normalizePermission).filter(Boolean))];
}

export function getGroupPermissions(user: AppUser, groupId: string | null): string[] {
  if (!groupId) {
    return uniquePermissions(Object.values(user.permissionsByGroup).flat());
  }

  return uniquePermissions(user.permissionsByGroup[groupId] ?? []);
}

export function hasPermission(user: AppUser, permission: string, groupId: string | null = null): boolean {
  return user.isSuperAdmin || getGroupPermissions(user, groupId).includes(normalizePermission(permission));
}

export function hasAnyPermission(user: AppUser, permissions: string[], groupId: string | null = null): boolean {
  return permissions.some(permission => hasPermission(user, permission, groupId));
}

export function buildToken(user: AppUser): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    groupIds: [...user.groupIds],
    permissionsByGroup: { ...user.permissionsByGroup },
    isSuperAdmin: user.isSuperAdmin,
    iat: Date.now(),
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function readTokenPayload(token: string): AuthTokenPayload | null {
  if (!token) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as AuthTokenPayload;
  } catch {
    try {
      return JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as AuthTokenPayload;
    } catch {
      return null;
    }
  }
}

export function readBearerToken(headerValue?: string | string[]): string {
  const rawHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue ?? '';
  return rawHeader.toLowerCase().startsWith('bearer ')
    ? rawHeader.slice(7).trim()
    : '';
}

export function hashPassword(password: string): string {
  return `${PASSWORD_HASH_PREFIX}${createHash('sha256').update(password, 'utf8').digest('hex')}`;
}

export function verifyPassword(storedPassword: string, candidatePassword: string): boolean {
  if (!storedPassword || !candidatePassword) {
    return false;
  }

  return storedPassword.startsWith(PASSWORD_HASH_PREFIX)
    ? hashPassword(candidatePassword) === storedPassword
    : storedPassword === candidatePassword;
}

export function toPublicUser(user: AppUser): AppUser {
  return { ...normalizeUser(user), password: '' };
}

export function normalizeUser(user: AppUser): AppUser {
  const permissionGroupIds = Object.keys(user.permissionsByGroup ?? {});
  const groupIds = [...new Set([...(user.groupIds ?? []), ...permissionGroupIds])];
  const permissionsByGroup = Object.fromEntries(
    groupIds.map(groupId => [groupId, uniquePermissions(user.permissionsByGroup[groupId] ?? [])]),
  );

  return {
    id: user.id,
    name: user.name.trim(),
    username: user.username.trim(),
    email: user.email.trim().toLowerCase(),
    password: user.password ?? '',
    phone: user.phone ?? '',
    birthDate: user.birthDate || '2000-01-01',
    address: user.address ?? '',
    isSuperAdmin: user.isSuperAdmin === true,
    groupIds,
    permissionsByGroup,
  };
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
