// Este archivo concentra el contrato de datos del frontend.
// Define tipos de permisos, usuarios, grupos, tickets, respuestas de API y datos demo.
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

// Grupo funcional de trabajo dentro del sistema.
export interface AppGroup {
  id: string;
  name: string;
  description: string;
  llmModel: string;
  llmColor: string;
}

// Usuario ya adaptado a la forma que consume la app Angular.
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

// Catalogos de estado y prioridad que la UI y la BD deben mantener alineados.
export type TicketStatus = 'Pendiente' | 'En progreso' | 'Revision' | 'Hecho' | 'Bloqueado';
export type TicketPriority = 'Critica' | 'Muy alta' | 'Alta' | 'Media' | 'Baja' | 'Muy baja' | 'Bloqueado';

// Comentario visible dentro del detalle de ticket.
export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
}

// Registro de auditoria de acciones sobre un ticket.
export interface TicketHistoryEntry {
  id: string;
  at: string;
  actorName: string;
  action: string;
}

// Entidad rica de ticket tal y como la muestran las paginas.
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

// Estado persistido de la sesion en localStorage o memoria.
export interface UserSession {
  userId: string;
  name: string;
  email: string;
  selectedGroupId: string | null;
  permissions: PermissionKey[];
  token?: string;
  hasEnteredGroup?: boolean;
}

// Contratos de respuesta del backend externo / edge function.
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
  intOpCode?: string;
  data?: ApiLoginResult[] | ApiLoginResult | null;
}

export interface ApiResponseEnvelope<T = unknown> {
  statusCode?: number;
  intOpCode?: string;
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
// IDs fijos para que frontend y SQL compartan el mismo universo demo.
export const GROUP_IDS = {
  ERP_FINANCE: 'a1b2c3d4-e5f6-0000-0000-000000000001',
  SUPPORT:     'a1b2c3d4-e5f6-0000-0000-000000000002',
  BI:          'a1b2c3d4-e5f6-0000-0000-000000000003',
} as const;

// Grupos base mostrados incluso cuando la app aun no ha consultado la BD.
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
