import 'dotenv/config';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { buildEnvelope, hasAnyPermission, readBearerToken, readTokenPayload, type AppUser, type AuthTokenPayload } from '../../shared/contracts.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const TICKETS_SERVICE_URL = process.env.TICKETS_SERVICE_URL;
const GROUPS_SERVICE_URL = process.env.GROUPS_SERVICE_URL;
const API_GATEWAY_HOST = process.env.API_GATEWAY_HOST ?? '0.0.0.0';
const API_GATEWAY_PORT = Number(process.env.API_GATEWAY_PORT ?? '3000');

if (!USER_SERVICE_URL || !TICKETS_SERVICE_URL || !GROUPS_SERVICE_URL) {
  throw new Error('API Gateway mal configurado. Define USER_SERVICE_URL, TICKETS_SERVICE_URL y GROUPS_SERVICE_URL en .env.');
}

const loginSchema = {
  body: {
    type: 'object',
    required: ['identifier', 'password'],
    properties: {
      identifier: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 3 },
    },
    additionalProperties: false,
  },
} as const;

const registerSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'username', 'password'],
    properties: {
      name: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      username: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 8 },
      phone: { type: 'string' },
      birthDate: { type: 'string' },
      address: { type: 'string' },
    },
    additionalProperties: false,
  },
} as const;

const createGroupSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      llmModel: { type: 'string' },
      llmColor: { type: 'string' },
      createdBy: { type: ['string', 'null'] },
    },
    additionalProperties: false,
  },
} as const;

const moveTicketSchema = {
  body: {
    type: 'object',
    required: ['status', 'userId', 'permissions'],
    properties: {
      status: { type: 'string', minLength: 2 },
      userId: { type: 'string', minLength: 1 },
      permissions: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
  },
} as const;

const patchGroupSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      llmModel: { type: 'string' },
      llmColor: { type: 'string' },
    },
    additionalProperties: false,
  },
} as const;

const addMemberSchema = {
  body: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
} as const;

const createUserSchema = {
  body: {
    type: 'object',
    required: ['name', 'email', 'username', 'password'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      username: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 1 },
      phone: { type: 'string' },
      birthDate: { type: 'string' },
      address: { type: 'string' },
      isSuperAdmin: { type: 'boolean' },
      groupIds: { type: 'array', items: { type: 'string' } },
      permissionsByGroup: { type: 'object' },
    },
    additionalProperties: false,
  },
} as const;

const patchUserSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      username: { type: 'string', minLength: 3 },
      password: { type: 'string', minLength: 1 },
      phone: { type: 'string' },
      birthDate: { type: 'string' },
      address: { type: 'string' },
      isSuperAdmin: { type: 'boolean' },
      groupIds: { type: 'array', items: { type: 'string' } },
      permissionsByGroup: { type: 'object' },
    },
    additionalProperties: false,
  },
} as const;

const createTicketSchema = {
  body: {
    type: 'object',
    required: ['groupId', 'title', 'status', 'priority', 'dueDate', 'createdBy'],
    properties: {
      groupId: { type: 'string', minLength: 1 },
      title: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      status: { type: 'string', minLength: 2 },
      priority: { type: 'string', minLength: 2 },
      dueDate: { type: 'string', minLength: 10 },
      assigneeId: { type: ['string', 'null'] },
      createdBy: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
} as const;

const patchTicketSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      status: { type: 'string', minLength: 2 },
      priority: { type: 'string', minLength: 2 },
      dueDate: { type: 'string', minLength: 10 },
      assigneeId: { type: ['string', 'null'] },
      actorId: { type: 'string' },
      action: { type: 'string' },
    },
    additionalProperties: false,
  },
} as const;

