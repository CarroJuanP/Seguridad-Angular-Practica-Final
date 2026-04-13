import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import {
  ALL_PERMISSIONS,
  buildEnvelope,
  buildToken,
  createId,
  findUserByIdentifier,
  readDemoDb,
  toPublicUser,
  updateDemoDb,
  validateEmail,
  type AppUser,
} from '../../shared/contracts.js';

type LoginBody = {
  identifier: string;
  password: string;
};

type RegisterBody = {
  name: string;
  email: string;
  username: string;
  password: string;
  phone?: string;
  birthDate?: string;
  address?: string;
};

type UpdateUserParams = {
  id: string;
};

type UserBody = Partial<AppUser> & {
  name?: string;
  email?: string;
  username?: string;
  password?: string;
};

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

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

const userSchema = {
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

app.get('/health', async () => buildEnvelope(200, 'SxUS200', { service: 'user-service' }));

app.get('/permissions', async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.code(200).send(buildEnvelope(200, 'SxUS200', [...ALL_PERMISSIONS]));
});

app.post<{ Body: LoginBody }>('/auth/login', { schema: loginSchema }, async (request, reply) => {
  const db = readDemoDb();
  const user = findUserByIdentifier(db.users, request.body.identifier);

  if (user?.password !== request.body.password) {
    return reply.code(401).send(buildEnvelope(401, 'SxUS401', null, 'Credenciales invalidas'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxUS200', {
    token: buildToken(user),
    user: toPublicUser(user),
  }));
});

app.post<{ Body: RegisterBody }>('/auth/register', { schema: registerSchema }, async (request, reply) => {
  const email = request.body.email.trim().toLowerCase();
  const username = request.body.username.trim().toLowerCase();

  if (!validateEmail(email)) {
    return reply.code(400).send(buildEnvelope(400, 'SxUS400', null, 'Email invalido'));
  }

  const currentDb = readDemoDb();
  const conflict = currentDb.users.find(user => user.email === email || user.username.toLowerCase() === username);
  if (conflict) {
    return reply.code(409).send(buildEnvelope(409, 'SxUS409', null, 'El usuario ya existe'));
  }

  const createdDb = updateDemoDb(db => {
    db.users.push({
      id: createId('usr'),
      name: request.body.name.trim(),
      email,
      username,
      password: request.body.password,
      phone: request.body.phone?.trim() ?? '',
      birthDate: request.body.birthDate?.trim() ?? '2000-01-01',
      address: request.body.address?.trim() ?? '',
      isSuperAdmin: false,
      groupIds: [],
      permissionsByGroup: {},
    });
  });

  const createdUser = createdDb.users.at(-1);
  return reply.code(201).send(buildEnvelope(201, 'SxUS201', createdUser ? toPublicUser(createdUser) : null, 'Usuario registrado correctamente'));
});

app.get('/users', async (_request, reply) => {
  const db = readDemoDb();
  return reply.code(200).send(buildEnvelope(200, 'SxUS200', db.users.map(toPublicUser)));
});

app.post<{ Body: UserBody }>('/users', { schema: userSchema }, async (request, reply) => {
  const email = request.body.email?.trim().toLowerCase() ?? '';
  const username = request.body.username?.trim().toLowerCase() ?? '';
  const name = request.body.name?.trim() ?? '';
  const password = request.body.password ?? '';

  if (!validateEmail(email) || !username || !name || !password) {
    return reply.code(400).send(buildEnvelope(400, 'SxUS400', null, 'Datos de usuario invalidos'));
  }

  const currentDb = readDemoDb();
  const conflict = currentDb.users.find(user => user.email === email || user.username.toLowerCase() === username);
  if (conflict) {
    return reply.code(409).send(buildEnvelope(409, 'SxUS409', null, 'El usuario ya existe'));
  }

  const savedDb = updateDemoDb(db => {
    db.users.push({
      id: request.body.id?.trim() || createId('usr'),
      name,
      email,
      username,
      password,
      phone: request.body.phone?.trim() ?? '',
      birthDate: request.body.birthDate?.trim() ?? '2000-01-01',
      address: request.body.address?.trim() ?? '',
      isSuperAdmin: request.body.isSuperAdmin === true,
      groupIds: Array.isArray(request.body.groupIds) ? [...new Set(request.body.groupIds.map(String).filter(Boolean))] : [],
      permissionsByGroup: typeof request.body.permissionsByGroup === 'object' && request.body.permissionsByGroup
        ? request.body.permissionsByGroup
        : {},
    });
  });

  const createdUser = savedDb.users.at(-1);
  return reply.code(201).send(buildEnvelope(201, 'SxUS201', createdUser ? toPublicUser(createdUser) : null, 'Usuario creado correctamente'));
});

app.patch<{ Params: UpdateUserParams; Body: UserBody }>('/users/:id', { schema: patchUserSchema }, async (request, reply) => {
  const db = readDemoDb();
  const existingUser = db.users.find(user => user.id === request.params.id) ?? null;
  if (!existingUser) {
    return reply.code(404).send(buildEnvelope(404, 'SxUS404', null, 'Usuario no encontrado'));
  }

  const email = request.body.email?.trim().toLowerCase();
  const username = request.body.username?.trim().toLowerCase();
  if (email && !validateEmail(email)) {
    return reply.code(400).send(buildEnvelope(400, 'SxUS400', null, 'Email invalido'));
  }

  const savedDb = updateDemoDb(current => {
    const user = current.users.find(item => item.id === request.params.id);
    if (!user) {
      return;
    }

    if (email) user.email = email;
    if (username) user.username = username;
    if (request.body.name?.trim()) user.name = request.body.name.trim();
    if (request.body.password !== undefined && request.body.password !== '') user.password = request.body.password;
    if (request.body.phone !== undefined) user.phone = request.body.phone.trim();
    if (request.body.birthDate !== undefined) user.birthDate = request.body.birthDate.trim() || '2000-01-01';
    if (request.body.address !== undefined) user.address = request.body.address.trim();
    if (request.body.isSuperAdmin !== undefined) user.isSuperAdmin = request.body.isSuperAdmin === true;
    if (Array.isArray(request.body.groupIds)) user.groupIds = [...new Set(request.body.groupIds.map(String).filter(Boolean))];
    if (request.body.permissionsByGroup && typeof request.body.permissionsByGroup === 'object') {
      user.permissionsByGroup = request.body.permissionsByGroup;
    }
  });

  const savedUser = savedDb.users.find(user => user.id === request.params.id) ?? null;
  return reply.code(200).send(buildEnvelope(200, 'SxUS200', savedUser ? toPublicUser(savedUser) : null, 'Usuario actualizado correctamente'));
});

app.delete<{ Params: UpdateUserParams }>('/users/:id', async (request, reply) => {
  const db = readDemoDb();
  const userExists = db.users.some(user => user.id === request.params.id);
  if (!userExists) {
    return reply.code(404).send(buildEnvelope(404, 'SxUS404', null, 'Usuario no encontrado'));
  }

  updateDemoDb(current => {
    current.users = current.users.filter(user => user.id !== request.params.id);
    current.tickets = current.tickets.map(ticket => {
      if (ticket.assigneeId === request.params.id) {
        return { ...ticket, assigneeId: null, assigneeName: null };
      }

      return ticket;
    });
  });

  return reply.code(200).send(buildEnvelope(200, 'SxUS200', { id: request.params.id }, 'Usuario eliminado correctamente'));
});

await app.listen({ port: 3001, host: '0.0.0.0' });
