import {
  hashPassword,
  normalizePermission,
  normalizeUser,
  toPublicUser,
  type AppGroup,
  type AppUser,
  type Ticket,
  type TicketComment,
  type TicketHistoryEntry,
} from './contracts.js';
import { supabase } from './supabase.js';

type UserRow = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  password_hash: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  is_super_admin: boolean;
  is_active: boolean;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  llm_model: string | null;
  llm_color: string | null;
  is_active?: boolean;
};

type GroupMemberRow = {
  group_id: string;
  user_id: string;
};

type PermissionRow = {
  id: string;
  key: string;
};

type UserGroupPermissionRow = {
  group_id: string;
  user_id: string;
  permission_id: string;
};

type TicketCatalogRow = {
  id: string;
  name: string;
  sort_order: number;
};

type TicketRow = {
  id: string;
  code: string;
  group_id: string;
  title: string;
  description: string | null;
  created_by: string;
  assignee_id: string | null;
  status_id: string;
  priority_id: string;
  due_date: string | null;
  created_at: string;
};

type TicketCommentRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  message: string;
  created_at: string;
};

type TicketHistoryRow = {
  id: string;
  ticket_id: string;
  actor_id: string;
  action: string;
  created_at: string;
};

type CreateUserInput = {
  id?: string;
  name: string;
  email: string;
  username: string;
  password: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  isSuperAdmin?: boolean;
  groupIds?: string[];
  permissionsByGroup?: Record<string, string[]>;
};

type UpdateUserInput = Partial<CreateUserInput>;

type CreateGroupInput = {
  name: string;
  description?: string;
  llmModel?: string;
  llmColor?: string;
  createdBy?: string | null;
};

type UpdateGroupInput = Partial<CreateGroupInput>;

type CreateTicketInput = {
  groupId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string | null;
  createdBy: string;
};

type UpdateTicketInput = {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string | null;
  actorId?: string;
  action?: string;
};

function requireData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }

  if (data === null) {
    throw new Error(`${context}: respuesta vacia`);
  }

  return data;
}

function ensureNoQueryError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function mapGroup(row: GroupRow): AppGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    llmModel: row.llm_model ?? '',
    llmColor: row.llm_color ?? '#3b82f6',
  };
}

function mapUser(row: UserRow, membershipRows: GroupMemberRow[], permissionRows: UserGroupPermissionRow[], permissionMap: Map<string, string>): AppUser {
  const groupIds = [...new Set(membershipRows.filter(item => item.user_id === row.id).map(item => item.group_id))];
  const permissionsByGroup = Object.fromEntries(
    groupIds.map(groupId => {
      const keys = permissionRows
        .filter(item => item.user_id === row.id && item.group_id === groupId)
        .map(item => permissionMap.get(item.permission_id) ?? '')
        .filter(Boolean)
        .map(normalizePermission);
      return [groupId, [...new Set(keys)]];
    }),
  );

  return normalizeUser({
    id: row.id,
    name: row.full_name,
    username: row.username,
    email: row.email,
    password: row.password_hash,
    phone: row.phone ?? '',
    birthDate: row.birth_date ?? '2000-01-01',
    address: row.address ?? '',
    isSuperAdmin: row.is_super_admin,
    groupIds,
    permissionsByGroup,
  });
}

async function loadPermissionCatalog(): Promise<{ rows: PermissionRow[]; keyById: Map<string, string>; idByKey: Map<string, string> }> {
  const { data, error } = await supabase.from('permissions').select('id,key').order('key');
  const rows = requireData(data as PermissionRow[] | null, error, 'No se pudo cargar catalogo de permisos');
  const keyById = new Map(rows.map(row => [row.id, normalizePermission(row.key)]));
  const idByKey = new Map(rows.map(row => [normalizePermission(row.key), row.id]));
  return { rows, keyById, idByKey };
}

async function loadMemberships(): Promise<GroupMemberRow[]> {
  const { data, error } = await supabase.from('group_members').select('group_id,user_id');
  return requireData(data as GroupMemberRow[] | null, error, 'No se pudo cargar membresias');
}

async function loadUserPermissions(): Promise<UserGroupPermissionRow[]> {
  const { data, error } = await supabase.from('user_group_permissions').select('group_id,user_id,permission_id');
  return requireData(data as UserGroupPermissionRow[] | null, error, 'No se pudo cargar permisos por grupo');
}

export async function listPermissionKeys(): Promise<string[]> {
  const { rows } = await loadPermissionCatalog();
  return rows.map(row => normalizePermission(row.key));
}

