import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PermissionKey = string;

type JsonSchemaProperty = {
  type: "string" | "boolean" | "array" | "object";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "email";
  items?: { type: "string" };
  additionalProperties?: { type: "array"; items?: { type: "string" } } | boolean;
};

type JsonSchema = {
  $schema: string;
  title: string;
  type: "object";
  required: string[];
  additionalProperties: boolean;
  properties: Record<string, JsonSchemaProperty>;
};

type UsersApiEnvelope<T> = {
  statusCode: number;
  intOpCode: number;
  data: T | null;
  message?: string;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const loginSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "LoginRequest",
  type: "object",
  required: ["email", "password"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", minLength: 5, maxLength: 120 },
    password: { type: "string", minLength: 8, maxLength: 120 },
  },
};

const registerSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "RegisterRequest",
  type: "object",
  required: ["email", "password", "name"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", minLength: 5, maxLength: 120 },
    password: { type: "string", minLength: 10, maxLength: 120, pattern: "^(?=.*[!@#$%^&*])\\S+$" },
    name: { type: "string", minLength: 2, maxLength: 120 },
    username: { type: "string", minLength: 3, maxLength: 50, pattern: "^[a-zA-Z0-9._-]+$" },
    phone: { type: "string", minLength: 10, maxLength: 20 },
    birthDate: { type: "string", minLength: 10, maxLength: 10 },
    address: { type: "string", minLength: 3, maxLength: 200 },
  },
};

const addUserSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "AddUserRequest",
  type: "object",
  required: ["email", "password", "name"],
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", minLength: 5, maxLength: 120 },
    password: { type: "string", minLength: 10, maxLength: 120, pattern: "^(?=.*[!@#$%^&*])\\S+$" },
    name: { type: "string", minLength: 2, maxLength: 120 },
    username: { type: "string", minLength: 3, maxLength: 50, pattern: "^[a-zA-Z0-9._-]+$" },
    phone: { type: "string", minLength: 10, maxLength: 20 },
    birthDate: { type: "string", minLength: 10, maxLength: 10 },
    address: { type: "string", minLength: 3, maxLength: 200 },
    isSuperAdmin: { type: "boolean" },
    groupIds: { type: "array", items: { type: "string" } },
    permissionsByGroup: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
    requesterPermissions: { type: "array", items: { type: "string" } },
    requesterIsSuperAdmin: { type: "boolean" },
  },
};

function jsonResponse<T>(statusCode: number, intOpCode: number, data: T | null, message?: string): Response {
  const payload: UsersApiEnvelope<T> = { statusCode, intOpCode, data, message };
  return new Response(JSON.stringify(payload), { status: statusCode, headers: CORS_HEADERS });
}

function parseRoute(req: Request): "login" | "register" | "users" | "permissions" | "unknown" {
  const pathname = new URL(req.url).pathname.replace(/\/+$/, "");
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";

  if (last === "login") return "login";
  if (last === "register") return "register";
  if (last === "users") return "users";
  if (last === "permissions") return "permissions";
  return "unknown";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validateEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function validatePayload(schema: JsonSchema, payload: Record<string, unknown>): string[] {
  const errors: string[] = [];

  for (const key of schema.required) {
    if (!(key in payload)) {
      errors.push(`Campo requerido faltante: ${key}`);
    }
  }

  if (!schema.additionalProperties) {
    for (const key of Object.keys(payload)) {
      if (!schema.properties[key]) {
        errors.push(`Campo no permitido: ${key}`);
      }
    }
  }

  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = payload[key];
    if (value === undefined || value === null) continue;

    if (prop.type === "string") {
      if (typeof value !== "string") {
        errors.push(`${key} debe ser string`);
        continue;
      }
      if (prop.minLength !== undefined && value.length < prop.minLength) {
        errors.push(`${key} requiere al menos ${prop.minLength} caracteres`);
      }
      if (prop.maxLength !== undefined && value.length > prop.maxLength) {
        errors.push(`${key} excede ${prop.maxLength} caracteres`);
      }
      if (prop.format === "email" && !validateEmail(value)) {
        errors.push(`${key} no tiene formato email valido`);
      }
      if (prop.pattern && !(new RegExp(prop.pattern).test(value))) {
        errors.push(`${key} no cumple el patron requerido`);
      }
    }

    if (prop.type === "boolean" && typeof value !== "boolean") {
      errors.push(`${key} debe ser boolean`);
    }

    if (prop.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`${key} debe ser array`);
      } else if (prop.items?.type === "string" && value.some(item => typeof item !== "string")) {
        errors.push(`${key} debe contener solo strings`);
      }
    }

    if (prop.type === "object") {
      const obj = asRecord(value);
      if (!obj) {
        errors.push(`${key} debe ser object`);
      } else if (prop.additionalProperties && typeof prop.additionalProperties === "object") {
        for (const [nestedKey, nestedValue] of Object.entries(obj)) {
          if (!Array.isArray(nestedValue)) {
            errors.push(`${key}.${nestedKey} debe ser array`);
            continue;
          }
          if (nestedValue.some(item => typeof item !== "string")) {
            errors.push(`${key}.${nestedKey} debe contener solo strings`);
          }
        }
      }
    }
  }

  return errors;
}