const addCommentSchema = {
  body: {
    type: 'object',
    required: ['authorId', 'message'],
    properties: {
      authorId: { type: 'string', minLength: 1 },
      message: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
} as const;

type TicketSummary = {
  id: string;
  groupId: string;
  assigneeId: string | null;
};

type GroupTicketSummary = {
  groupId: string;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

function toGatewayUser(payload: AuthTokenPayload | null): AppUser | null {
  if (!payload?.sub || !payload.email) {
    return null;
  }

  return {
    id: payload.sub,
    name: payload.email,
    username: payload.email.split('@')[0] ?? payload.sub,
    email: payload.email,
    password: '',
    phone: '',
    birthDate: '2000-01-01',
    address: '',
    isSuperAdmin: payload.isSuperAdmin === true,
    groupIds: Array.isArray(payload.groupIds) ? payload.groupIds : [],
    permissionsByGroup: payload.permissionsByGroup ?? {},
  };
}

function getAuthUser(request: FastifyRequest): AppUser | null {
  const payload = readTokenPayload(readBearerToken(request.headers.authorization));
  return toGatewayUser(payload);
}

async function readTicketSummary(ticketId: string): Promise<TicketSummary | null> {
  const response = await fetch(`${TICKETS_SERVICE_URL}/tickets/${ticketId}`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as { data?: TicketSummary | null };
  return payload.data ?? null;
}

async function readGroupTicketSummary(groupId: string): Promise<GroupTicketSummary | null> {
  const response = await fetch(`${TICKETS_SERVICE_URL}/tickets?groupId=${encodeURIComponent(groupId)}`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as { data?: Array<{ groupId: string; status: string; priority: string }> | null };
  const tickets = payload.data ?? [];
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

  return summary;
}

function forbidden(message: string) {
  return buildEnvelope(403, 'SxGW403', null, message);
}

function unauthorized() {
  return buildEnvelope(401, 'SxGW401', null, 'Token invalido o ausente');
}

function canMoveAssignedTicket(authUser: AppUser, ticket: TicketSummary): boolean {
  return authUser.isSuperAdmin || ticket.assigneeId === authUser.id;
}

async function forwardRequest(request: FastifyRequest, reply: FastifyReply, targetBaseUrl: string): Promise<void> {
  const targetUrl = `${targetBaseUrl}${request.raw.url ?? ''}`;
  const headers = new Headers();
  const hopByHopHeaders = new Set([
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);

  for (const [key, value] of Object.entries(request.headers)) {
    const normalizedKey = key.toLowerCase();
    if (hopByHopHeaders.has(normalizedKey) || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else {
      headers.set(key, value);
    }
  }

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody
    ? JSON.stringify(request.body ?? {})
    : undefined;

  if (hasBody && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(targetUrl, { method, headers, body });
  const text = await response.text();
  reply.code(response.status);
  reply.header('content-type', response.headers.get('content-type') ?? 'application/json');

  if (!text) {
    reply.send();
    return;
  }

  try {
    reply.send(JSON.parse(text));
  } catch {
    reply.send(text);
  }
}

function sanitizeSelfUserPatch(body: unknown): Record<string, unknown> {
  const payload = (body !== null && typeof body === 'object') ? body as Record<string, unknown> : {};
  return {
    name: payload['name'],
    email: payload['email'],
    username: payload['username'],
    password: payload['password'],
    phone: payload['phone'],
    birthDate: payload['birthDate'],
    address: payload['address'],
  };
}

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: true,
  methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
});
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  errorResponseBuilder: () => buildEnvelope(429, 'SxGW429', null, 'Too many requests'),
});

app.get('/health', async () => buildEnvelope(200, 'SxGW200', { service: 'apigateway' }));

app.get('/permissions', async (request, reply) => forwardRequest(request, reply, USER_SERVICE_URL));
app.post('/auth/login', { schema: loginSchema }, async (request, reply) => forwardRequest(request, reply, USER_SERVICE_URL));
app.post('/auth/register', { schema: registerSchema }, async (request, reply) => forwardRequest(request, reply, USER_SERVICE_URL));

app.get('/groups', async (request, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:view', 'group:manage'])) {
    reply.code(403).send(forbidden('No autorizado para consultar grupos'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.post('/groups', { schema: createGroupSchema }, async (request, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:add', 'group:manage'])) {
    reply.code(403).send(forbidden('No autorizado para crear grupos'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.get('/groups/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:view', 'group:manage'], request.params.id)) {
    reply.code(403).send(forbidden('No autorizado para ver este grupo'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.patch('/groups/:id', { schema: patchGroupSchema }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:edit', 'group:manage'], request.params.id)) {
    reply.code(403).send(forbidden('No autorizado para editar este grupo'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.delete('/groups/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:delete', 'group:manage'], request.params.id)) {
    reply.code(403).send(forbidden('No autorizado para eliminar este grupo'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.get('/groups/:id/users', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:view', 'group:manage'], request.params.id)) {
    reply.code(403).send(forbidden('No autorizado para ver miembros del grupo'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.get('/groups/:id/ticket-summary', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }

  const canSeeGroup = authUser.isSuperAdmin
    || authUser.groupIds.includes(request.params.id)
    || hasAnyPermission(authUser, ['group:view', 'group:manage'], request.params.id);
  if (!canSeeGroup) {
    reply.code(403).send(forbidden('No autorizado para ver el resumen de tickets del grupo'));
    return;
  }

  const summary = await readGroupTicketSummary(request.params.id);
  if (!summary) {
    reply.code(500).send(buildEnvelope(500, 'SxGW500', null, 'No se pudo obtener el resumen de tickets del grupo'));
    return;
  }

  reply.code(200).send(buildEnvelope(200, 'SxGW200', summary));
});

app.post('/groups/:id/users', { schema: addMemberSchema }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:add:member', 'group:manage'], request.params.id)) {
    reply.code(403).send(forbidden('No autorizado para agregar miembros'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.delete('/groups/:id/users/:userId', async (request: FastifyRequest<{ Params: { id: string; userId: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['group:remove:member', 'group:manage'], request.params.id)) {
    reply.code(403).send(forbidden('No autorizado para remover miembros'));
    return;
  }
  await forwardRequest(request, reply, GROUPS_SERVICE_URL);
});

app.get('/users', async (request, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['user:view', 'user:view:all', 'user:manage'])) {
    reply.code(403).send(forbidden('No autorizado para consultar usuarios'));
    return;
  }
  await forwardRequest(request, reply, USER_SERVICE_URL);
});

app.post('/users', { schema: createUserSchema }, async (request, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['user:add', 'user:manage'])) {
    reply.code(403).send(forbidden('No autorizado para crear usuarios'));
    return;
  }
  await forwardRequest(request, reply, USER_SERVICE_URL);
});

app.patch('/users/:id', { schema: patchUserSchema }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const isSelf = authUser.id === request.params.id;
  if (!isSelf && !hasAnyPermission(authUser, ['user:edit', 'user:manage'])) {
    reply.code(403).send(forbidden('No autorizado para editar usuarios'));
    return;
  }

  if (!isSelf) {
    await forwardRequest(request, reply, USER_SERVICE_URL);
    return;
  }

  const targetUrl = `${USER_SERVICE_URL}${request.raw.url ?? ''}`;
  const headers = new Headers();
  const hopByHopHeaders = new Set([
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);
  for (const [key, value] of Object.entries(request.headers)) {
    if (hopByHopHeaders.has(key.toLowerCase()) || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else {
      headers.set(key, value);
    }
  }

  const response = await fetch(targetUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(sanitizeSelfUserPatch(request.body)),
  });

  const text = await response.text();
  reply.code(response.status);
  reply.header('content-type', response.headers.get('content-type') ?? 'application/json');

  if (!text) {
    reply.send();
    return;
  }

  try {
    reply.send(JSON.parse(text));
  } catch {
    reply.send(text);
  }
});

app.delete('/users/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['user:delete', 'user:manage'])) {
    reply.code(403).send(forbidden('No autorizado para eliminar usuarios'));
    return;
  }
  await forwardRequest(request, reply, USER_SERVICE_URL);
});

app.get('/catalogs/ticket-statuses', async (request, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.get('/catalogs/ticket-priorities', async (request, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.get('/tickets', async (request: FastifyRequest<{ Querystring: { groupId?: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const groupId = request.query.groupId ?? null;
  if (!hasAnyPermission(authUser, ['ticket:view', 'ticket:manage'], groupId)) {
    reply.code(403).send(forbidden('No autorizado para consultar tickets'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.post('/tickets', { schema: createTicketSchema }, async (request: FastifyRequest<{ Body: { groupId: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  if (!hasAnyPermission(authUser, ['ticket:add', 'ticket:manage'], request.body.groupId)) {
    reply.code(403).send(forbidden('No autorizado para crear tickets'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.get('/tickets/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const ticket = await readTicketSummary(request.params.id);
  if (!ticket) {
    reply.code(404).send(buildEnvelope(404, 'SxGW404', null, 'Ticket no encontrado'));
    return;
  }
  if (!hasAnyPermission(authUser, ['ticket:view', 'ticket:manage'], ticket.groupId)) {
    reply.code(403).send(forbidden('No autorizado para ver este ticket'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.patch('/tickets/:id', { schema: patchTicketSchema }, async (request: FastifyRequest<{ Params: { id: string }; Body: { status?: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const ticket = await readTicketSummary(request.params.id);
  if (!ticket) {
    reply.code(404).send(buildEnvelope(404, 'SxGW404', null, 'Ticket no encontrado'));
    return;
  }

  const wantsStatusChange = typeof request.body?.status === 'string';
  const wantsFieldEdit = ['title', 'description', 'priority', 'dueDate', 'assigneeId'].some(field => request.body?.[field as keyof typeof request.body] !== undefined);
  const canEdit = hasAnyPermission(authUser, ['ticket:edit', 'ticket:manage'], ticket.groupId);
  const canMove = hasAnyPermission(authUser, ['ticket:edit:state', 'ticket:manage'], ticket.groupId);
  if ((wantsStatusChange && (!canMove || !canMoveAssignedTicket(authUser, ticket))) || (wantsFieldEdit && !canEdit)) {
    reply.code(403).send(forbidden('No autorizado para actualizar este ticket'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.delete('/tickets/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const ticket = await readTicketSummary(request.params.id);
  if (!ticket) {
    reply.code(404).send(buildEnvelope(404, 'SxGW404', null, 'Ticket no encontrado'));
    return;
  }
  if (!hasAnyPermission(authUser, ['ticket:delete', 'ticket:manage'], ticket.groupId)) {
    reply.code(403).send(forbidden('No autorizado para eliminar este ticket'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.patch('/tickets/:id/status', { schema: moveTicketSchema }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const ticket = await readTicketSummary(request.params.id);
  if (!ticket) {
    reply.code(404).send(buildEnvelope(404, 'SxGW404', null, 'Ticket no encontrado'));
    return;
  }
  const canMove = hasAnyPermission(authUser, ['ticket:edit:state', 'ticket:manage'], ticket.groupId);
  if (!canMove || !canMoveAssignedTicket(authUser, ticket)) {
    reply.code(403).send(forbidden('No autorizado para mover este ticket'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

app.post('/tickets/:id/comments', { schema: addCommentSchema }, async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const authUser = getAuthUser(request);
  if (!authUser) {
    reply.code(401).send(unauthorized());
    return;
  }
  const ticket = await readTicketSummary(request.params.id);
  if (!ticket) {
    reply.code(404).send(buildEnvelope(404, 'SxGW404', null, 'Ticket no encontrado'));
    return;
  }
  if (!hasAnyPermission(authUser, ['ticket:edit:comment', 'ticket:manage'], ticket.groupId)) {
    reply.code(403).send(forbidden('No autorizado para comentar este ticket'));
    return;
  }
  await forwardRequest(request, reply, TICKETS_SERVICE_URL);
});

await app.listen({ port: API_GATEWAY_PORT, host: API_GATEWAY_HOST });