export async function listUsers(activeOnly = true): Promise<AppUser[]> {
  let query = supabase
    .from('users')
    .select('id,full_name,username,email,password_hash,phone,birth_date,address,is_super_admin,is_active')
    .order('created_at', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const [{ data, error }, memberships, grants, permissions] = await Promise.all([
    query,
    loadMemberships(),
    loadUserPermissions(),
    loadPermissionCatalog(),
  ]);

  const rows = requireData(data as UserRow[] | null, error, 'No se pudieron cargar usuarios');
  return rows.map(row => mapUser(row, memberships, grants, permissions.keyById));
}

export async function findUserByIdentifierInDb(identifier: string): Promise<AppUser | null> {
  const normalized = identifier.trim().toLowerCase();
  const users = await listUsers(true);
  return users.find(user => user.email === normalized || user.username.toLowerCase() === normalized) ?? null;
}

export async function findUserById(userId: string): Promise<AppUser | null> {
  const users = await listUsers(false);
  return users.find(user => user.id === userId) ?? null;
}

async function syncMembershipsAndPermissions(userId: string, groupIds: string[], permissionsByGroup: Record<string, string[]>): Promise<void> {
  const normalizedGroupIds = [...new Set(groupIds.filter(Boolean))];
  const { data: currentMemberships, error: membershipsError } = await supabase
    .from('group_members')
    .select('group_id,user_id')
    .eq('user_id', userId);

  if (membershipsError) {
    throw new Error(`No se pudieron cargar membresias actuales: ${membershipsError.message}`);
  }

  const currentGroupIds = (currentMemberships as GroupMemberRow[]).map(item => item.group_id);
  const groupsToAdd = normalizedGroupIds.filter(groupId => !currentGroupIds.includes(groupId));
  const groupsToRemove = currentGroupIds.filter(groupId => !normalizedGroupIds.includes(groupId));

  if (groupsToAdd.length > 0) {
    const { error } = await supabase.from('group_members').insert(groupsToAdd.map(groupId => ({ group_id: groupId, user_id: userId })));
    if (error) {
      throw new Error(`No se pudieron agregar membresias: ${error.message}`);
    }
  }

  if (groupsToRemove.length > 0) {
    const { error: permissionsDeleteError } = await supabase
      .from('user_group_permissions')
      .delete()
      .eq('user_id', userId)
      .in('group_id', groupsToRemove);
    if (permissionsDeleteError) {
      throw new Error(`No se pudieron eliminar permisos obsoletos: ${permissionsDeleteError.message}`);
    }

    const { error: membershipsDeleteError } = await supabase
      .from('group_members')
      .delete()
      .eq('user_id', userId)
      .in('group_id', groupsToRemove);
    if (membershipsDeleteError) {
      throw new Error(`No se pudieron eliminar membresias obsoletas: ${membershipsDeleteError.message}`);
    }
  }

  const { idByKey } = await loadPermissionCatalog();
  for (const groupId of normalizedGroupIds) {
    const { error: clearError } = await supabase
      .from('user_group_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('group_id', groupId);
    if (clearError) {
      throw new Error(`No se pudieron limpiar permisos del grupo ${groupId}: ${clearError.message}`);
    }

    const permissionIds = [...new Set((permissionsByGroup[groupId] ?? []).map(normalizePermission).map(key => idByKey.get(key) ?? '').filter(Boolean))];
    if (permissionIds.length === 0) {
      continue;
    }

    const rows = permissionIds.map(permissionId => ({ group_id: groupId, user_id: userId, permission_id: permissionId }));
    const { error: insertError } = await supabase.from('user_group_permissions').insert(rows);
    if (insertError) {
      throw new Error(`No se pudieron guardar permisos del grupo ${groupId}: ${insertError.message}`);
    }
  }
}

export async function createRegisteredUser(input: CreateUserInput): Promise<AppUser> {
  const payload = {
    id: input.id,
    full_name: input.name.trim(),
    username: input.username.trim().toLowerCase(),
    email: input.email.trim().toLowerCase(),
    password_hash: hashPassword(input.password),
    phone: input.phone?.trim() ?? '',
    birth_date: input.birthDate?.trim() ?? '2000-01-01',
    address: input.address?.trim() ?? '',
    is_super_admin: input.isSuperAdmin === true,
    is_active: true,
  };

  const { data, error } = await supabase
    .from('users')
    .insert(payload)
    .select('id')
    .single();

  const created = requireData(data as { id: string } | null, error, 'No se pudo crear usuario');
  await syncMembershipsAndPermissions(created.id, input.groupIds ?? [], input.permissionsByGroup ?? {});
  const user = await findUserById(created.id);
  if (!user) {
    throw new Error('El usuario se creo pero no pudo leerse despues');
  }
  return user;
}

export async function updateUserInDb(userId: string, input: UpdateUserInput): Promise<AppUser | null> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.full_name = input.name.trim();
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
  if (input.username !== undefined) patch.username = input.username.trim().toLowerCase();
  if (input.password !== undefined && input.password !== '') patch.password_hash = hashPassword(input.password);
  if (input.phone !== undefined) patch.phone = input.phone.trim();
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate.trim() || '2000-01-01';
  if (input.address !== undefined) patch.address = input.address.trim();
  if (input.isSuperAdmin !== undefined) patch.is_super_admin = input.isSuperAdmin === true;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('users').update(patch).eq('id', userId);
    if (error) {
      throw new Error(`No se pudo actualizar usuario: ${error.message}`);
    }
  }

  if (input.groupIds || input.permissionsByGroup) {
    const current = await findUserById(userId);
    if (!current) {
      return null;
    }

    await syncMembershipsAndPermissions(
      userId,
      input.groupIds ?? current.groupIds,
      input.permissionsByGroup ?? current.permissionsByGroup,
    );
  }

  return findUserById(userId);
}

