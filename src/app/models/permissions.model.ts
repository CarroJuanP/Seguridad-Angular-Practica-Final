/**
 * 📌 CATÁLOGO DE PERMISOS
 * Estructura: [recurso]_[acción]
 * Recursos: groups, users, tickets
 * Acciones: view, add, edit, delete
 */

export type PermissionKey =
  | 'GROUPS_VIEW'
  | 'GROUPS_ADD'
  | 'GROUPS_EDIT'
  | 'GROUPS_DELETE'
  | 'USERS_VIEW'
  | 'USERS_ADD'
  | 'USERS_EDIT'
  | 'USERS_DELETE'
  | 'TICKETS_VIEW'
  | 'TICKETS_ADD'
  | 'TICKETS_EDIT'
  | 'TICKETS_DELETE';

export const PERMISSIONS_CATALOG: { [K in PermissionKey]: K } = {
  GROUPS_VIEW:   'GROUPS_VIEW',
  GROUPS_ADD:    'GROUPS_ADD',
  GROUPS_EDIT:   'GROUPS_EDIT',
  GROUPS_DELETE: 'GROUPS_DELETE',
  USERS_VIEW:    'USERS_VIEW',
  USERS_ADD:     'USERS_ADD',
  USERS_EDIT:    'USERS_EDIT',
  USERS_DELETE:  'USERS_DELETE',
  TICKETS_VIEW:  'TICKETS_VIEW',
  TICKETS_ADD:   'TICKETS_ADD',
  TICKETS_EDIT:  'TICKETS_EDIT',
  TICKETS_DELETE:'TICKETS_DELETE'
} as const;

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(
  PERMISSIONS_CATALOG
);

export const ROLE_PERMISSIONS: Record<
  'admin' | 'user' | 'viewer' | 'editor',
  PermissionKey[]
> = {
  admin: ALL_PERMISSIONS,
  user: [
    // El usuario estándar solo verá Tickets
    PERMISSIONS_CATALOG.TICKETS_VIEW
  ],
  viewer: [
    // El viewer ve Grupos y Tickets, pero no Usuarios
    PERMISSIONS_CATALOG.GROUPS_VIEW,
    PERMISSIONS_CATALOG.TICKETS_VIEW
  ],
  editor: [
    // El editor ve Grupos y Tickets (y puede editar tickets)
    PERMISSIONS_CATALOG.GROUPS_VIEW,
    PERMISSIONS_CATALOG.TICKETS_VIEW,
    PERMISSIONS_CATALOG.TICKETS_EDIT
  ]
};

export interface UserPermissions {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer' | 'editor';
  permissions: PermissionKey[];
}
