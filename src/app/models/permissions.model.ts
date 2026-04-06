export type PermissionKey =
  | 'group:view'
  | 'group:add'
  | 'group:edit'
  | 'group:delete'
  | 'group:add:member'
  | 'group:remove:member'
  | 'group:manage'
  | 'user:view'
  | 'user:add'
  | 'user:edit'
  | 'user:edit:profile'
  | 'user:delete'
  | 'user:assign'
  | 'user:view:all'
  | 'user:edit:permissions'
  | 'user:deactivate'
  | 'user:activate'
  | 'user:manage'
  | 'ticket:view'
  | 'ticket:add'
  | 'ticket:edit'
  | 'ticket:delete'
  | 'ticket:edit:state'
  | 'ticket:edit:comment'
  | 'ticket:edit:priority'
  | 'ticket:edit:deadline'
  | 'ticket:edit:assign'
  | 'ticket:manage';

export const ALL_PERMISSIONS: PermissionKey[] = [
  'group:view',
  'group:add',
  'group:edit',
  'group:delete',
  'group:add:member',
  'group:remove:member',
  'group:manage',
  'user:view',
  'user:add',
  'user:edit',
  'user:edit:profile',
  'user:delete',
  'user:assign',
  'user:view:all',
  'user:edit:permissions',
  'user:deactivate',
  'user:activate',
  'user:manage',
  'ticket:view',
  'ticket:add',
  'ticket:edit',
  'ticket:delete',
  'ticket:edit:state',
  'ticket:edit:comment',
  'ticket:edit:priority',
  'ticket:edit:deadline',
  'ticket:edit:assign',
  'ticket:manage',
];
const DEMO_PASSWORD = ['Admin', '12345'].join('@');
const MARHER_DEMO_PASSWORD = ['$p4$ww0rD', '1234'].join('');

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

export type TicketStatus = 'Pendiente' | 'En progreso' | 'Revision' | 'Hecho' | 'Bloqueado';
export type TicketPriority = 'Critica' | 'Muy alta' | 'Alta' | 'Media' | 'Baja' | 'Muy baja' | 'Bloqueado';

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

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  selectedGroupId: string | null;
  permissions: PermissionKey[];
  token?: string;
  hasEnteredGroup?: boolean;
}

export interface ApiLoginResult {
  token: string;
  email?: string;
  name?: string;
  username?: string;
  permissions?: PermissionKey[];
  message?: string;
}

export interface ApiLoginResponseEnvelope {
  statusCode?: number;
  intOpCode?: number;
  data?: ApiLoginResult[] | ApiLoginResult | null;
}

export interface ApiResponseEnvelope<T = unknown> {
  statusCode?: number;
  intOpCode?: number;
  data?: T | T[] | null;
  message?: string;
}

export interface ApiRegisterRequest {
  email: string;
  password: string;
  name?: string;
  username?: string;
  phone?: string;
  birthDate?: string;
  address?: string;
}

export interface ApiAddUserRequest extends ApiRegisterRequest {
  permissions?: PermissionKey[];
  isSuperAdmin?: boolean;
}

export interface ApiUserResult {
  id?: string;
  email: string;
  name?: string;
  username?: string;
  permissions?: PermissionKey[];
  token?: string;
  message?: string;
}

// Fixed UUIDs — must match the seed SQL in supabase/migrations/20260329010000_seed_demo_data.sql
export const GROUP_IDS = {
  ERP_FINANCE: 'a1b2c3d4-e5f6-0000-0000-000000000001',
  SUPPORT:     'a1b2c3d4-e5f6-0000-0000-000000000002',
  BI:          'a1b2c3d4-e5f6-0000-0000-000000000003',
} as const;

export const USER_IDS = {
  SUPERADMIN: 'b2c3d4e5-f6a1-0000-0000-000000000001',
  CARRILLO:   'b2c3d4e5-f6a1-0000-0000-000000000002',
  ADMIN:      'b2c3d4e5-f6a1-0000-0000-000000000003',
  PM:         'b2c3d4e5-f6a1-0000-0000-000000000004',
  DEV:        'b2c3d4e5-f6a1-0000-0000-000000000005',
  SUPPORT:    'b2c3d4e5-f6a1-0000-0000-000000000006',
} as const;

export const MOCK_GROUPS: AppGroup[] = [
  {
    id: GROUP_IDS.ERP_FINANCE,
    name: 'ERP Finanzas',
    description: 'Flujos financieros, facturacion y reportes contables.',
    llmModel: 'Perfil Financiero',
    llmColor: '#0d3b66',
  },
  {
    id: GROUP_IDS.SUPPORT,
    name: 'Mesa de Soporte',
    description: 'Seguimiento de incidencias operativas y SLA.',
    llmModel: 'Perfil Operativo',
    llmColor: '#6d597a',
  },
  {
    id: GROUP_IDS.BI,
    name: 'BI Analitica',
    description: 'Analitica, dashboards ejecutivos y calidad de datos.',
    llmModel: 'Perfil Analitico',
    llmColor: '#2a9d8f',
  },
];