export async function deleteUserFromDb(userId: string): Promise<void> {
  const { error: unassignError } = await supabase.from('tickets').update({ assignee_id: null }).eq('assignee_id', userId);
  if (unassignError) {
    throw new Error(`No se pudieron desasignar tickets del usuario: ${unassignError.message}`);
  }

  const { error: deletePermissionsError } = await supabase.from('user_group_permissions').delete().eq('user_id', userId);
  if (deletePermissionsError) {
    throw new Error(`No se pudieron eliminar permisos del usuario: ${deletePermissionsError.message}`);
  }

  const { error: deleteMembershipsError } = await supabase.from('group_members').delete().eq('user_id', userId);
  if (deleteMembershipsError) {
    throw new Error(`No se pudieron eliminar membresias del usuario: ${deleteMembershipsError.message}`);
  }

  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) {
    throw new Error(`No se pudo eliminar usuario: ${error.message}`);
  }
}

export async function listGroupsInDb(): Promise<AppGroup[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id,name,description,llm_model,llm_color,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const rows = requireData(data as GroupRow[] | null, error, 'No se pudieron cargar grupos');
  return rows.map(mapGroup);
}

export async function findGroupByIdInDb(groupId: string): Promise<AppGroup | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('id,name,description,llm_model,llm_color,is_active')
    .eq('id', groupId)
    .eq('is_active', true)
    .maybeSingle();

  ensureNoQueryError(error, 'No se pudo cargar grupo');
  const row = data as GroupRow | null;
  return row ? mapGroup(row) : null;
}

export async function createGroupInDb(input: CreateGroupInput): Promise<AppGroup> {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      llm_model: input.llmModel?.trim() ?? '',
      llm_color: input.llmColor?.trim() ?? '#F54927',
      created_by: input.createdBy ?? null,
      is_active: true,
    })
    .select('id,name,description,llm_model,llm_color')
    .single();

  return mapGroup(requireData(data as GroupRow | null, error, 'No se pudo crear grupo'));
}

export async function updateGroupInDb(groupId: string, input: UpdateGroupInput): Promise<AppGroup | null> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.llmModel !== undefined) patch.llm_model = input.llmModel.trim();
  if (input.llmColor !== undefined) patch.llm_color = input.llmColor.trim() || '#F54927';

  const { data, error } = await supabase
    .from('groups')
    .update(patch)
    .eq('id', groupId)
    .select('id,name,description,llm_model,llm_color')
    .maybeSingle();

  ensureNoQueryError(error, 'No se pudo actualizar grupo');
  const row = data as GroupRow | null;
  return row ? mapGroup(row) : null;
}

export async function deleteGroupFromDb(groupId: string): Promise<void> {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) {
    throw new Error(`No se pudo eliminar grupo: ${error.message}`);
  }
}

export async function listUsersInGroupFromDb(groupId: string): Promise<AppUser[]> {
  const users = await listUsers(true);
  return users.filter(user => user.groupIds.includes(groupId)).map(toPublicUser);
}

export async function addUserToGroupInDb(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('group_members').upsert({ group_id: groupId, user_id: userId }, { onConflict: 'group_id,user_id' });
  if (error) {
    throw new Error(`No se pudo agregar el usuario al grupo: ${error.message}`);
  }
}

