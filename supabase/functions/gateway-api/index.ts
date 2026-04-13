/// <reference path="./npm-supabase-js.d.ts" />
import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type GatewayEnvelope<T> = {
  statusCode: number;
  intOpCode: string;
  data: T | null;
  message?: string;
};

type AppGroup = {
  id: string;
  name: string;
  description: string;
  llmModel: string;
  llmColor: string;
};

type AppUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  groupIds: string[];
  permissionsByGroup: Record<string, string[]>;
};

type AppTicketComment = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
};

type AppTicketHistory = {
  id: string;
  at: string;
  actorName: string;
  action: string;
};

type AppTicket = {
  id: string;
  code: string;
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
  comments: AppTicketComment[];
  history: AppTicketHistory[];
};

type GatewayTokenPayload = {
  sub: string;
  email: string;
  groupIds: string[];
  permissionsByGroup: Record<string, string[]>;
  iat: number;
};

type GroupRow = {
  id: unknown;
  name: unknown;
  description: unknown;
  llm_model: unknown;
  llm_color: unknown;
};

type UserRow = {
  id: unknown;
  full_name: unknown;
  username: unknown;
  email: unknown;
  phone: unknown;
  birth_date: unknown;
  address: unknown;
  is_super_admin: unknown;
  is_active: unknown;
  password_hash?: unknown;
};

type GroupMemberRow = {
  group_id: unknown;
  user_id: unknown;
};

type UserGroupPermissionRow = {
  group_id: unknown;
  user_id: unknown;
  permission_id: unknown;
};

type PermissionRow = {
  id: unknown;
  key: unknown;
};

type TicketCatalogRow = {
  id: unknown;
  name: unknown;
};

type TicketRow = {
  id: unknown;
  code: unknown;
  group_id: unknown;
  title: unknown;
  description: unknown;
  status_id: unknown;
  assignee_id: unknown;
  created_by: unknown;
  priority_id: unknown;
  created_at: unknown;
  due_date: unknown;
};

type TicketCommentRow = {
  id: unknown;
  author_id: unknown;
  message: unknown;
  created_at: unknown;
};

type TicketHistoryRow = {
  id: unknown;
  actor_id: unknown;
  action: unknown;
  created_at: unknown;
};

type GatewayRequestLogRow = {
  endpoint: string;
  method: string;
  user_id: string | null;
  ip_address: string | null;
  status_code: number;
  int_op_code: string | null;
  duration_ms: number;
  error_message: string | null;
};

type EndpointMetricRow = {
  method: string;
  endpoint: string;
  request_count: number;
  total_duration_ms: number;
  average_duration_ms: number;
};

type GroupTicketSummary = {
  groupId: string;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

type DenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const FUNCTION_NAME = "gateway-api";
const MAX_REQUESTS_PER_MINUTE = 100;
const PASSWORD_HASH_PREFIX = "sha256:";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

const runtime = globalThis as typeof globalThis & { Deno: DenoRuntime };

const supabaseUrl = runtime.Deno.env.get("APP_SUPABASE_URL") ?? runtime.Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = runtime.Deno.env.get("APP_SUPABASE_SERVICE_ROLE_KEY") ?? runtime.Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeIntOpCode(statusCode: number, intOpCode: string | number): string {
  if (typeof intOpCode === "string" && intOpCode.trim().length > 0) {
    return intOpCode.trim();
  }

  return `SxGW${statusCode}`;
}

function jsonResponse<T>(statusCode: number, intOpCode: string | number, data: T | null, message?: string): Response {
  const payload: GatewayEnvelope<T> = {
    statusCode,
    intOpCode: normalizeIntOpCode(statusCode, intOpCode),
    data,
    message,
  };
  return new Response(JSON.stringify(payload), { status: statusCode, headers: CORS_HEADERS });
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readId(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readStringArrayRecord(value: unknown): Record<string, string[]> {
  const record = asRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record).map(([key, entryValue]) => [key, uniqueStrings(entryValue)]),
  );
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(item => typeof item === "string").map(item => String(item).trim()).filter(Boolean))];
}

function parseBody(req: Request): Promise<JsonRecord | null> {
  return req.json()
    .then((payload: unknown) => asRecord(payload))
    .catch(() => null);
}

function getRouteSegments(req: Request): string[] {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const functionIndex = parts.lastIndexOf(FUNCTION_NAME);
  return functionIndex >= 0 ? parts.slice(functionIndex + 1) : parts;
}

function validateEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

