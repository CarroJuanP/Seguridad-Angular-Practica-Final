export type PermissionKey =
  | 'group:view'
  | 'group:add'
  | 'group:edit'
  | 'group:delete'
  | 'user:view'
  | 'user:add'
  | 'user:edit'
  | 'user:delete'
  | 'user:permissions'
  | 'ticket:read'
  | 'ticket:create'
  | 'ticket:update'
  | 'ticket:delete'
  | 'ticket:assign'
  | 'ticket:change-status'
  | 'ticket:comment';

export const PERMISSIONS_CATALOG = {
  GROUP_VIEW: 'group:view',
  GROUP_ADD: 'group:add',
  GROUP_EDIT: 'group:edit',
  GROUP_DELETE: 'group:delete',
  USER_VIEW: 'user:view',
  USER_ADD: 'user:add',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_PERMISSIONS: 'user:permissions',
  TICKET_READ: 'ticket:read',
  TICKET_CREATE: 'ticket:create',
  TICKET_UPDATE: 'ticket:update',
  TICKET_DELETE: 'ticket:delete',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_CHANGE_STATUS: 'ticket:change-status',
  TICKET_COMMENT: 'ticket:comment',
} as const satisfies Record<string, PermissionKey>;

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS_CATALOG);

export type TicketStatus = 'Pendiente' | 'En progreso' | 'Revision' | 'Hecho' | 'Bloqueado';

export type TicketPriority =
  | 'Critica'
  | 'Muy alta'
  | 'Alta'
  | 'Media'
  | 'Baja'
  | 'Muy baja'
  | 'Bloqueado';

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  id: string;
  at: string;
  actorName: string;
  action: string;
}

export interface Ticket {
  id: string;
  groupId: string;
  title: string;
  description: string;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string;
  createdByName: string;
  priority: TicketPriority;
  createdAt: string;
  dueDate: string;
  comments: TicketComment[];
  history: TicketHistoryEntry[];
}

export interface AppGroup {
  id: string;
  name: string;
  description: string;
  llmModel: string;
  llmColor: string;
}

export interface AppUser {
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
  permissionsByGroup: Record<string, PermissionKey[]>;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  selectedGroupId: string | null;
  permissions: PermissionKey[];
}

export const MOCK_GROUPS: AppGroup[] = [
  {
    id: 'g-1',
    name: 'Equipo Dev',
    description: 'Desarrollo de plataforma web y tickets de producto.',
    llmModel: 'GPT-4.1',
    llmColor: '#0d3b66',
  },
  {
    id: 'g-2',
    name: 'Soporte',
    description: 'Atencion de incidencias operativas de usuarios finales.',
    llmModel: 'Claude 3.7 Sonnet',
    llmColor: '#1f4e79',
  },
  {
    id: 'g-3',
    name: 'UX',
    description: 'Flujos de experiencia, pruebas y ajustes visuales.',
    llmModel: 'Gemini 2.0 Flash',
    llmColor: '#2a5c8a',
  },
];

export const MOCK_USERS: AppUser[] = [
  {
    id: 'u-1',
    name: 'Super Admin',
    username: 'superAdmin',
    email: 'superadmin@local',
    password: 'Admin@12345',
    phone: '5511111111',
    birthDate: '1990-01-01',
    address: 'Oficina Central',
    isSuperAdmin: true,
    groupIds: ['g-1', 'g-2', 'g-3'],
    permissionsByGroup: {
      'g-1': ALL_PERMISSIONS,
      'g-2': ALL_PERMISSIONS,
      'g-3': ALL_PERMISSIONS,
    },
  },
  {
    id: 'u-2',
    name: 'Usuario Normal',
    username: 'usuarioNormal',
    email: '2023371057@uteq.edu.mx',
    password: 'Admin@12345',
    phone: '5599999999',
    birthDate: '2000-05-10',
    address: 'Direccion de prueba',
    isSuperAdmin: false,
    groupIds: ['g-1', 'g-2'],
    permissionsByGroup: {
      'g-1': [
        PERMISSIONS_CATALOG.GROUP_VIEW,
        PERMISSIONS_CATALOG.TICKET_READ,
        PERMISSIONS_CATALOG.TICKET_CREATE,
        PERMISSIONS_CATALOG.TICKET_CHANGE_STATUS,
        PERMISSIONS_CATALOG.TICKET_COMMENT,
      ],
      'g-2': [
        PERMISSIONS_CATALOG.GROUP_VIEW,
        PERMISSIONS_CATALOG.TICKET_READ,
        PERMISSIONS_CATALOG.TICKET_COMMENT,
      ],
    },
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TK-1001',
    groupId: 'g-1',
    title: 'Error en login con MFA',
    description: 'Algunos usuarios no completan segundo factor en Safari.',
    status: 'Pendiente',
    assigneeId: 'u-2',
    assigneeName: 'Usuario Normal',
    createdById: 'u-1',
    createdByName: 'Super Admin',
    priority: 'Alta',
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    comments: [],
    history: [
      {
        id: 'h-1',
        at: new Date().toISOString(),
        actorName: 'Super Admin',
        action: 'Ticket creado',
      },
    ],
  },
  {
    id: 'TK-1002',
    groupId: 'g-1',
    title: 'Ajustar colores del dashboard',
    description: 'Aplicar paleta azul oscuro y naranja aprobada por negocio.',
    status: 'En progreso',
    assigneeId: 'u-1',
    assigneeName: 'Super Admin',
    createdById: 'u-1',
    createdByName: 'Super Admin',
    priority: 'Media',
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    comments: [],
    history: [
      {
        id: 'h-2',
        at: new Date().toISOString(),
        actorName: 'Super Admin',
        action: 'Ticket creado y asignado',
      },
    ],
  },
];
