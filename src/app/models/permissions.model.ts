// Este archivo concentra el contrato de datos del frontend.
// Define tipos de permisos, usuarios, grupos y tickets consumidos por la app.
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