async function hashPassword(password: string): Promise<string> {
  const normalizedPassword = readString(password);
  if (!normalizedPassword) {
    return "";
  }

  if (normalizedPassword.startsWith(PASSWORD_HASH_PREFIX)) {
    return normalizedPassword;
  }

  const encodedPassword = new TextEncoder().encode(normalizedPassword);
  const digest = await crypto.subtle.digest("SHA-256", encodedPassword);
  const digestBytes = Array.from(new Uint8Array(digest));
  const digestHex = digestBytes.map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${PASSWORD_HASH_PREFIX}${digestHex}`;
}

async function isPasswordMatch(storedPassword: string, candidatePassword: string): Promise<boolean> {
  const normalizedStoredPassword = readString(storedPassword);
  const normalizedCandidatePassword = readString(candidatePassword);

  if (!normalizedStoredPassword || !normalizedCandidatePassword) {
    return false;
  }

  if (normalizedStoredPassword === normalizedCandidatePassword) {
    return true;
  }

  return normalizedStoredPassword === await hashPassword(normalizedCandidatePassword);
}

async function ensureStoredPasswordIsHashed(userId: string, storedPassword: string): Promise<void> {
  const normalizedStoredPassword = readString(storedPassword);
  if (!userId || !normalizedStoredPassword || normalizedStoredPassword.startsWith(PASSWORD_HASH_PREFIX)) {
    return;
  }

  await supabase
    .from("users")
    .update({ password_hash: await hashPassword(normalizedStoredPassword) })
    .eq("id", userId);
}

function buildToken(user: AppUser): string {
  const payload: GatewayTokenPayload = {
    sub: user.id,
    email: user.email,
    groupIds: user.groupIds,
    permissionsByGroup: user.permissionsByGroup,
    iat: Date.now(),
  };

  return btoa(JSON.stringify(payload));
}

function normalizePermission(permission: string): string {
  const aliases: Record<string, string> = {
    "groups:view": "group:view",
    "groups:add": "group:add",
    "groups:edit": "group:edit",
    "groups:delete": "group:delete",
    "groups:manage": "group:manage",
    "users:view": "user:view",
    "users:add": "user:add",
    "users:edit": "user:edit",
    "users:delete": "user:delete",
    "users:manage": "user:manage",
    "tickets:view": "ticket:view",
    "tickets:add": "ticket:add",
    "tickets:edit": "ticket:edit",
    "tickets:delete": "ticket:delete",
    "tickets:move": "ticket:edit:state",
    "tickets:comment": "ticket:edit:comment",
    "tickets:assign": "ticket:edit:assign",
    "tickets:manage": "ticket:manage",
  };

  return aliases[permission.trim()] ?? permission.trim();
}

function flattenPermissionsByGroup(user: AppUser): string[] {
  return [...new Set(Object.values(user.permissionsByGroup).flat().map(permission => normalizePermission(permission)))];
}

function getGroupPermissions(user: AppUser, groupId: string | null): string[] {
  if (!groupId) {
    return flattenPermissionsByGroup(user);
  }

  return (user.permissionsByGroup[groupId] ?? []).map(permission => normalizePermission(permission));
}

function hasPermission(user: AppUser, permission: string, groupId: string | null = null): boolean {
  if (user.isSuperAdmin) {
    return true;
  }

  return getGroupPermissions(user, groupId).includes(normalizePermission(permission));
}

function hasAnyPermission(user: AppUser, permissions: string[], groupId: string | null = null): boolean {
  return permissions.some(permission => hasPermission(user, permission, groupId));
}

function getCookieValue(req: Request, name: string): string {
  const cookieHeader = req.headers.get("cookie") ?? "";
  return cookieHeader
    .split(";")
    .map(fragment => fragment.trim())
    .find(fragment => fragment.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? "";
}

function getAuthToken(req: Request): string {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return getCookieValue(req, "erp_token");
}

function readTokenPayload(token: string): GatewayTokenPayload | null {
  if (!token) return null;

  try {
    const normalized = token.replaceAll("-", "+").replaceAll("_", "/");
    const payload = JSON.parse(atob(normalized)) as GatewayTokenPayload;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function resolveClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "";
  const value = forwardedFor.split(",")[0]?.trim() ?? "";
  return value || null;
}

async function readIntOpCode(response: Response): Promise<string | null> {
  try {
    const payload = await response.clone().json() as JsonRecord;
    return readString(payload.intOpCode) || null;
  } catch {
    return null;
  }
}

async function isRateLimited(req: Request, userId: string | null): Promise<boolean> {
  const ipAddress = resolveClientIp(req);
  const windowStartIso = new Date(Date.now() - 60_000).toISOString();

  let query = supabase
    .from("gateway_request_logs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", windowStartIso);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (ipAddress) {
    query = query.eq("ip_address", ipAddress);
  } else {
    return false;
  }

  const { count } = await query;
  return (count ?? 0) >= MAX_REQUESTS_PER_MINUTE;
}

async function recordRequestLog(req: Request, response: Response, userId: string | null, startedAt: number): Promise<void> {
  try {
    const durationMs = Date.now() - startedAt;
    const endpoint = new URL(req.url).pathname;
    const intOpCode = await readIntOpCode(response);
    const errorMessage = response.status >= 400 ? response.statusText || "Request failed" : null;

    const logRow: GatewayRequestLogRow = {
      endpoint,
      method: req.method,
      user_id: userId,
      ip_address: resolveClientIp(req),
      status_code: response.status,
      int_op_code: intOpCode,
      duration_ms: durationMs,
      error_message: errorMessage,
    };

    await supabase.from("gateway_request_logs").insert(logRow);

    const { data: existingRows } = await supabase
      .from("endpoint_metrics")
      .select("method,endpoint,request_count,total_duration_ms,average_duration_ms")
      .eq("method", req.method)
      .eq("endpoint", endpoint)
      .limit(1);

    const existing = existingRows?.[0] as EndpointMetricRow | undefined;
    const requestCount = (existing?.request_count ?? 0) + 1;
    const totalDurationMs = (existing?.total_duration_ms ?? 0) + durationMs;
    const averageDurationMs = Number((totalDurationMs / requestCount).toFixed(2));

    await supabase.from("endpoint_metrics").upsert({
      method: req.method,
      endpoint,
      request_count: requestCount,
      total_duration_ms: totalDurationMs,
      average_duration_ms: averageDurationMs,
    }, { onConflict: "method,endpoint" });
  } catch {
    return;
  }
}

function groupRowToApp(row: JsonRecord): AppGroup {
  return {
    id: readId(row.id),
    name: readString(row.name),
    description: readString(row.description),
    llmModel: readString(row.llm_model),
    llmColor: readString(row.llm_color) || "#0d3b66",
  };
}

function userRowToBaseApp(row: JsonRecord): Omit<AppUser, "groupIds" | "permissionsByGroup"> {
  return {
    id: readId(row.id),
    name: readString(row.full_name),
    username: readString(row.username),
    email: readString(row.email).toLowerCase(),
    phone: readString(row.phone),
    birthDate: readString(row.birth_date) || "2000-01-01",
    address: readString(row.address),
    isSuperAdmin: readBoolean(row.is_super_admin),
    isActive: row.is_active !== false,
  };
}

async function getPermissionCatalog(): Promise<Map<string, string>> {
  const { data } = await supabase.from("permissions").select("id,key");
  const rows = (data ?? []) as PermissionRow[];
  return new Map(rows.map((item: PermissionRow) => [readId(item.id), readString(item.key)]));
}

async function loadAppUsers(activeOnly = true): Promise<AppUser[]> {
  let query = supabase
    .from("users")
    .select("id,full_name,username,email,phone,birth_date,address,is_super_admin,is_active")
    .order("created_at", { ascending: true });

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const [{ data: users, error: usersError }, { data: members }, { data: ugp }, permissionCatalog] = await Promise.all([
    query,
    supabase.from("group_members").select("group_id,user_id"),
    supabase.from("user_group_permissions").select("group_id,user_id,permission_id"),
    getPermissionCatalog(),
  ]);

  if (usersError) {
    throw new Error(`No se pudieron obtener usuarios: ${usersError.message}`);
  }

  const userRows = (users ?? []) as UserRow[];
  const memberRows = (members ?? []) as GroupMemberRow[];
  const permissionRows = (ugp ?? []) as UserGroupPermissionRow[];

  return userRows.map((row: UserRow) => {
    const userId = readId(row.id);
    const groupIds = [...new Set(memberRows
      .filter((item: GroupMemberRow) => readId(item.user_id) === userId)
      .map((item: GroupMemberRow) => readId(item.group_id))
      .filter(Boolean))];
    const permissionsByGroup: Record<string, string[]> = {};

    for (const groupId of groupIds) {
      const permissionKeys = permissionRows
        .filter((item: UserGroupPermissionRow) => readId(item.user_id) === userId && readId(item.group_id) === groupId)
        .map((item: UserGroupPermissionRow) => permissionCatalog.get(readId(item.permission_id)))
        .filter((item: string | undefined): item is string => Boolean(item));
      permissionsByGroup[groupId] = [...new Set(permissionKeys)];
    }

    if (readBoolean(row.is_super_admin)) {
      for (const groupId of groupIds) {
        permissionsByGroup[groupId] = [...new Set([...(permissionsByGroup[groupId] ?? []), "group:manage", "user:manage", "ticket:manage"])];
      }
    }

    return {
      ...userRowToBaseApp(row),
      groupIds,
      permissionsByGroup,
    };
  });
}

async function loadAppUserByIdentifier(identifier: string): Promise<(AppUser & { passwordHash: string }) | null> {
  const normalized = identifier.trim().toLowerCase();
  let query = supabase
    .from("users")
    .select("id,full_name,username,email,phone,birth_date,address,is_super_admin,is_active,password_hash")
    .eq("is_active", true)
    .limit(1);

  query = normalized.includes("@")
    ? query.eq("email", normalized)
    : query.eq("username", normalized);

  const { data: rows, error } = await query;
  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);
  const row = (rows?.[0] as UserRow | undefined);
  if (!row) return null;

  const allUsers = await loadAppUsers(true);
  const appUser = allUsers.find(user => user.id === readId(row.id));
  if (!appUser) return null;

  return {
    ...appUser,
    passwordHash: readString(row.password_hash),
  };
}

async function loadAppUserById(userId: string): Promise<(AppUser & { passwordHash: string }) | null> {
  const { data: rows, error } = await supabase
    .from("users")
    .select("id,full_name,username,email,phone,birth_date,address,is_super_admin,is_active,password_hash")
    .eq("id", userId)
    .eq("is_active", true)
    .limit(1);

  if (error) throw new Error(`No se pudo consultar el usuario: ${error.message}`);
  const row = (rows?.[0] as UserRow | undefined);
  if (!row) return null;

  const allUsers = await loadAppUsers(true);
  const appUser = allUsers.find(user => user.id === readId(row.id));
  if (!appUser) return null;

  return {
    ...appUser,
    passwordHash: readString(row.password_hash),
  };
}

async function requireAuthUser(req: Request): Promise<AppUser | null> {
  const token = getAuthToken(req);
  const payload = readTokenPayload(token);
  const userId = readString(payload?.sub);
  const email = readString(payload?.email);

  if (userId) {
    const user = await loadAppUserById(userId);
    if (user?.isActive) {
      return user;
    }
  }

  if (email) {
    const user = await loadAppUserByIdentifier(email);
    if (user?.isActive) {
      return user;
    }
  }

  return null;
}

async function loadGroups(): Promise<AppGroup[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id,name,description,llm_model,llm_color")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`No se pudieron obtener grupos: ${error.message}`);
  return ((data ?? []) as GroupRow[]).map((item: GroupRow) => groupRowToApp(item as JsonRecord));
}

async function loadStatuses(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase.from("ticket_statuses").select("id,name").order("sort_order", { ascending: true });
  if (error) throw new Error(`No se pudieron obtener estados: ${error.message}`);
  return ((data ?? []) as TicketCatalogRow[]).map((item: TicketCatalogRow) => ({ id: readId(item.id), name: readString(item.name) }));
}

async function loadPriorities(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase.from("ticket_priorities").select("id,name").order("sort_order", { ascending: true });
  if (error) throw new Error(`No se pudieron obtener prioridades: ${error.message}`);
  return ((data ?? []) as TicketCatalogRow[]).map((item: TicketCatalogRow) => ({ id: readId(item.id), name: readString(item.name) }));
}

async function mapTickets(rows: JsonRecord[]): Promise<AppTicket[]> {
  const [statuses, priorities, users] = await Promise.all([loadStatuses(), loadPriorities(), loadAppUsers(false)]);
  const statusById = new Map(statuses.map((item: { id: string; name: string }) => [item.id, item.name]));
  const priorityById = new Map(priorities.map((item: { id: string; name: string }) => [item.id, item.name]));
  const userById = new Map<string, AppUser>(users.map((item: AppUser) => [item.id, item]));

  return (rows as TicketRow[]).map((row: TicketRow) => ({
    id: readId(row.id),
    code: readString(row.code),
    groupId: readId(row.group_id),
    title: readString(row.title),
    description: readString(row.description),
    status: statusById.get(readId(row.status_id)) ?? "Pendiente",
    assigneeId: readId(row.assignee_id) || null,
    assigneeName: readId(row.assignee_id) ? (userById.get(readId(row.assignee_id))?.name ?? null) : null,
    createdById: readId(row.created_by),
    createdByName: userById.get(readId(row.created_by))?.name ?? "Desconocido",
    priority: priorityById.get(readId(row.priority_id)) ?? "Media",
    createdAt: readString(row.created_at),
    dueDate: readString(row.due_date),
    comments: [],
    history: [],
  }));
}

async function loadTicketRow(ticketId: string): Promise<TicketRow | null> {
  const { data, error } = await supabase.from("tickets").select("*").eq("id", ticketId).limit(1);
  if (error) throw new Error(`No se pudo obtener el ticket: ${error.message}`);
  return (data?.[0] as TicketRow | undefined) ?? null;
}

async function loadTicketDetail(ticketId: string): Promise<AppTicket | null> {
  const [{ data: ticketRows, error: ticketError }, { data: comments }, { data: history }, users] = await Promise.all([
    supabase.from("tickets").select("*").eq("id", ticketId).limit(1),
    supabase.from("ticket_comments").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    supabase.from("ticket_history").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    loadAppUsers(false),
  ]);

  if (ticketError) throw new Error(`No se pudo obtener el ticket: ${ticketError.message}`);
  const row = ticketRows?.[0] as TicketRow | undefined;
  if (!row) return null;

  const base = (await mapTickets([row as JsonRecord]))[0];
  const userById = new Map<string, string>(users.map((item: AppUser) => [item.id, item.name]));
  const commentRows = (comments ?? []) as TicketCommentRow[];
  const historyRows = (history ?? []) as TicketHistoryRow[];

  return {
    ...base,
    comments: commentRows.map((item: TicketCommentRow) => ({
      id: readId(item.id),
      authorId: readId(item.author_id),
      authorName: userById.get(readId(item.author_id)) ?? "Desconocido",
      message: readString(item.message),
      createdAt: readString(item.created_at),
    })),
    history: historyRows.map((item: TicketHistoryRow) => ({
      id: readId(item.id),
      at: readString(item.created_at),
      actorName: userById.get(readId(item.actor_id)) ?? "Desconocido",
      action: readString(item.action),
    })),
  };
}

async function syncUserMembershipsAndPermissions(userId: string, groupIds: string[], permissionsByGroup: Record<string, string[]>): Promise<void> {
  const [{ data: currentMemberships }, permissionCatalog] = await Promise.all([
    supabase.from("group_members").select("group_id,user_id").eq("user_id", userId),
    getPermissionCatalog(),
  ]);

  const currentGroupIds = ((currentMemberships ?? []) as GroupMemberRow[])
    .map((item: GroupMemberRow) => readId(item.group_id))
    .filter(Boolean);
  const targetGroupIds = [...new Set(groupIds)];
  const groupIdsToAdd = targetGroupIds.filter(groupId => !currentGroupIds.includes(groupId));
  const groupIdsToRemove = currentGroupIds.filter((groupId: string) => !targetGroupIds.includes(groupId));

  if (groupIdsToAdd.length) {
    await supabase.from("group_members").insert(groupIdsToAdd.map(groupId => ({ group_id: groupId, user_id: userId })));
  }

  for (const groupId of groupIdsToRemove) {
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
    await supabase.from("user_group_permissions").delete().eq("group_id", groupId).eq("user_id", userId);
  }

  for (const groupId of targetGroupIds) {
    await supabase.from("user_group_permissions").delete().eq("group_id", groupId).eq("user_id", userId);
    const permissionIds = [...new Set((permissionsByGroup[groupId] ?? [])
      .map(key => [...permissionCatalog.entries()].find(([, permissionKey]) => permissionKey === key)?.[0])
      .filter((item): item is string => Boolean(item)))];

    if (permissionIds.length) {
      await supabase.from("user_group_permissions").insert(permissionIds.map(permissionId => ({
        group_id: groupId,
        user_id: userId,
        permission_id: permissionId,
      })));
    }
  }
}

async function handleLogin(req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const identifier = readString(payload.identifier) || readString(payload.email);
  const password = readString(payload.password);
  if (!identifier || !password) {
    return jsonResponse(400, 0, null, "identifier/email y password son obligatorios");
  }

  const user = await loadAppUserByIdentifier(identifier);
  const isValidPassword = user ? await isPasswordMatch(user.passwordHash, password) : false;
  if (!isValidPassword) {
    return jsonResponse(401, 0, null, "Credenciales invalidas");
  }
  if (!user) {
    return jsonResponse(401, 0, null, "Credenciales invalidas");
  }

  await ensureStoredPasswordIsHashed(user.id, user.passwordHash);

  return jsonResponse(200, 1, {
    token: buildToken(user),
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      birthDate: user.birthDate,
      address: user.address,
      isSuperAdmin: user.isSuperAdmin,
      groupIds: user.groupIds,
      permissionsByGroup: user.permissionsByGroup,
    },
  }, "Login correcto");
}

async function handleRegister(req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const email = readString(payload.email).toLowerCase();
  const password = readString(payload.password);
  const name = readString(payload.name);
  const username = readString(payload.username) || email.split("@")[0];
  if (!validateEmail(email) || !password || !name) {
    return jsonResponse(400, 0, null, "email, password y name son obligatorios y deben ser validos");
  }

  const existing = await loadAppUsers(false);
  if (existing.some(user => user.email === email || user.username.toLowerCase() === username.toLowerCase())) {
    return jsonResponse(409, 0, null, "El usuario ya existe (email o username)");
  }

  const hashedPassword = await hashPassword(password);

  const { data: createdRows, error } = await supabase
    .from("users")
    .insert({
      full_name: name,
      username,
      email,
      password_hash: hashedPassword,
      phone: readString(payload.phone),
      birth_date: readString(payload.birthDate) || "2000-01-01",
      address: readString(payload.address),
      is_super_admin: false,
      is_active: true,
    })
    .select("id,full_name,username,email,is_super_admin,is_active")
    .limit(1);

  if (error || !createdRows?.length) {
    return jsonResponse(500, 0, null, `No se pudo registrar usuario: ${error?.message ?? "error desconocido"}`);
  }

  const created = createdRows[0] as UserRow;
  return jsonResponse(201, 1, {
    id: readId(created.id),
    name: readString(created.full_name),
    username: readString(created.username),
    email: readString(created.email),
    isSuperAdmin: readBoolean(created.is_super_admin),
    isActive: created.is_active !== false,
  }, "Usuario registrado correctamente");
}

async function handleGetPermissions(): Promise<Response> {
  const { data, error } = await supabase.from("permissions").select("key").order("key", { ascending: true });
  if (error) return jsonResponse(500, 0, null, `No se pudieron obtener permisos: ${error.message}`);
  return jsonResponse(200, 1, ((data ?? []) as PermissionRow[]).map((item: PermissionRow) => readString(item.key)));
}

async function handleGetStatuses(): Promise<Response> {
  return jsonResponse(200, 1, (await loadStatuses()).map(item => item.name));
}

async function handleGetPriorities(): Promise<Response> {
  return jsonResponse(200, 1, (await loadPriorities()).map(item => item.name));
}

async function handleGetGroups(authUser: AppUser): Promise<Response> {
  const groups = await loadGroups();
  const visibleGroups = authUser.isSuperAdmin
    ? groups
    : groups.filter(group => authUser.groupIds.includes(group.id));
  return jsonResponse(200, 1, visibleGroups);
}

async function handleGetGroup(authUser: AppUser, groupId: string): Promise<Response> {
  const groups = await loadGroups();
  const group = groups.find(item => item.id === groupId) ?? null;
  if (!group) return jsonResponse(404, 0, null, "Grupo no encontrado");
  if (!authUser.isSuperAdmin && !authUser.groupIds.includes(groupId)) {
    return jsonResponse(403, 0, null, "No autorizado para ver este grupo");
  }
  return jsonResponse(200, 1, group);
}

async function handleGetGroupTicketSummary(authUser: AppUser, groupId: string): Promise<Response> {
  if (!authUser.isSuperAdmin && !authUser.groupIds.includes(groupId)) {
    return jsonResponse(403, 0, null, 'No autorizado para ver el resumen de tickets del grupo');
  }

  const { data, error } = await supabase.from('tickets').select('*').eq('group_id', groupId);
  if (error) {
    return jsonResponse(500, 0, null, `No se pudo obtener el resumen de tickets: ${error.message}`);
  }

  const tickets = await mapTickets((data ?? []) as JsonRecord[]);
  const summary: GroupTicketSummary = {
    groupId,
    total: tickets.length,
    byStatus: {},
    byPriority: {},
  };

  for (const ticket of tickets) {
    summary.byStatus[ticket.status] = (summary.byStatus[ticket.status] ?? 0) + 1;
    summary.byPriority[ticket.priority] = (summary.byPriority[ticket.priority] ?? 0) + 1;
  }

  return jsonResponse(200, 1, summary);
}

async function handleCreateGroup(authUser: AppUser, req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: readString(payload.name),
      description: readString(payload.description),
      llm_model: readString(payload.llmModel),
      llm_color: readString(payload.llmColor) || "#0d3b66",
      created_by: authUser.id,
      is_active: true,
    })
    .select("id,name,description,llm_model,llm_color")
    .limit(1);

  if (error || !data?.length) return jsonResponse(500, 0, null, `No se pudo crear grupo: ${error?.message ?? "error desconocido"}`);
  return jsonResponse(201, 1, groupRowToApp(data[0]), "Grupo creado correctamente");
}

async function handleUpdateGroup(groupId: string, req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const patch = {
    name: readString(payload.name) || undefined,
    description: readString(payload.description) || undefined,
    llm_model: readString(payload.llmModel) || undefined,
    llm_color: readString(payload.llmColor) || undefined,
  };

  const { data, error } = await supabase
    .from("groups")
    .update(patch)
    .eq("id", groupId)
    .select("id,name,description,llm_model,llm_color")
    .limit(1);

  if (error || !data?.length) return jsonResponse(500, 0, null, `No se pudo actualizar grupo: ${error?.message ?? "error desconocido"}`);
  return jsonResponse(200, 1, groupRowToApp(data[0]), "Grupo actualizado correctamente");
}

async function handleDeleteGroup(groupId: string): Promise<Response> {
  const { error } = await supabase.from("groups").update({ is_active: false }).eq("id", groupId);
  if (error) return jsonResponse(500, 0, null, `No se pudo eliminar grupo: ${error.message}`);
  return jsonResponse(200, 1, { id: groupId }, "Grupo eliminado correctamente");
}

async function handleGetGroupUsers(authUser: AppUser, groupId: string): Promise<Response> {
  if (!authUser.isSuperAdmin && !authUser.groupIds.includes(groupId)) {
    return jsonResponse(403, 0, null, "No autorizado para ver miembros de este grupo");
  }
  const users = await loadAppUsers(true);
  return jsonResponse(200, 1, users.filter(user => user.groupIds.includes(groupId)));
}

async function handleAddGroupUser(groupId: string, req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");
  const userId = readString(payload.userId);
  if (!userId) return jsonResponse(400, 0, null, "userId es obligatorio");

  const { data: existingRows, error: existingError } = await supabase
    .from("group_members")
    .select("group_id,user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .limit(1);

  if (existingError) {
    return jsonResponse(500, 0, null, `No se pudo validar el miembro: ${existingError.message}`);
  }

  if (existingRows?.length) {
    return jsonResponse(200, 1, { groupId, userId }, "El usuario ya era miembro del grupo");
  }

  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error) return jsonResponse(500, 0, null, `No se pudo agregar el miembro: ${error.message}`);
  return jsonResponse(201, 1, { groupId, userId }, "Miembro agregado correctamente");
}

async function handleRemoveGroupUser(groupId: string, userId: string): Promise<Response> {
  await supabase.from("user_group_permissions").delete().eq("group_id", groupId).eq("user_id", userId);
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) return jsonResponse(500, 0, null, `No se pudo remover el miembro: ${error.message}`);
  return jsonResponse(200, 1, { groupId, userId }, "Miembro removido correctamente");
}

async function handleGetUsers(authUser: AppUser): Promise<Response> {
  const users = await loadAppUsers(true);
  if (authUser.isSuperAdmin || hasAnyPermission(authUser, ["user:manage", "user:view:all"])) {
    return jsonResponse(200, 1, users);
  }

  const visibleUsers = users.filter(user => user.groupIds.some(groupId => authUser.groupIds.includes(groupId)));
  return jsonResponse(200, 1, visibleUsers);
}

async function handleCreateUser(req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const email = readString(payload.email).toLowerCase();
  const username = readString(payload.username);
  const name = readString(payload.name);
  const password = readString(payload.password);
  if (!validateEmail(email) || !username || !name || !password) {
    return jsonResponse(400, 0, null, "name, username, email y password son obligatorios");
  }

  const existing = await loadAppUsers(false);
  if (existing.some(user => user.email === email || user.username.toLowerCase() === username.toLowerCase())) {
    return jsonResponse(409, 0, null, "El usuario ya existe (email o username)");
  }

  const hashedPassword = await hashPassword(password);

  const { data, error } = await supabase
    .from("users")
    .insert({
      full_name: name,
      username,
      email,
      password_hash: hashedPassword,
      phone: readString(payload.phone),
      birth_date: readString(payload.birthDate) || "2000-01-01",
      address: readString(payload.address),
      is_super_admin: readBoolean(payload.isSuperAdmin),
      is_active: true,
    })
    .select("id")
    .limit(1);

  if (error || !data?.length) {
    return jsonResponse(500, 0, null, `No se pudo crear usuario: ${error?.message ?? "error desconocido"}`);
  }

  const userId = String(data[0].id);
  await syncUserMembershipsAndPermissions(userId, uniqueStrings(payload.groupIds), readStringArrayRecord(payload.permissionsByGroup));
  const users = await loadAppUsers(true);
  return jsonResponse(201, 1, users.find(user => user.id === userId) ?? null, "Usuario creado correctamente");
}

async function handleUpdateUser(authUser: AppUser, userId: string, req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const isSelf = authUser.id === userId;

  const patch: JsonRecord = {
    full_name: readString(payload.name) || undefined,
    username: readString(payload.username) || undefined,
    email: readString(payload.email).toLowerCase() || undefined,
    phone: readString(payload.phone) || undefined,
    birth_date: readString(payload.birthDate) || undefined,
    address: readString(payload.address) || undefined,
  };

  if (!isSelf) {
    patch.is_super_admin = payload.isSuperAdmin === undefined ? undefined : readBoolean(payload.isSuperAdmin);
  }

  const password = readString(payload.password);
  if (password) patch["password_hash"] = await hashPassword(password);

  const { error } = await supabase.from("users").update(patch).eq("id", userId);
  if (error) return jsonResponse(500, 0, null, `No se pudo actualizar usuario: ${error.message}`);

  if (!isSelf) {
    await syncUserMembershipsAndPermissions(userId, uniqueStrings(payload.groupIds), readStringArrayRecord(payload.permissionsByGroup));
  }

  const users = await loadAppUsers(true);
  return jsonResponse(200, 1, users.find(user => user.id === userId) ?? null, "Usuario actualizado correctamente");
}

async function handleDeleteUser(userId: string): Promise<Response> {
  const { error } = await supabase.from("users").update({ is_active: false }).eq("id", userId);
  if (error) return jsonResponse(500, 0, null, `No se pudo eliminar usuario: ${error.message}`);
  return jsonResponse(200, 1, { id: userId }, "Usuario eliminado correctamente");
}

async function handleGetTickets(authUser: AppUser, req: Request): Promise<Response> {
  const groupId = new URL(req.url).searchParams.get("groupId");
  let query = supabase.from("tickets").select("*").order("created_at", { ascending: false });
  if (groupId) {
    query = query.eq("group_id", groupId);
  } else if (!authUser.isSuperAdmin) {
    query = query.in("group_id", authUser.groupIds);
  }
  const { data, error } = await query;
  if (error) return jsonResponse(500, 0, null, `No se pudieron obtener tickets: ${error.message}`);
  return jsonResponse(200, 1, await mapTickets((data ?? []) as JsonRecord[]));
}

async function handleGetTicket(authUser: AppUser, ticketId: string): Promise<Response> {
  const ticket = await loadTicketDetail(ticketId);
  if (!ticket) {
    return jsonResponse(404, 0, null, "Ticket no encontrado");
  }
  if (!authUser.isSuperAdmin && !authUser.groupIds.includes(ticket.groupId)) {
    return jsonResponse(403, 0, null, "No autorizado para ver este ticket");
  }
  return jsonResponse(200, 1, ticket);
}

async function handleCreateTicket(req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const statuses = await loadStatuses();
  const priorities = await loadPriorities();
  const statusId = statuses.find(item => item.name === readString(payload.status))?.id;
  const priorityId = priorities.find(item => item.name === readString(payload.priority))?.id;
  if (!statusId || !priorityId) return jsonResponse(400, 0, null, "status o priority invalidos");

  const code = `TK-${Math.floor(Math.random() * 90000) + 10000}`;
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      code,
      group_id: readString(payload.groupId),
      title: readString(payload.title),
      description: readString(payload.description),
      created_by: readString(payload.createdBy),
      assignee_id: readString(payload.assigneeId) || null,
      status_id: statusId,
      priority_id: priorityId,
      due_date: readString(payload.dueDate) || null,
    })
    .select("id")
    .limit(1);

  if (error || !data?.length) return jsonResponse(500, 0, null, `No se pudo crear ticket: ${error?.message ?? "error desconocido"}`);

  const ticketId = String(data[0].id);
  const actorId = readString(payload.createdBy);
  if (actorId) {
    await supabase.from("ticket_history").insert({ ticket_id: ticketId, actor_id: actorId, action: "Ticket creado" });
  }

  return jsonResponse(201, 1, await loadTicketDetail(ticketId), "Ticket creado correctamente");
}

async function handleUpdateTicket(ticketId: string, req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");

  const statuses = await loadStatuses();
  const priorities = await loadPriorities();
  const patch: JsonRecord = {};
  const title = readString(payload.title);
  const description = readString(payload.description);
  const dueDate = readString(payload.dueDate);
  const assigneeId = readString(payload.assigneeId);
  const status = readString(payload.status);
  const priority = readString(payload.priority);

  if (title) patch["title"] = title;
  if (description || payload.description === "") patch["description"] = description;
  if (dueDate || payload.dueDate === "") patch["due_date"] = dueDate || null;
  if (payload.assigneeId !== undefined) patch["assignee_id"] = assigneeId || null;

  if (status) {
    const statusId = statuses.find(item => item.name === status)?.id;
    if (!statusId) return jsonResponse(400, 0, null, "status invalido");
    patch["status_id"] = statusId;
    if (status === "Hecho") patch["closed_at"] = new Date().toISOString();
  }

  if (priority) {
    const priorityId = priorities.find(item => item.name === priority)?.id;
    if (!priorityId) return jsonResponse(400, 0, null, "priority invalida");
    patch["priority_id"] = priorityId;
  }

  const { error } = await supabase.from("tickets").update(patch).eq("id", ticketId);
  if (error) return jsonResponse(500, 0, null, `No se pudo actualizar ticket: ${error.message}`);

  const actorId = readString(payload.actorId);
  const action = readString(payload.action) || "Ticket actualizado";
  if (actorId) {
    await supabase.from("ticket_history").insert({ ticket_id: ticketId, actor_id: actorId, action });
  }

  return jsonResponse(200, 1, await loadTicketDetail(ticketId), "Ticket actualizado correctamente");
}

async function handleDeleteTicket(ticketId: string): Promise<Response> {
  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
  if (error) return jsonResponse(500, 0, null, `No se pudo eliminar ticket: ${error.message}`);
  return jsonResponse(200, 1, { id: ticketId }, "Ticket eliminado correctamente");
}

async function handleAddTicketComment(ticketId: string, req: Request): Promise<Response> {
  const payload = await parseBody(req);
  if (!payload) return jsonResponse(400, 0, null, "Body JSON invalido");
  const authorId = readString(payload.authorId);
  const message = readString(payload.message);
  if (!authorId || !message) return jsonResponse(400, 0, null, "authorId y message son obligatorios");

  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: authorId,
    message,
  });

  if (error) return jsonResponse(500, 0, null, `No se pudo agregar comentario: ${error.message}`);
  await supabase.from("ticket_history").insert({ ticket_id: ticketId, actor_id: authorId, action: "Comentario agregado" });
  return jsonResponse(201, 1, await loadTicketDetail(ticketId), "Comentario agregado correctamente");
}

function handleGatewayRoot(): Response {
  return jsonResponse(200, 1, {
    service: FUNCTION_NAME,
    routes: [
      "POST /login",
      "POST /auth/login",
      "POST /register",
      "POST /auth/register",
      "GET /permissions",
      "GET /catalogs/ticket-statuses",
      "GET /catalogs/ticket-priorities",
      "GET|POST /groups",
      "GET|PATCH|DELETE /groups/:groupId",
      "GET|POST /groups/:groupId/users",
      "DELETE /groups/:groupId/users/:userId",
      "GET|POST /users",
      "PATCH|DELETE /users/:userId",
      "GET|POST /tickets",
      "GET|PATCH|DELETE /tickets/:ticketId",
      "PATCH /tickets/:ticketId/status",
      "POST /tickets/:ticketId/comments",
    ],
  }, "Gateway listo para Postman");
}

function unauthorizedResponse(): Response {
  return jsonResponse(401, 0, null, "Token de autenticacion invalido o ausente");
}

function tooManyRequestsResponse(): Response {
  return jsonResponse(429, "SxGW429", null, "Too many requests");
}

function forbiddenResponse(message: string): Response {
  return jsonResponse(403, 0, null, message);
}

function authorizeCatalogsRequest(authUser: AppUser): Response | null {
  return hasAnyPermission(authUser, ["ticket:view", "ticket:manage"])
    ? null
    : forbiddenResponse("No autorizado para consultar catalogos de tickets");
}

function authorizeGroupCollectionRequest(authUser: AppUser, req: Request): Response | null {
  if (req.method === "GET") return null;
  if (req.method === "POST" && hasAnyPermission(authUser, ["group:add", "group:manage"])) return null;
  return forbiddenResponse("No autorizado para administrar grupos");
}

function authorizeGroupDetailRequest(authUser: AppUser, groupId: string, req: Request): Response | null {
  if (req.method === "GET") return null;
  if (req.method === "PATCH" && hasAnyPermission(authUser, ["group:edit", "group:manage"], groupId)) return null;
  if (req.method === "DELETE" && hasAnyPermission(authUser, ["group:delete", "group:manage"], groupId)) return null;
  return forbiddenResponse("No autorizado para modificar este grupo");
}

function authorizeGroupUsersRequest(authUser: AppUser, groupId: string, req: Request): Response | null {
  if (req.method === "GET") {
    return hasAnyPermission(authUser, ["group:view", "group:manage"], groupId)
      ? null
      : forbiddenResponse("No autorizado para ver miembros de este grupo");
  }

  if (req.method === "POST") {
    return hasAnyPermission(authUser, ["group:add:member", "group:manage"], groupId)
      ? null
      : forbiddenResponse("No autorizado para agregar miembros");
  }

  if (req.method === "DELETE") {
    return hasAnyPermission(authUser, ["group:remove:member", "group:manage"], groupId)
      ? null
      : forbiddenResponse("No autorizado para remover miembros");
  }

  return null;
}

function authorizeGroupsRequest(authUser: AppUser, resourceId: string | undefined, childResource: string | undefined, req: Request): Response | null {
  if (!resourceId) return authorizeGroupCollectionRequest(authUser, req);
  if (!childResource) return authorizeGroupDetailRequest(authUser, resourceId, req);
  if (childResource === "users") return authorizeGroupUsersRequest(authUser, resourceId, req);
  return null;
}

function authorizeUsersRequest(authUser: AppUser, resourceId: string | undefined, req: Request): Response | null {
  if (!resourceId) {
    if (req.method === "GET" && hasAnyPermission(authUser, ["user:view", "user:view:all", "user:manage"])) return null;
    if (req.method === "POST" && hasAnyPermission(authUser, ["user:add", "user:manage"])) return null;
    return forbiddenResponse("No autorizado para administrar usuarios");
  }

  if (req.method === "PATCH" && resourceId === authUser.id) return null;
  if (req.method === "PATCH" && hasAnyPermission(authUser, ["user:edit", "user:edit:profile", "user:manage"])) return null;
  if (req.method === "DELETE" && hasAnyPermission(authUser, ["user:delete", "user:manage"])) return null;
  return forbiddenResponse("No autorizado para modificar usuarios");
}

async function authorizeTicketCollectionRequest(authUser: AppUser, req: Request, requestBody: JsonRecord | null): Promise<Response | null> {
  const requestedGroupId = new URL(req.url).searchParams.get("groupId") || readString(requestBody?.groupId) || null;
  if (req.method === "GET" && hasAnyPermission(authUser, ["ticket:view", "ticket:manage"], requestedGroupId)) return null;
  if (req.method === "POST" && hasAnyPermission(authUser, ["ticket:add", "ticket:manage"], requestedGroupId)) return null;
  return forbiddenResponse("No autorizado para operar tickets");
}

function authorizeTicketReadOrDelete(authUser: AppUser, req: Request, ticketGroupId: string | null): Response | "skip" | null {
  if (req.method === "GET") {
    return hasAnyPermission(authUser, ["ticket:view", "ticket:manage"], ticketGroupId)
      ? null
      : forbiddenResponse("No autorizado para ver este ticket");
  }

  if (req.method === "DELETE") {
    return hasAnyPermission(authUser, ["ticket:delete", "ticket:manage"], ticketGroupId)
      ? null
      : forbiddenResponse("No autorizado para eliminar este ticket");
  }

  return "skip";
}

function authorizeTicketCommentRequest(authUser: AppUser, ticketGroupId: string | null): Response | null {
  return hasAnyPermission(authUser, ["ticket:edit:comment", "ticket:manage"], ticketGroupId)
    ? null
    : forbiddenResponse("No autorizado para comentar este ticket");
}

function authorizeTicketStatusChange(authUser: AppUser, ticketRow: TicketRow | null, ticketGroupId: string | null, requestBody: JsonRecord | null): Response | null {
  const nextStatus = readString(requestBody?.status);
  if (!nextStatus) return null;

  const canMove = hasAnyPermission(authUser, ["ticket:edit:state", "ticket:manage"], ticketGroupId);
  const isAssignedToCurrentUser = authUser.isSuperAdmin || readId(ticketRow?.assignee_id) === authUser.id;
  if (canMove && isAssignedToCurrentUser) return null;

  return forbiddenResponse("No autorizado para mover el estado de este ticket");
}

function authorizeTicketPatchRequest(
  authUser: AppUser,
  ticketRow: TicketRow | null,
  ticketGroupId: string | null,
  requestBody: JsonRecord | null,
  childResource?: string,
): Response | null {
  const statusChangeResponse = authorizeTicketStatusChange(authUser, ticketRow, ticketGroupId, requestBody);
  if (statusChangeResponse) return statusChangeResponse;

  const isStatusOnlyPatch = Object.keys(requestBody ?? {}).every(key => ["status", "actorId", "action"].includes(key));

  if (childResource === "status" || isStatusOnlyPatch) {
    return null;
  }

  return hasAnyPermission(authUser, ["ticket:edit", "ticket:manage"], ticketGroupId)
    ? null
    : forbiddenResponse("No autorizado para editar este ticket");
}

async function authorizeTicketDetailRequest(
  authUser: AppUser,
  ticketId: string,
  childResource: string | undefined,
  req: Request,
  requestBody: JsonRecord | null,
): Promise<Response | null> {
  const ticketRow = await loadTicketRow(ticketId);
  const ticketGroupId = readId(ticketRow?.group_id) || null;
  const readOrDeleteResponse = authorizeTicketReadOrDelete(authUser, req, ticketGroupId);
  if (readOrDeleteResponse !== "skip") return readOrDeleteResponse;

  if (childResource === "comments" && req.method === "POST") return authorizeTicketCommentRequest(authUser, ticketGroupId);
  if (req.method === "PATCH") return authorizeTicketPatchRequest(authUser, ticketRow, ticketGroupId, requestBody, childResource);

  return null;
}

async function authorizeTicketsRequest(
  authUser: AppUser,
  resourceId: string | undefined,
  childResource: string | undefined,
  req: Request,
): Promise<Response | null> {
  const requestBody = ["POST", "PATCH"].includes(req.method) ? await parseBody(req.clone()) : null;

  if (!resourceId) {
    return authorizeTicketCollectionRequest(authUser, req, requestBody);
  }

  return authorizeTicketDetailRequest(authUser, resourceId, childResource, req, requestBody);
}

async function authorizeRequest(
  authUser: AppUser,
  resource: string,
  resourceId: string | undefined,
  childResource: string | undefined,
  req: Request,
): Promise<Response | null> {
  if (resource === "catalogs") return authorizeCatalogsRequest(authUser);
  if (resource === "groups") return authorizeGroupsRequest(authUser, resourceId, childResource, req);
  if (resource === "users") return authorizeUsersRequest(authUser, resourceId, req);
  if (resource === "tickets") return authorizeTicketsRequest(authUser, resourceId, childResource, req);

  return null;
}

async function routeCatalogRequest(resourceId: string | undefined, req: Request): Promise<Response | null> {
  if (req.method !== "GET") return null;
  if (resourceId === "ticket-statuses") return handleGetStatuses();
  if (resourceId === "ticket-priorities") return handleGetPriorities();
  return null;
}

async function routeGroupUsersRequest(authUser: AppUser, groupId: string, childId: string | undefined, req: Request): Promise<Response | null> {
  if (req.method === "GET" && !childId) return handleGetGroupUsers(authUser, groupId);
  if (req.method === "POST" && !childId) return handleAddGroupUser(groupId, req);
  if (req.method === "DELETE" && childId) return handleRemoveGroupUser(groupId, childId);
  return null;
}

async function routeGroupRequest(authUser: AppUser, resourceId: string | undefined, childResource: string | undefined, childId: string | undefined, req: Request): Promise<Response | null> {
  if (!resourceId) {
    if (req.method === "GET") return handleGetGroups(authUser);
    if (req.method === "POST") return handleCreateGroup(authUser, req);
    return null;
  }

  if (!childResource) {
    if (req.method === "GET") return handleGetGroup(authUser, resourceId);
    if (req.method === "PATCH") return handleUpdateGroup(resourceId, req);
    if (req.method === "DELETE") return handleDeleteGroup(resourceId);
    return null;
  }

  if (childResource === 'ticket-summary' && req.method === 'GET') {
    return handleGetGroupTicketSummary(authUser, resourceId);
  }

  if (childResource !== "users") return null;
  return routeGroupUsersRequest(authUser, resourceId, childId, req);
}

async function routeUserRequest(authUser: AppUser, resourceId: string | undefined, req: Request): Promise<Response | null> {
  if (!resourceId) {
    if (req.method === "GET") return handleGetUsers(authUser);
    if (req.method === "POST") return handleCreateUser(req);
    return null;
  }

  if (req.method === "PATCH") return handleUpdateUser(authUser, resourceId, req);
  if (req.method === "DELETE") return handleDeleteUser(resourceId);
  return null;
}

function routeTicketCollectionRequest(authUser: AppUser, req: Request): Promise<Response | null> | Response | null {
  if (req.method === "GET") return handleGetTickets(authUser, req);
  if (req.method === "POST") return handleCreateTicket(req);
  return null;
}

function routeTicketDetailRequest(resourceId: string, childResource: string | undefined, req: Request): Promise<Response | null> | Response | null {
  if (!childResource) {
    if (req.method === "GET") return handleGetTicket(undefined as never, resourceId);
    if (req.method === "PATCH") return handleUpdateTicket(resourceId, req);
    if (req.method === "DELETE") return handleDeleteTicket(resourceId);
    return null;
  }

  if (childResource === "comments" && req.method === "POST") return handleAddTicketComment(resourceId, req);
  if (childResource === "status" && req.method === "PATCH") return handleUpdateTicket(resourceId, req);
  return null;
}

async function routeTicketRequest(authUser: AppUser, resourceId: string | undefined, childResource: string | undefined, req: Request): Promise<Response | null> {
  if (!resourceId) {
    return await routeTicketCollectionRequest(authUser, req);
  }

  if (!childResource && req.method === "GET") return handleGetTicket(authUser, resourceId);
  return await routeTicketDetailRequest(resourceId, childResource, req);
}

function routePublicRequest(resource: string, resourceId: string | undefined, req: Request): Response | null {
  if (resource === "login" && req.method === "POST") return null;
  if (resource === "register" && req.method === "POST") return null;
  if (resource === "auth" && resourceId === "login" && req.method === "POST") return null;
  if (resource === "auth" && resourceId === "register" && req.method === "POST") return null;
  if (resource === "permissions" && req.method === "GET") return null;
  return jsonResponse(404, 0, null, "Ruta no soportada");
}

async function resolveProtectedRoute(
  authUser: AppUser,
  resource: string,
  resourceId: string | undefined,
  childResource: string | undefined,
  childId: string | undefined,
  req: Request,
): Promise<Response> {
  if (resource === "catalogs") {
    return (await routeCatalogRequest(resourceId, req)) ?? jsonResponse(404, 0, null, "Ruta no soportada");
  }

  if (resource === "groups") {
    return (await routeGroupRequest(authUser, resourceId, childResource, childId, req)) ?? jsonResponse(404, 0, null, "Ruta no soportada");
  }

  if (resource === "users") {
    return (await routeUserRequest(authUser, resourceId, req)) ?? jsonResponse(404, 0, null, "Ruta no soportada");
  }

  if (resource === "tickets") {
    return (await routeTicketRequest(authUser, resourceId, childResource, req)) ?? jsonResponse(404, 0, null, "Ruta no soportada");
  }

  return jsonResponse(404, 0, null, "Ruta no soportada");
}

async function handleRequest(req: Request): Promise<Response> {
  const [resource, resourceId, childResource, childId] = getRouteSegments(req);

  if (!resource) return handleGatewayRoot();
  const publicResponse = routePublicRequest(resource, resourceId, req);
  if (publicResponse === null) {
    if (resource === "permissions") return handleGetPermissions();
    if (resource === "login" || resourceId === "login") return handleLogin(req);
    return handleRegister(req);
  }
  if (publicResponse.status === 404 && !["catalogs", "groups", "users", "tickets"].includes(resource)) {
    return publicResponse;
  }

  const authUser = await requireAuthUser(req);
  if (!authUser) {
    return unauthorizedResponse();
  }

  const authError = await authorizeRequest(authUser, resource, resourceId, childResource, req);
  if (authError) {
    return authError;
  }
  return resolveProtectedRoute(authUser, resource, resourceId, childResource, childId, req);
}

runtime.Deno.serve(async (req: Request) => {
  const startedAt = Date.now();
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, 0, null, "Faltan variables APP_SUPABASE_URL/SUPABASE_URL o APP_SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY");
  }

  const payload = readTokenPayload(getAuthToken(req));
  const userId = readString(payload?.sub) || null;

  try {
    if (await isRateLimited(req, userId)) {
      const response = tooManyRequestsResponse();
      await recordRequestLog(req, response, userId, startedAt);
      return response;
    }

    const response = await handleRequest(req);
    await recordRequestLog(req, response, userId, startedAt);
    return response;
  } catch (error) {
    const response = jsonResponse(500, 0, null, error instanceof Error ? error.message : "Error interno");
    await recordRequestLog(req, response, userId, startedAt);
    return response;
  }
});