export async function removeUserFromGroupInDb(groupId: string, userId: string): Promise<void> {
  const { error: permissionsError } = await supabase
    .from('user_group_permissions')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (permissionsError) {
    throw new Error(`No se pudieron quitar permisos del grupo: ${permissionsError.message}`);
  }

  const { error: membershipError } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (membershipError) {
    throw new Error(`No se pudo remover el usuario del grupo: ${membershipError.message}`);
  }

  const { error: ticketError } = await supabase
    .from('tickets')
    .update({ assignee_id: null })
    .eq('group_id', groupId)
    .eq('assignee_id', userId);
  if (ticketError) {
    throw new Error(`No se pudieron desasignar tickets del grupo: ${ticketError.message}`);
  }
}

async function loadStatuses(): Promise<TicketCatalogRow[]> {
  const { data, error } = await supabase.from('ticket_statuses').select('id,name,sort_order').order('sort_order');
  return requireData(data as TicketCatalogRow[] | null, error, 'No se pudieron cargar estados');
}

async function loadPriorities(): Promise<TicketCatalogRow[]> {
  const { data, error } = await supabase.from('ticket_priorities').select('id,name,sort_order').order('sort_order');
  return requireData(data as TicketCatalogRow[] | null, error, 'No se pudieron cargar prioridades');
}

export async function listTicketStatusNames(): Promise<string[]> {
  const rows = await loadStatuses();
  return rows.map(row => row.name);
}

export async function listTicketPriorityNames(): Promise<string[]> {
  const rows = await loadPriorities();
  return rows.map(row => row.name);
}

function buildTicketMapContext(users: AppUser[], statusRows: TicketCatalogRow[], priorityRows: TicketCatalogRow[]) {
  return {
    userById: new Map(users.map(user => [user.id, user])),
    statusById: new Map(statusRows.map(row => [row.id, row.name])),
    priorityById: new Map(priorityRows.map(row => [row.id, row.name])),
  };
}

function mapTicketRow(
  row: TicketRow,
  users: AppUser[],
  statusRows: TicketCatalogRow[],
  priorityRows: TicketCatalogRow[],
  commentRows: TicketCommentRow[],
  historyRows: TicketHistoryRow[],
): Ticket {
  const ctx = buildTicketMapContext(users, statusRows, priorityRows);
  const creator = ctx.userById.get(row.created_by);
  const assignee = row.assignee_id ? ctx.userById.get(row.assignee_id) ?? null : null;
  const comments: TicketComment[] = commentRows
    .filter(item => item.ticket_id === row.id)
    .map(item => ({
      id: item.id,
      authorId: item.author_id,
      authorName: ctx.userById.get(item.author_id)?.name ?? 'Desconocido',
      message: item.message,
      createdAt: item.created_at,
    }));
  const history: TicketHistoryEntry[] = historyRows
    .filter(item => item.ticket_id === row.id)
    .map(item => ({
      id: item.id,
      at: item.created_at,
      actorName: ctx.userById.get(item.actor_id)?.name ?? 'Desconocido',
      action: item.action,
    }));

  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    description: row.description ?? '',
    status: ctx.statusById.get(row.status_id) ?? 'Pendiente',
    assigneeId: row.assignee_id,
    assigneeName: assignee?.name ?? null,
    createdById: row.created_by,
    createdByName: creator?.name ?? 'Desconocido',
    priority: ctx.priorityById.get(row.priority_id) ?? 'Media',
    createdAt: row.created_at,
    dueDate: row.due_date ?? '',
    comments,
    history,
  };
}

async function loadTicketSupportData() {
  const [users, statuses, priorities, commentsResponse, historyResponse] = await Promise.all([
    listUsers(false),
    loadStatuses(),
    loadPriorities(),
    supabase.from('ticket_comments').select('id,ticket_id,author_id,message,created_at').order('created_at', { ascending: true }),
    supabase.from('ticket_history').select('id,ticket_id,actor_id,action,created_at').order('created_at', { ascending: true }),
  ]);

  const commentRows = requireData(commentsResponse.data as TicketCommentRow[] | null, commentsResponse.error, 'No se pudieron cargar comentarios');
  const historyRows = requireData(historyResponse.data as TicketHistoryRow[] | null, historyResponse.error, 'No se pudo cargar historial');
  return { users, statuses, priorities, commentRows, historyRows };
}

export async function listTicketsFromDb(groupId?: string): Promise<Ticket[]> {
  let query = supabase
    .from('tickets')
    .select('id,code,group_id,title,description,created_by,assignee_id,status_id,priority_id,due_date,created_at')
    .order('created_at', { ascending: false });

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const [{ data, error }, support] = await Promise.all([query, loadTicketSupportData()]);
  const rows = requireData(data as TicketRow[] | null, error, 'No se pudieron cargar tickets');
  return rows.map(row => mapTicketRow(row, support.users, support.statuses, support.priorities, support.commentRows, support.historyRows));
}

