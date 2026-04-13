import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { buildEnvelope } from '../../shared/contracts.js';
import {
  addUserToGroupInDb,
  createGroupInDb,
  deleteGroupFromDb,
  findGroupByIdInDb,
  findUserById,
  listGroupsInDb,
  listUsersInGroupFromDb,
  removeUserFromGroupInDb,
  updateGroupInDb,
} from '../../shared/db.js';

type GroupParams = {
  id: string;
  userId?: string;
};

type CreateGroupBody = {
  name?: string;
  description?: string;
  llmModel?: string;
  llmColor?: string;
};

type AddMemberBody = {
  userId: string;
};

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

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

app.get('/health', async () => buildEnvelope(200, 'SxGR200', { service: 'groups-service' }));

app.get('/groups', async (_request: FastifyRequest, reply: FastifyReply) => {
  const groups = await listGroupsInDb();
  return reply.code(200).send(buildEnvelope(200, 'SxGR200', groups));
});

app.get<{ Params: GroupParams }>('/groups/:id', async (request, reply) => {
  const group = await findGroupByIdInDb(request.params.id);
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', group));
});

app.post<{ Body: CreateGroupBody }>('/groups', { schema: createGroupSchema }, async (request, reply) => {
  const createdGroup = await createGroupInDb({
    name: request.body.name?.trim() ?? 'Nuevo grupo',
    description: request.body.description,
    llmModel: request.body.llmModel,
    llmColor: request.body.llmColor,
    createdBy: request.body.createdBy ?? null,
  });
  return reply.code(201).send(buildEnvelope(201, 'SxGR201', createdGroup, 'Grupo creado correctamente'));
});

app.patch<{ Params: GroupParams; Body: CreateGroupBody }>('/groups/:id', { schema: patchGroupSchema }, async (request, reply) => {
  const group = await findGroupByIdInDb(request.params.id);
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  const updatedGroup = await updateGroupInDb(request.params.id, {
    name: request.body.name,
    description: request.body.description,
    llmModel: request.body.llmModel,
    llmColor: request.body.llmColor,
  });
  return reply.code(200).send(buildEnvelope(200, 'SxGR200', updatedGroup, 'Grupo actualizado correctamente'));
});

app.delete<{ Params: GroupParams }>('/groups/:id', async (request, reply) => {
  const group = await findGroupByIdInDb(request.params.id);
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  await deleteGroupFromDb(request.params.id);

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', { id: request.params.id }, 'Grupo eliminado correctamente'));
});

app.get<{ Params: GroupParams }>('/groups/:id/users', async (request, reply) => {
  const group = await findGroupByIdInDb(request.params.id);
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', await listUsersInGroupFromDb(request.params.id)));
});

app.post<{ Params: GroupParams; Body: AddMemberBody }>('/groups/:id/users', { schema: addMemberSchema }, async (request, reply) => {
  const group = await findGroupByIdInDb(request.params.id);
  const user = await findUserById(request.body.userId);
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }
  if (!user) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Usuario no encontrado'));
  }

  await addUserToGroupInDb(request.params.id, request.body.userId);

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', { groupId: request.params.id, userId: request.body.userId }, 'Usuario agregado correctamente'));
});

app.delete<{ Params: Required<GroupParams> }>('/groups/:id/users/:userId', async (request, reply) => {
  const user = await findUserById(request.params.userId);
  if (!user) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Usuario no encontrado'));
  }

  await removeUserFromGroupInDb(request.params.id, request.params.userId);

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', { groupId: request.params.id, userId: request.params.userId }, 'Usuario removido correctamente'));
});

await app.listen({ port: 3003, host: '0.0.0.0' });