function buildToken(userId: string, email: string, permissions: string[]): string {
  const payload = {
    sub: userId,
    email,
    permissions,
    iat: Date.now(),
  };
  return btoa(JSON.stringify(payload));
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function handleLogin(payload: Record<string, unknown>): Promise<Response> {
  const errors = validatePayload(loginSchema, payload);
  if (errors.length > 0) {
    return jsonResponse(400, 0, null, errors.join(" | "));
  }

  const email = String(payload.email).trim().toLowerCase();
  const password = String(payload.password);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id,full_name,username,email,password_hash,is_super_admin,is_active")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (userError) return jsonResponse(500, 0, null, `Error consultando usuario: ${userError.message}`);
  if (!user || !user.is_active || user.password_hash !== password) {
    return jsonResponse(401, 0, null, "Credenciales invalidas");
  }

  const [{ data: memberships }, { data: ugp }, { data: permissionsCatalog }] = await Promise.all([
    supabase.from("group_members").select("group_id").eq("user_id", user.id),
    supabase.from("user_group_permissions").select("group_id,permission_id").eq("user_id", user.id),
    supabase.from("permissions").select("id,key"),
  ]);

  const permById = new Map((permissionsCatalog ?? []).map(item => [item.id as string, item.key as string]));
  const permissionsByGroup: Record<string, string[]> = {};

  for (const member of memberships ?? []) {
    const groupId = member.group_id as string;
    permissionsByGroup[groupId] = (ugp ?? [])
      .filter(row => row.group_id === groupId)
      .map(row => permById.get(row.permission_id as string))
      .filter((key): key is string => Boolean(key));
  }

  const mergedPermissions = [...new Set(Object.values(permissionsByGroup).flat())];
  const token = buildToken(user.id as string, user.email as string, mergedPermissions);

  return jsonResponse(200, 1, {
    token,
    user: {
      id: user.id,
      name: user.full_name,
      username: user.username,
      email: user.email,
      isSuperAdmin: user.is_super_admin,
      groupIds: (memberships ?? []).map(m => m.group_id as string),
      permissionsByGroup,
    },
  });
}

async function handleRegister(payload: Record<string, unknown>): Promise<Response> {
  const errors = validatePayload(registerSchema, payload);
  if (errors.length > 0) {
    return jsonResponse(400, 0, null, errors.join(" | "));
  }

  const email = String(payload.email).trim().toLowerCase();
  const username = String(payload.username ?? email.split("@")[0]).trim();

  const { data: existingEmail } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1);

  if ((existingEmail ?? []).length > 0) {
    return jsonResponse(409, 0, null, "El email ya esta registrado");
  }

  const { data: existingUsername } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .limit(1);

  if ((existingUsername ?? []).length > 0) {
    return jsonResponse(409, 0, null, "El username ya esta en uso");
  }

  const { data: createdRows, error } = await supabase
    .from("users")
    .insert({
      full_name: String(payload.name).trim(),
      username,
      email,
      password_hash: String(payload.password),
      phone: String(payload.phone ?? ""),
      birth_date: String(payload.birthDate ?? "2000-01-01"),
      address: String(payload.address ?? ""),
      is_super_admin: false,
      is_active: true,
    })
    .select("id,full_name,username,email,is_super_admin,is_active")
    .limit(1);

  if (error || !createdRows?.length) {
    return jsonResponse(500, 0, null, `No se pudo registrar usuario: ${error?.message ?? "error desconocido"}`);
  }

  const created = createdRows[0];
  return jsonResponse(201, 1, {
    id: created.id,
    name: created.full_name,
    username: created.username,
    email: created.email,
    isSuperAdmin: created.is_super_admin,
    isActive: created.is_active,
  }, "Usuario registrado correctamente");
}

function canManageUsers(requesterPermissions: PermissionKey[], requesterIsSuperAdmin: boolean): boolean {
  if (requesterIsSuperAdmin) return true;
  return requesterPermissions.includes("user:add") || requesterPermissions.includes("user:manage");
}

