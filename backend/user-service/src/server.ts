import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import {
  ALL_PERMISSIONS,
  buildEnvelope,
  buildToken,
  toPublicUser,
  validateEmail,
  verifyPassword,
  type AppUser,
} from '../../shared/contracts.js';
import {
  createRegisteredUser,
  deleteUserFromDb,
  findUserById,
  findUserByIdentifierInDb,
  listPermissionKeys,
  listUsers,
  updateUserInDb,
} from '../../shared/db.js';

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
  const permissions = await listPermissionKeys().catch(() => [...ALL_PERMISSIONS]);
  return reply.code(200).send(buildEnvelope(200, 'SxUS200', permissions));
});

app.post<{ Body: LoginBody }>('/auth/login', { schema: loginSchema }, async (request, reply) => {
  const user = await findUserByIdentifierInDb(request.body.identifier);

  if (!user || !verifyPassword(user.password, request.body.password)) {
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

  const currentUsers = await listUsers(false);
  const conflict = currentUsers.find(user => user.email === email || user.username.toLowerCase() === username);
  if (conflict) {
    return reply.code(409).send(buildEnvelope(409, 'SxUS409', null, 'El usuario ya existe'));
  }

  const createdUser = await createRegisteredUser({
    name: request.body.name,
    email,
    username,
    password: request.body.password,
    phone: request.body.phone,
    birthDate: request.body.birthDate,
    address: request.body.address,
    isSuperAdmin: false,
    groupIds: [],
    permissionsByGroup: {},
  });
  return reply.code(201).send(buildEnvelope(201, 'SxUS201', toPublicUser(createdUser), 'Usuario registrado correctamente'));
});

app.get('/users', async (_request, reply) => {
  const users = await listUsers(true);
  return reply.code(200).send(buildEnvelope(200, 'SxUS200', users.map(toPublicUser)));
});

app.post<{ Body: UserBody }>('/users', { schema: userSchema }, async (request, reply) => {
  const email = request.body.email?.trim().toLowerCase() ?? '';
  const username = request.body.username?.trim().toLowerCase() ?? '';
  const name = request.body.name?.trim() ?? '';
  const password = request.body.password ?? '';

  if (!validateEmail(email) || !username || !name || !password) {
    return reply.code(400).send(buildEnvelope(400, 'SxUS400', null, 'Datos de usuario invalidos'));
  }

  const currentUsers = await listUsers(false);
  const conflict = currentUsers.find(user => user.email === email || user.username.toLowerCase() === username);
  if (conflict) {
    return reply.code(409).send(buildEnvelope(409, 'SxUS409', null, 'El usuario ya existe'));
  }

  const createdUser = await createRegisteredUser({
    id: request.body.id?.trim(),
    name,
    email,
    username,
    password,
    phone: request.body.phone,
    birthDate: request.body.birthDate,
    address: request.body.address,
    isSuperAdmin: request.body.isSuperAdmin === true,
    groupIds: Array.isArray(request.body.groupIds) ? [...new Set(request.body.groupIds.map(String).filter(Boolean))] : [],
    permissionsByGroup: typeof request.body.permissionsByGroup === 'object' && request.body.permissionsByGroup
      ? request.body.permissionsByGroup
      : {},
  });

  return reply.code(201).send(buildEnvelope(201, 'SxUS201', toPublicUser(createdUser), 'Usuario creado correctamente'));
});

app.patch<{ Params: UpdateUserParams; Body: UserBody }>('/users/:id', { schema: patchUserSchema }, async (request, reply) => {
  const existingUser = await findUserById(request.params.id);
  if (!existingUser) {
    return reply.code(404).send(buildEnvelope(404, 'SxUS404', null, 'Usuario no encontrado'));
  }

  const email = request.body.email?.trim().toLowerCase();
  const username = request.body.username?.trim().toLowerCase();
  if (email && !validateEmail(email)) {
    return reply.code(400).send(buildEnvelope(400, 'SxUS400', null, 'Email invalido'));
  }

  const savedUser = await updateUserInDb(request.params.id, {
    email,
    username,
    name: request.body.name,
    password: request.body.password,
    phone: request.body.phone,
    birthDate: request.body.birthDate,
    address: request.body.address,
    isSuperAdmin: request.body.isSuperAdmin,
    groupIds: Array.isArray(request.body.groupIds) ? [...new Set(request.body.groupIds.map(String).filter(Boolean))] : undefined,
    permissionsByGroup: request.body.permissionsByGroup && typeof request.body.permissionsByGroup === 'object'
      ? request.body.permissionsByGroup
      : undefined,
  });

  return reply.code(200).send(buildEnvelope(200, 'SxUS200', savedUser ? toPublicUser(savedUser) : null, 'Usuario actualizado correctamente'));
});

app.delete<{ Params: UpdateUserParams }>('/users/:id', async (request, reply) => {
  const userExists = await findUserById(request.params.id);
  if (!userExists) {
    return reply.code(404).send(buildEnvelope(404, 'SxUS404', null, 'Usuario no encontrado'));
  }

  await deleteUserFromDb(request.params.id);

  return reply.code(200).send(buildEnvelope(200, 'SxUS200', { id: request.params.id }, 'Usuario eliminado correctamente'));
});

await app.listen({ port: 3001, host: '0.0.0.0' });
