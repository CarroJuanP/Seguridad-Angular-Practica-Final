import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { buildEnvelope, createId, listUsersInGroup, readDemoDb, updateDemoDb, type AppGroup } from '../../shared/contracts.js';

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
  const db = readDemoDb();
  return reply.code(200).send(buildEnvelope(200, 'SxGR200', db.groups));
});

app.get<{ Params: GroupParams }>('/groups/:id', async (request, reply) => {
  const db = readDemoDb();
  const group = db.groups.find(current => current.id === request.params.id) ?? null;
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', group));
});

app.post<{ Body: CreateGroupBody }>('/groups', { schema: createGroupSchema }, async (request, reply) => {
  const savedDb = updateDemoDb(db => {
    const group: AppGroup = {
      id: createId('grp'),
      name: request.body.name?.trim() ?? 'Nuevo grupo',
      description: request.body.description?.trim() ?? '',
      llmModel: request.body.llmModel?.trim() ?? '',
      llmColor: request.body.llmColor?.trim() ?? '#F54927',
    };

    db.groups.push(group);
  });

  const createdGroup = savedDb.groups.at(-1) ?? null;
  return reply.code(201).send(buildEnvelope(201, 'SxGR201', createdGroup, 'Grupo creado correctamente'));
});

app.patch<{ Params: GroupParams; Body: CreateGroupBody }>('/groups/:id', { schema: patchGroupSchema }, async (request, reply) => {
  const db = readDemoDb();
  const exists = db.groups.some(group => group.id === request.params.id);
  if (!exists) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  const updatedDb = updateDemoDb(current => {
    const group = current.groups.find(item => item.id === request.params.id);
    if (!group) {
      return;
    }

    if (request.body.name?.trim()) group.name = request.body.name.trim();
    if (request.body.description !== undefined) group.description = request.body.description.trim();
    if (request.body.llmModel !== undefined) group.llmModel = request.body.llmModel.trim();
    if (request.body.llmColor !== undefined) group.llmColor = request.body.llmColor.trim() || '#F54927';
  });

  const updatedGroup = updatedDb.groups.find(group => group.id === request.params.id) ?? null;
  return reply.code(200).send(buildEnvelope(200, 'SxGR200', updatedGroup, 'Grupo actualizado correctamente'));
});

app.delete<{ Params: GroupParams }>('/groups/:id', async (request, reply) => {
  const db = readDemoDb();
  const exists = db.groups.some(group => group.id === request.params.id);
  if (!exists) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  updateDemoDb(current => {
    current.groups = current.groups.filter(group => group.id !== request.params.id);
    current.users = current.users.map(user => ({
      ...user,
      groupIds: user.groupIds.filter(groupId => groupId !== request.params.id),
      permissionsByGroup: Object.fromEntries(
        Object.entries(user.permissionsByGroup).filter(([groupId]) => groupId !== request.params.id),
      ),
    }));
    current.tickets = current.tickets.filter(ticket => ticket.groupId !== request.params.id);
  });

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', { id: request.params.id }, 'Grupo eliminado correctamente'));
});

app.get<{ Params: GroupParams }>('/groups/:id/users', async (request, reply) => {
  const db = readDemoDb();
  const group = db.groups.find(current => current.id === request.params.id) ?? null;
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', listUsersInGroup(db, request.params.id)));
});

app.post<{ Params: GroupParams; Body: AddMemberBody }>('/groups/:id/users', { schema: addMemberSchema }, async (request, reply) => {
  const db = readDemoDb();
  const group = db.groups.find(current => current.id === request.params.id) ?? null;
  const user = db.users.find(current => current.id === request.body.userId) ?? null;
  if (!group) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Grupo no encontrado'));
  }
  if (!user) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Usuario no encontrado'));
  }

  updateDemoDb(current => {
    const targetUser = current.users.find(item => item.id === request.body.userId);
    if (!targetUser) {
      return;
    }

    if (!targetUser.groupIds.includes(request.params.id)) {
      targetUser.groupIds.push(request.params.id);
    }

    targetUser.permissionsByGroup[request.params.id] ??= [];
  });

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', { groupId: request.params.id, userId: request.body.userId }, 'Usuario agregado correctamente'));
});

app.delete<{ Params: Required<GroupParams> }>('/groups/:id/users/:userId', async (request, reply) => {
  const db = readDemoDb();
  const user = db.users.find(current => current.id === request.params.userId) ?? null;
  if (!user) {
    return reply.code(404).send(buildEnvelope(404, 'SxGR404', null, 'Usuario no encontrado'));
  }

  updateDemoDb(current => {
    const targetUser = current.users.find(item => item.id === request.params.userId);
    if (!targetUser) {
      return;
    }

    targetUser.groupIds = targetUser.groupIds.filter(groupId => groupId !== request.params.id);
    delete targetUser.permissionsByGroup[request.params.id];
    current.tickets = current.tickets.map(ticket =>
      ticket.groupId === request.params.id && ticket.assigneeId === request.params.userId
        ? { ...ticket, assigneeId: null, assigneeName: null }
        : ticket,
    );
  });

  return reply.code(200).send(buildEnvelope(200, 'SxGR200', { groupId: request.params.id, userId: request.params.userId }, 'Usuario removido correctamente'));
});

await app.listen({ port: 3003, host: '0.0.0.0' });