export async function findTicketInDb(ticketId: string): Promise<Ticket | null> {
  const [{ data, error }, support] = await Promise.all([
    supabase
      .from('tickets')
      .select('id,code,group_id,title,description,created_by,assignee_id,status_id,priority_id,due_date,created_at')
      .eq('id', ticketId)
      .maybeSingle(),
    loadTicketSupportData(),
  ]);

  ensureNoQueryError(error, 'No se pudo cargar ticket');
  const row = data as TicketRow | null;
  return row ? mapTicketRow(row, support.users, support.statuses, support.priorities, support.commentRows, support.historyRows) : null;
}

async function findStatusIdByName(status: string): Promise<string | null> {
  const rows = await loadStatuses();
  return rows.find(row => row.name === status)?.id ?? null;
}

async function findPriorityIdByName(priority: string): Promise<string | null> {
  const rows = await loadPriorities();
  return rows.find(row => row.name === priority)?.id ?? null;
}

async function nextTicketCode(): Promise<string> {
  const { data, error } = await supabase.from('tickets').select('code').order('created_at', { ascending: false }).limit(1);
  const rows = requireData(data as Array<{ code: string }> | null, error, 'No se pudo generar codigo de ticket');
  const lastCode = rows[0]?.code ?? 'TK-10000';
  const lastNumber = Number(lastCode.replaceAll(/\D+/g, '')) || 10000;
  return `TK-${lastNumber + 1}`;
}

export async function createTicketInDb(input: CreateTicketInput): Promise<Ticket> {
  const [statusId, priorityId, code] = await Promise.all([
    findStatusIdByName(input.status),
    findPriorityIdByName(input.priority),
    nextTicketCode(),
  ]);
  if (!statusId || !priorityId) {
    throw new Error('Estado o prioridad invalidos');
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      code,
      group_id: input.groupId,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      created_by: input.createdBy,
      assignee_id: input.assigneeId,
      status_id: statusId,
      priority_id: priorityId,
      due_date: input.dueDate,
    })
    .select('id')
    .single();

  const created = requireData(data as { id: string } | null, error, 'No se pudo crear ticket');
  const creator = await findUserById(input.createdBy);
  if (creator) {
    await supabase.from('ticket_history').insert({ ticket_id: created.id, actor_id: creator.id, action: 'Ticket creado' });
  }
  const ticket = await findTicketInDb(created.id);
  if (!ticket) {
    throw new Error('El ticket se creo pero no pudo recuperarse');
  }
  return ticket;
}

export async function updateTicketInDb(ticketId: string, input: UpdateTicketInput): Promise<Ticket | null> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.assigneeId !== undefined) patch.assignee_id = input.assigneeId;
  if (input.status !== undefined) {
    const statusId = await findStatusIdByName(input.status);
    if (!statusId) {
      throw new Error('Estado invalido');
    }
    patch.status_id = statusId;
  }
  if (input.priority !== undefined) {
    const priorityId = await findPriorityIdByName(input.priority);
    if (!priorityId) {
      throw new Error('Prioridad invalida');
    }
    patch.priority_id = priorityId;
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('tickets').update(patch).eq('id', ticketId);
    if (error) {
      throw new Error(`No se pudo actualizar ticket: ${error.message}`);
    }
  }

  if (input.actorId) {
    const { error } = await supabase.from('ticket_history').insert({
      ticket_id: ticketId,
      actor_id: input.actorId,
      action: input.action?.trim() || 'Ticket actualizado',
    });
    if (error) {
      throw new Error(`No se pudo guardar historial del ticket: ${error.message}`);
    }
  }

  return findTicketInDb(ticketId);
}

export async function deleteTicketFromDb(ticketId: string): Promise<void> {
  const { error } = await supabase.from('tickets').delete().eq('id', ticketId);
  if (error) {
    throw new Error(`No se pudo eliminar ticket: ${error.message}`);
  }
}

export async function addTicketCommentInDb(ticketId: string, authorId: string, message: string): Promise<Ticket | null> {
  const { error: commentError } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_id: authorId,
    message: message.trim(),
  });
  if (commentError) {
    throw new Error(`No se pudo agregar comentario: ${commentError.message}`);
  }

  const { error: historyError } = await supabase.from('ticket_history').insert({
    ticket_id: ticketId,
    actor_id: authorId,
    action: 'Comentario agregado',
  });
  if (historyError) {
    throw new Error(`No se pudo guardar historial del comentario: ${historyError.message}`);
  }

  return findTicketInDb(ticketId);
}