export const MOCK_USERS: AppUser[] = [
  {
    id: USER_IDS.SUPERADMIN,
    name: 'Super Admin',
    username: 'superadmin',
    email: 'superadmin@local',
    password: DEMO_PASSWORD,
    phone: '5551000001',
    birthDate: '1990-01-01',
    address: 'Centro de operaciones',
    isSuperAdmin: true,
    groupIds: MOCK_GROUPS.map(g => g.id),
    permissionsByGroup: {
      [GROUP_IDS.ERP_FINANCE]: [...ALL_PERMISSIONS],
      [GROUP_IDS.SUPPORT]: [...ALL_PERMISSIONS],
      [GROUP_IDS.BI]: [...ALL_PERMISSIONS],
    },
  },
  {
    id: USER_IDS.CARRILLO,
    name: 'Juan Pablo Carrillo Rodriguez',
    username: 'carrillo',
    email: '2023371057@uteq.edu.mx',
    password: DEMO_PASSWORD,
    phone: '5551000002',
    birthDate: '2002-03-14',
    address: 'Queretaro',
    isSuperAdmin: false,
    groupIds: [GROUP_IDS.SUPPORT],
    permissionsByGroup: {
      [GROUP_IDS.SUPPORT]: [
        'group:view', 'group:add',
        'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:edit:state', 'ticket:edit:comment',
      ],
    },
  },
  // --- Marher demo users ---
  {
    id: USER_IDS.ADMIN,
    name: 'Admin Marher',
    username: 'admin',
    email: 'admin@marher.com',
    password: MARHER_DEMO_PASSWORD,
    phone: '',
    birthDate: '1990-01-01',
    address: '',
    isSuperAdmin: true,
    groupIds: MOCK_GROUPS.map(g => g.id),
    permissionsByGroup: Object.fromEntries(
      MOCK_GROUPS.map(g => [
        g.id,
        [
          'user:view', 'user:add', 'user:edit', 'user:edit:profile', 'user:delete', 'user:manage',
          'group:view', 'group:add', 'group:edit', 'group:delete', 'group:manage',
          'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:delete',
          'ticket:edit:state', 'ticket:edit:comment', 'ticket:manage',
        ] as PermissionKey[],
      ]),
    ) as Record<string, PermissionKey[]>,
  },
  {
    id: USER_IDS.PM,
    name: 'Project Manager',
    username: 'pm',
    email: 'pm@marher.com',
    password: MARHER_DEMO_PASSWORD,
    phone: '',
    birthDate: '1990-01-01',
    address: '',
    isSuperAdmin: false,
    groupIds: MOCK_GROUPS.map(g => g.id),
    permissionsByGroup: Object.fromEntries(
      MOCK_GROUPS.map(g => [
        g.id,
        [
          'user:view', 'user:edit:profile',
          'group:view', 'group:add', 'group:edit', 'group:delete', 'group:manage',
          'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:delete',
          'ticket:edit:state', 'ticket:edit:comment', 'ticket:manage',
        ] as PermissionKey[],
      ]),
    ) as Record<string, PermissionKey[]>,
  },
  {
    id: USER_IDS.DEV,
    name: 'Developer',
    username: 'dev',
    email: 'dev@marher.com',
    password: MARHER_DEMO_PASSWORD,
    phone: '',
    birthDate: '1990-01-01',
    address: '',
    isSuperAdmin: false,
    groupIds: MOCK_GROUPS.map(g => g.id),
    permissionsByGroup: Object.fromEntries(
      MOCK_GROUPS.map(g => [
        g.id,
        [
          'user:view', 'user:edit:profile',
          'group:view',
          'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:edit:state', 'ticket:edit:comment',
        ] as PermissionKey[],
      ]),
    ) as Record<string, PermissionKey[]>,
  },
  {
    id: USER_IDS.SUPPORT,
    name: 'Support',
    username: 'support',
    email: 'support@marher.com',
    password: MARHER_DEMO_PASSWORD,
    phone: '',
    birthDate: '1990-01-01',
    address: '',
    isSuperAdmin: false,
    groupIds: [GROUP_IDS.SUPPORT],
    permissionsByGroup: {
      [GROUP_IDS.SUPPORT]: [
        'user:view', 'user:edit:profile', 'group:view',
        'ticket:view', 'ticket:add', 'ticket:edit:comment',
      ],
    },
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TK-1001',
    groupId: GROUP_IDS.SUPPORT,
    title: 'Error en login de usuarios remotos',
    description: 'Usuarios con VPN reportan lentitud y timeout al autenticar.',
    status: 'En progreso',
    assigneeId: USER_IDS.CARRILLO,
    assigneeName: 'Juan Pablo Carrillo Rodriguez',
    createdById: USER_IDS.SUPERADMIN,
    createdByName: 'Super Admin',
    priority: 'Alta',
    createdAt: '2025-05-10T09:15:00.000Z',
    dueDate: '2025-05-18',
    comments: [
      {
        id: 'c-1',
        authorId: USER_IDS.SUPERADMIN,
        authorName: 'Super Admin',
        message: 'Validar logs de gateway antes de aplicar cambios.',
        createdAt: '2025-05-10T10:30:00.000Z',
      },
    ],
    history: [
      { id: 'h-1', at: '2025-05-10T09:15:00.000Z', actorName: 'Super Admin', action: 'Ticket creado' },
      { id: 'h-2', at: '2025-05-10T10:45:00.000Z', actorName: 'Super Admin', action: 'Estado actualizado a En progreso' },
    ],
  },
];
