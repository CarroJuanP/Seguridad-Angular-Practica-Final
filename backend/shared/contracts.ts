import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export type DemoDb = {
  groups: AppGroup[];
  users: AppUser[];
  tickets: Ticket[];
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

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEMO_DB_PATH = path.resolve(CURRENT_DIR, 'demo-db.json');
const DEFAULT_DEMO_PASSWORD = ['$p4$ww0rD', '1234'].join('');

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

export function createTicketCode(tickets: Ticket[]): string {
  return `TK-${String(tickets.length + 1001)}`;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function findUserByIdentifier(users: AppUser[], identifier: string): AppUser | null {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return users.find(user =>
    user.email.toLowerCase() === normalizedIdentifier || user.username.toLowerCase() === normalizedIdentifier,
  ) ?? null;
}

export function ensureDemoDb(): DemoDb {
  if (!fs.existsSync(DEMO_DB_PATH)) {
    fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(seedDb(), null, 2), 'utf8');
  }

  return readDemoDb();
}

export function readDemoDb(): DemoDb {
  if (!fs.existsSync(DEMO_DB_PATH)) {
    return ensureDemoDb();
  }

  const raw = fs.readFileSync(DEMO_DB_PATH, 'utf8');
  const parsed = JSON.parse(raw) as DemoDb;
  return {
    groups: Array.isArray(parsed.groups) ? parsed.groups : [],
    users: Array.isArray(parsed.users) ? parsed.users.map(normalizeUser) : [],
    tickets: Array.isArray(parsed.tickets) ? parsed.tickets.map(ticket => ({
      ...ticket,
      assigneeId: ticket.assigneeId ?? null,
      assigneeName: ticket.assigneeName ?? null,
      comments: Array.isArray(ticket.comments) ? ticket.comments : [],
      history: Array.isArray(ticket.history) ? ticket.history : [],
    })) : [],
  };
}

export function writeDemoDb(db: DemoDb): DemoDb {
  const normalizedDb: DemoDb = {
    groups: db.groups,
    users: db.users.map(normalizeUser),
    tickets: db.tickets,
  };

  fs.writeFileSync(DEMO_DB_PATH, JSON.stringify(normalizedDb, null, 2), 'utf8');
  return normalizedDb;
}

export function updateDemoDb(mutator: (db: DemoDb) => void | DemoDb): DemoDb {
  const current = readDemoDb();
  const clone = structuredClone(current);
  const result = mutator(clone);
  return writeDemoDb(result ?? clone);
}

export function listUsersInGroup(db: DemoDb, groupId: string): AppUser[] {
  return db.users
    .filter(user => user.groupIds.includes(groupId))
    .map(toPublicUser);
}

export function resolveTicketUsers(ticket: Ticket, users: AppUser[]): Ticket {
  const assignee = ticket.assigneeId ? users.find(user => user.id === ticket.assigneeId) ?? null : null;
  const creator = users.find(user => user.id === ticket.createdById) ?? null;

  return {
    ...ticket,
    assigneeName: assignee?.name ?? ticket.assigneeName ?? null,
    createdByName: creator?.name ?? ticket.createdByName,
  };
}

export function listTickets(db: DemoDb, groupId?: string): Ticket[] {
  const scoped = groupId ? db.tickets.filter(ticket => ticket.groupId === groupId) : db.tickets;
  return scoped.map(ticket => resolveTicketUsers(ticket, db.users));
}

export function findTicket(db: DemoDb, ticketId: string): Ticket | null {
  const ticket = db.tickets.find(current => current.id === ticketId) ?? null;
  return ticket ? resolveTicketUsers(ticket, db.users) : null;
}

function seedDb(): DemoDb {
  const groups: AppGroup[] = [
    {
      id: 'grp-erp',
      name: 'ERP Finanzas',
      description: 'Workspace para reportes, facturacion y flujo financiero.',
      llmModel: 'Perfil Financiero',
      llmColor: '#F54927',
    },
    {
      id: 'grp-support',
      name: 'Mesa de Soporte',
      description: 'Workspace operativo para incidencias y soporte.',
      llmModel: 'Perfil Operativo',
      llmColor: '#0d3b66',
    },
    {
      id: 'grp-bi',
      name: 'BI Analitica',
      description: 'Workspace para tableros y analitica.',
      llmModel: 'Perfil Analitico',
      llmColor: '#2a9d8f',
    },
  ];

  const allGroupIds = groups.map(group => group.id);
  const allPermissions = [...ALL_PERMISSIONS];

  const users: AppUser[] = [
    normalizeUser({
      id: 'usr-admin',
      name: 'Admin Marher',
      username: 'admin',
      email: 'admin@marher.com',
      password: DEFAULT_DEMO_PASSWORD,
      phone: '5551234567',
      birthDate: '1990-01-01',
      address: 'Queretaro',
      isSuperAdmin: true,
      groupIds: allGroupIds,
      permissionsByGroup: Object.fromEntries(allGroupIds.map(groupId => [groupId, allPermissions])),
    }),
    normalizeUser({
      id: 'usr-pm',
      name: 'Project Manager',
      username: 'pm',
      email: 'pm@marher.com',
      password: DEFAULT_DEMO_PASSWORD,
      phone: '5551234501',
      birthDate: '1991-02-14',
      address: 'Celaya',
      isSuperAdmin: false,
      groupIds: allGroupIds,
      permissionsByGroup: Object.fromEntries(allGroupIds.map(groupId => [groupId, [
        'user:view', 'user:edit:profile',
        'group:view', 'group:add', 'group:edit', 'group:delete', 'group:manage',
        'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:delete', 'ticket:edit:state', 'ticket:edit:comment', 'ticket:manage',
      ]])),
    }),
    normalizeUser({
      id: 'usr-dev',
      name: 'Developer',
      username: 'dev',
      email: 'dev@marher.com',
      password: DEFAULT_DEMO_PASSWORD,
      phone: '5551234502',
      birthDate: '1995-03-20',
      address: 'Irapuato',
      isSuperAdmin: false,
      groupIds: ['grp-erp', 'grp-bi'],
      permissionsByGroup: {
        'grp-erp': ['user:view', 'user:edit:profile', 'group:view', 'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:edit:state', 'ticket:edit:comment'],
        'grp-bi': ['user:view', 'user:edit:profile', 'group:view', 'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:edit:state', 'ticket:edit:comment'],
      },
    }),
    normalizeUser({
      id: 'usr-support',
      name: 'Support',
      username: 'support',
      email: 'support@marher.com',
      password: DEFAULT_DEMO_PASSWORD,
      phone: '5551234503',
      birthDate: '1994-05-10',
      address: 'Salamanca',
      isSuperAdmin: false,
      groupIds: ['grp-support'],
      permissionsByGroup: {
        'grp-support': ['user:view', 'user:edit:profile', 'group:view', 'ticket:view', 'ticket:add', 'ticket:edit:comment'],
      },
    }),
  ];

  const tickets: Ticket[] = [
    {
      id: 'tk-1',
      groupId: 'grp-erp',
      title: 'Validar login de usuarios remotos',
      description: 'Revisar intermitencias de autenticacion en clientes externos.',
      status: 'Pendiente',
      assigneeId: 'usr-dev',
      assigneeName: 'Developer',
      createdById: 'usr-admin',
      createdByName: 'Admin Marher',
      priority: 'Alta',
      createdAt: '2026-04-01T10:00:00.000Z',
      dueDate: '2026-04-20',
      comments: [
        {
          id: 'c-1',
          authorId: 'usr-admin',
          authorName: 'Admin Marher',
          message: 'Validar logs antes de cambiar configuracion.',
          createdAt: '2026-04-01T10:05:00.000Z',
        },
      ],
      history: [
        {
          id: 'h-1',
          at: '2026-04-01T10:00:00.000Z',
          actorName: 'Admin Marher',
          action: 'Ticket creado',
        },
      ],
    },
    {
      id: 'tk-2',
      groupId: 'grp-support',
      title: 'Revisar soporte operativo',
      description: 'Consolidar incidencias abiertas de la semana.',
      status: 'En progreso',
      assigneeId: 'usr-support',
      assigneeName: 'Support',
      createdById: 'usr-pm',
      createdByName: 'Project Manager',
      priority: 'Media',
      createdAt: '2026-04-03T09:30:00.000Z',
      dueDate: '2026-04-22',
      comments: [],
      history: [
        {
          id: 'h-2',
          at: '2026-04-03T09:30:00.000Z',
          actorName: 'Project Manager',
          action: 'Ticket creado',
        },
      ],
    },
  ];

  return { groups, users, tickets };
}
