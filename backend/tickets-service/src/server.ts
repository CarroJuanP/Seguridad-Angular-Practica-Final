import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  buildEnvelope,
  hasAnyPermission,
  type AppUser,
} from '../../shared/contracts.js';
import {
  addTicketCommentInDb,
  createTicketInDb,
  deleteTicketFromDb,
  findGroupByIdInDb,
  findTicketInDb,
  findUserById,
  listTicketPriorityNames,
  listTicketStatusNames,
  listTicketsFromDb,
  updateTicketInDb,
} from '../../shared/db.js';

type TicketParams = {
  id: string;
};

type TicketQuery = {
  groupId?: string;
};

type CreateTicketBody = {
  groupId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeId: string | null;
  createdBy: string;
};

type UpdateTicketBody = {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string | null;
  actorId?: string;
  action?: string;
};

type CommentBody = {
  authorId: string;
  message: string;
};

type UpdateTicketStatusBody = {
  status: string;
  userId: string;
  permissions: string[];
};

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

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

const commentSchema = {
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

const moveStatusSchema = {
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

app.get('/health', async () => buildEnvelope(200, 'SxTK200', { service: 'tickets-service' }));

app.get('/catalogs/ticket-statuses', async (_request, reply) => {
  const statuses = await listTicketStatusNames().catch(() => [...TICKET_STATUSES]);
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', statuses));
});

app.get('/catalogs/ticket-priorities', async (_request, reply) => {
  const priorities = await listTicketPriorityNames().catch(() => [...TICKET_PRIORITIES]);
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', priorities));
});

app.get<{ Querystring: TicketQuery }>('/tickets', async (request, reply) => {
  const tickets = await listTicketsFromDb(request.query.groupId);
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', tickets));
});

app.post<{ Body: CreateTicketBody }>('/tickets', { schema: createTicketSchema }, async (request, reply) => {
  const validStatuses = await listTicketStatusNames().catch(() => [...TICKET_STATUSES]);
  if (!validStatuses.includes(request.body.status)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Estado invalido'));
  }
  const validPriorities = await listTicketPriorityNames().catch(() => [...TICKET_PRIORITIES]);
  if (!validPriorities.includes(request.body.priority)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Prioridad invalida'));
  }

  const groupExists = await findGroupByIdInDb(request.body.groupId);
  const creator = await findUserById(request.body.createdBy);
  const assignee = request.body.assigneeId
    ? await findUserById(request.body.assigneeId)
    : null;

  if (!groupExists || !creator) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Grupo o creador invalido'));
  }
  if (assignee && !assignee.groupIds.includes(request.body.groupId)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'El asignado no pertenece al grupo'));
  }

  const createdTicket = await createTicketInDb({
    groupId: request.body.groupId,
    title: request.body.title,
    description: request.body.description,
    status: request.body.status,
    priority: request.body.priority,
    dueDate: request.body.dueDate,
    assigneeId: assignee?.id ?? null,
    createdBy: creator.id,
  });
  return reply.code(201).send(buildEnvelope(201, 'SxTK201', createdTicket, 'Ticket creado correctamente'));
});

app.get<{ Params: TicketParams }>('/tickets/:id', async (request, reply) => {
  const ticket = await findTicketInDb(request.params.id);
  if (!ticket) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxTK200', ticket));
});

app.patch<{ Params: TicketParams; Body: UpdateTicketBody }>('/tickets/:id', { schema: patchTicketSchema }, async (request, reply) => {
  const existingTicket = await findTicketInDb(request.params.id);
  if (!existingTicket) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }

  const actor = request.body.actorId
    ? await findUserById(request.body.actorId)
    : null;
  let assignee: AppUser | null | undefined;
  if (request.body.assigneeId) {
    assignee = await findUserById(request.body.assigneeId);
  } else if (request.body.assigneeId === null) {
    assignee = null;
  } else {
    assignee = undefined;
  }

  const validStatuses = await listTicketStatusNames().catch(() => [...TICKET_STATUSES]);
  if (request.body.status && !validStatuses.includes(request.body.status)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Estado invalido'));
  }
  const validPriorities = await listTicketPriorityNames().catch(() => [...TICKET_PRIORITIES]);
  if (request.body.priority && !validPriorities.includes(request.body.priority)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Prioridad invalida'));
  }
  if (assignee && !assignee.groupIds.includes(existingTicket.groupId)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'El asignado no pertenece al grupo'));
  }

  let nextAssigneeId: string | null | undefined;
  if (request.body.assigneeId === undefined) {
    nextAssigneeId = undefined;
  } else {
    nextAssigneeId = assignee?.id ?? null;
  }

  const updatedTicket = await updateTicketInDb(request.params.id, {
    title: request.body.title,
    description: request.body.description,
    status: request.body.status,
    priority: request.body.priority,
    dueDate: request.body.dueDate,
    assigneeId: nextAssigneeId,
    actorId: actor?.id,
    action: request.body.action,
  });
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', updatedTicket, 'Ticket actualizado correctamente'));
});

app.delete<{ Params: TicketParams }>('/tickets/:id', async (request, reply) => {
  const exists = await findTicketInDb(request.params.id);
  if (!exists) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }

  await deleteTicketFromDb(request.params.id);

  return reply.code(200).send(buildEnvelope(200, 'SxTK200', { id: request.params.id }, 'Ticket eliminado correctamente'));
});

app.post<{ Params: TicketParams; Body: CommentBody }>('/tickets/:id/comments', { schema: commentSchema }, async (request, reply) => {
  const ticket = await findTicketInDb(request.params.id);
  const author = await findUserById(request.body.authorId);
  if (!ticket) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }
  if (!author) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Autor no encontrado'));
  }

  return reply.code(201).send(buildEnvelope(201, 'SxTK201', await addTicketCommentInDb(request.params.id, author.id, request.body.message), 'Comentario agregado correctamente'));
});

app.patch<{ Params: TicketParams; Body: UpdateTicketStatusBody }>('/tickets/:id/status', { schema: moveStatusSchema }, async (request, reply) => {
  const ticket = await findTicketInDb(request.params.id);
  const authUser = await findUserById(request.body.userId);
  if (!ticket || !authUser) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket o usuario no encontrado'));
  }

  const canMove = hasAnyPermission({ ...authUser, password: authUser.password } as AppUser, request.body.permissions, ticket.groupId);
  const isAssignedToCurrentUser = authUser.isSuperAdmin || ticket.assigneeId === authUser.id;
  if (!canMove || !isAssignedToCurrentUser) {
    return reply.code(403).send(buildEnvelope(403, 'SxTK403', null, 'No autorizado para mover el ticket'));
  }

  const validStatuses = await listTicketStatusNames().catch(() => [...TICKET_STATUSES]);
  if (!validStatuses.includes(request.body.status)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Estado invalido'));
  }

  const updated = await updateTicketInDb(request.params.id, {
    status: request.body.status,
    actorId: authUser.id,
    action: `Estado actualizado a ${request.body.status}`,
  });

  return reply.code(200).send(buildEnvelope(200, 'SxTK200', updated, 'Estado actualizado correctamente'));
});

await app.listen({ port: 3002, host: '0.0.0.0' });