async function handleAddUser(payload: Record<string, unknown>): Promise<Response> {
  const errors = validatePayload(addUserSchema, payload);
  if (errors.length > 0) {
    return jsonResponse(400, 0, null, errors.join(" | "));
  }

  const requesterPermissions = Array.isArray(payload.requesterPermissions)
    ? payload.requesterPermissions.filter(item => typeof item === "string") as string[]
    : [];
  const requesterIsSuperAdmin = payload.requesterIsSuperAdmin === true;

  if (!canManageUsers(requesterPermissions, requesterIsSuperAdmin)) {
    return jsonResponse(403, 0, null, "No tienes permisos para agregar usuarios");
  }

  const email = String(payload.email).trim().toLowerCase();
  const username = String(payload.username ?? email.split("@")[0]).trim();

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .or(`email.eq.${email},username.eq.${username}`)
    .limit(1);

  if ((existing ?? []).length > 0) {
    return jsonResponse(409, 0, null, "El usuario ya existe (email o username)");
  }

  const { data: createdRows, error } = await supabase
    .from("users")
    .insert({
      full_name: String(payload.name).trim(),
      username,
      email,
      password_hash: String(payload.password),
      phone: String(payload.phone ?? ""),
      birth_date: String(payload.birthDate ?? "2000-01-01"),
      address: String(payload.address ?? ""),
      is_super_admin: payload.isSuperAdmin === true,
      is_active: true,
    })
    .select("id")
    .limit(1);

  if (error || !createdRows?.length) {
    return jsonResponse(500, 0, null, `No se pudo crear usuario: ${error?.message ?? "error desconocido"}`);
  }

  const userId = createdRows[0].id as string;
  const groupIds = Array.isArray(payload.groupIds)
    ? payload.groupIds.filter(groupId => typeof groupId === "string") as string[]
    : [];

  if (groupIds.length) {
    const membersPayload = groupIds.map(groupId => ({ group_id: groupId, user_id: userId }));
    await supabase.from("group_members").insert(membersPayload);
  }

  const permissionsByGroup = asRecord(payload.permissionsByGroup) ?? {};
  const permissionKeys = [...new Set(Object.values(permissionsByGroup).flatMap(value => Array.isArray(value) ? value : []))]
    .filter(key => typeof key === "string") as string[];

  if (permissionKeys.length) {
    const { data: dbPermissions } = await supabase
      .from("permissions")
      .select("id,key")
      .in("key", permissionKeys);

    const idByKey = new Map((dbPermissions ?? []).map(item => [item.key as string, item.id as string]));
    const permissionRows: Array<{ group_id: string; user_id: string; permission_id: string }> = [];

    for (const [groupId, keys] of Object.entries(permissionsByGroup)) {
      const safeKeys = Array.isArray(keys)
        ? keys.filter(key => typeof key === "string") as string[]
        : [];
      for (const key of safeKeys) {
        const permissionId = idByKey.get(key);
        if (!permissionId) continue;
        permissionRows.push({ group_id: groupId, user_id: userId, permission_id: permissionId });
      }
    }

    if (permissionRows.length) {
      await supabase.from("user_group_permissions").insert(permissionRows);
    }
  }

  return jsonResponse(201, 1, { id: userId }, "Usuario agregado correctamente");
}

async function handlePermissions(): Promise<Response> {
  const { data, error } = await supabase
    .from("permissions")
    .select("key")
    .order("key", { ascending: true });

  if (error) {
    return jsonResponse(500, 0, null, `No se pudieron obtener permisos: ${error.message}`);
  }

  const keys = (data ?? []).map(item => item.key as string);
  return jsonResponse(200, 1, keys);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, 0, null, "Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const route = parseRoute(req);
  if (route === "unknown") {
    return jsonResponse(404, 0, null, "Ruta no soportada. Usa /permissions, /login, /register o /users");
  }

  if (route === "permissions") {
    if (req.method !== "GET") {
      return jsonResponse(405, 0, null, "Metodo no permitido. Usa GET /permissions");
    }
    return handlePermissions();
  }

  if (req.method !== "POST") {
    return jsonResponse(405, 0, null, "Metodo no permitido");
  }

  let payloadRaw: unknown;
  try {
    payloadRaw = await req.json();
  } catch {
    return jsonResponse(400, 0, null, "Body JSON invalido");
  }

  const payload = asRecord(payloadRaw);
  if (!payload) {
    return jsonResponse(400, 0, null, "Body debe ser un objeto JSON");
  }

  if (route === "login") return handleLogin(payload);
  if (route === "register") return handleRegister(payload);
  return handleAddUser(payload);
});
