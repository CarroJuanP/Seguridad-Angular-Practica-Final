import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  buildEnvelope,
  createId,
  createTicketCode,
  findTicket,
  hasAnyPermission,
  listTickets,
  readDemoDb,
  resolveTicketUsers,
  updateDemoDb,
  type AppUser,
  type Ticket,
} from '../../shared/contracts.js';

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
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', [...TICKET_STATUSES]));
});

app.get('/catalogs/ticket-priorities', async (_request, reply) => {
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', [...TICKET_PRIORITIES]));
});

app.get<{ Querystring: TicketQuery }>('/tickets', async (request, reply) => {
  const db = readDemoDb();
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', listTickets(db, request.query.groupId)));
});

app.post<{ Body: CreateTicketBody }>('/tickets', { schema: createTicketSchema }, async (request, reply) => {
  if (!TICKET_STATUSES.includes(request.body.status as typeof TICKET_STATUSES[number])) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Estado invalido'));
  }
  if (!TICKET_PRIORITIES.includes(request.body.priority as typeof TICKET_PRIORITIES[number])) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Prioridad invalida'));
  }

  const db = readDemoDb();
  const groupExists = db.groups.some(group => group.id === request.body.groupId);
  const creator = db.users.find(user => user.id === request.body.createdBy) ?? null;
  const assignee = request.body.assigneeId
    ? db.users.find(user => user.id === request.body.assigneeId) ?? null
    : null;

  if (!groupExists || !creator) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Grupo o creador invalido'));
  }
  if (assignee && !assignee.groupIds.includes(request.body.groupId)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'El asignado no pertenece al grupo'));
  }

  const savedDb = updateDemoDb(current => {
    const nextTicket: Ticket = {
      id: createId('tk'),
      groupId: request.body.groupId,
      title: request.body.title.trim(),
      description: request.body.description?.trim() ?? '',
      status: request.body.status,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
      createdById: creator.id,
      createdByName: creator.name,
      priority: request.body.priority,
      createdAt: new Date().toISOString(),
      dueDate: request.body.dueDate,
      comments: [],
      history: [
        {
          id: createId('th'),
          at: new Date().toISOString(),
          actorName: creator.name,
          action: 'Ticket creado',
        },
      ],
    };

    nextTicket.id = createTicketCode(current.tickets);
    current.tickets.push(nextTicket);
  });

  const createdTicket = resolveTicketUsers(savedDb.tickets.at(-1) as Ticket, savedDb.users);
  return reply.code(201).send(buildEnvelope(201, 'SxTK201', createdTicket, 'Ticket creado correctamente'));
});

app.get<{ Params: TicketParams }>('/tickets/:id', async (request, reply) => {
  const ticket = findTicket(readDemoDb(), request.params.id);
  if (!ticket) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }

  return reply.code(200).send(buildEnvelope(200, 'SxTK200', ticket));
});

app.patch<{ Params: TicketParams; Body: UpdateTicketBody }>('/tickets/:id', { schema: patchTicketSchema }, async (request, reply) => {
  const db = readDemoDb();
  const existingTicket = db.tickets.find(ticket => ticket.id === request.params.id) ?? null;
  if (!existingTicket) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }

  const actor = request.body.actorId
    ? db.users.find(user => user.id === request.body.actorId) ?? null
    : null;
  let assignee: AppUser | null | undefined;
  if (request.body.assigneeId) {
    assignee = db.users.find(user => user.id === request.body.assigneeId) ?? null;
  } else if (request.body.assigneeId === null) {
    assignee = null;
  } else {
    assignee = undefined;
  }

  if (request.body.status && !TICKET_STATUSES.includes(request.body.status as typeof TICKET_STATUSES[number])) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Estado invalido'));
  }
  if (request.body.priority && !TICKET_PRIORITIES.includes(request.body.priority as typeof TICKET_PRIORITIES[number])) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Prioridad invalida'));
  }
  if (assignee && !assignee.groupIds.includes(existingTicket.groupId)) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'El asignado no pertenece al grupo'));
  }

  const savedDb = updateDemoDb(current => {
    const ticket = current.tickets.find(item => item.id === request.params.id);
    if (!ticket) {
      return;
    }

    if (request.body.title?.trim()) ticket.title = request.body.title.trim();
    if (request.body.description !== undefined) ticket.description = request.body.description.trim();
    if (request.body.status) ticket.status = request.body.status;
    if (request.body.priority) ticket.priority = request.body.priority;
    if (request.body.dueDate !== undefined) ticket.dueDate = request.body.dueDate;
    if (request.body.assigneeId !== undefined) {
      ticket.assigneeId = assignee?.id ?? null;
      ticket.assigneeName = assignee?.name ?? null;
    }

    if (actor) {
      ticket.history.push({
        id: createId('th'),
        at: new Date().toISOString(),
        actorName: actor.name,
        action: request.body.action?.trim() || 'Ticket actualizado',
      });
    }
  });

  const updatedTicket = findTicket(savedDb, request.params.id);
  return reply.code(200).send(buildEnvelope(200, 'SxTK200', updatedTicket, 'Ticket actualizado correctamente'));
});

app.delete<{ Params: TicketParams }>('/tickets/:id', async (request, reply) => {
  const db = readDemoDb();
  const exists = db.tickets.some(ticket => ticket.id === request.params.id);
  if (!exists) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }

  updateDemoDb(current => {
    current.tickets = current.tickets.filter(ticket => ticket.id !== request.params.id);
  });

  return reply.code(200).send(buildEnvelope(200, 'SxTK200', { id: request.params.id }, 'Ticket eliminado correctamente'));
});

app.post<{ Params: TicketParams; Body: CommentBody }>('/tickets/:id/comments', { schema: commentSchema }, async (request, reply) => {
  const db = readDemoDb();
  const ticket = db.tickets.find(current => current.id === request.params.id) ?? null;
  const author = db.users.find(current => current.id === request.body.authorId) ?? null;
  if (!ticket) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket no encontrado'));
  }
  if (!author) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Autor no encontrado'));
  }

  const savedDb = updateDemoDb(current => {
    const targetTicket = current.tickets.find(item => item.id === request.params.id);
    if (!targetTicket) {
      return;
    }

    targetTicket.comments.push({
      id: createId('tc'),
      authorId: author.id,
      authorName: author.name,
      message: request.body.message.trim(),
      createdAt: new Date().toISOString(),
    });
    targetTicket.history.push({
      id: createId('th'),
      at: new Date().toISOString(),
      actorName: author.name,
      action: 'Comentario agregado',
    });
  });

  return reply.code(201).send(buildEnvelope(201, 'SxTK201', findTicket(savedDb, request.params.id), 'Comentario agregado correctamente'));
});

app.patch<{ Params: TicketParams; Body: UpdateTicketStatusBody }>('/tickets/:id/status', { schema: moveStatusSchema }, async (request, reply) => {
  const db = readDemoDb();
  const ticket = db.tickets.find(item => item.id === request.params.id) ?? null;
  const authUser = db.users.find(user => user.id === request.body.userId) ?? null;
  if (!ticket || !authUser) {
    return reply.code(404).send(buildEnvelope(404, 'SxTK404', null, 'Ticket o usuario no encontrado'));
  }

  const canMove = hasAnyPermission({ ...authUser, password: authUser.password } as AppUser, request.body.permissions, ticket.groupId);
  const isAssignedToCurrentUser = authUser.isSuperAdmin || ticket.assigneeId === authUser.id;
  if (!canMove || !isAssignedToCurrentUser) {
    return reply.code(403).send(buildEnvelope(403, 'SxTK403', null, 'No autorizado para mover el ticket'));
  }

  if (!TICKET_STATUSES.includes(request.body.status as typeof TICKET_STATUSES[number])) {
    return reply.code(400).send(buildEnvelope(400, 'SxTK400', null, 'Estado invalido'));
  }

  const savedDb = updateDemoDb(current => {
    const targetTicket = current.tickets.find(item => item.id === request.params.id);
    if (!targetTicket) {
      return;
    }

    targetTicket.status = request.body.status;
    targetTicket.history.push({
      id: createId('th'),
      at: new Date().toISOString(),
      actorName: authUser.name,
      action: `Estado actualizado a ${request.body.status}`,
    });
  });

  return reply.code(200).send(buildEnvelope(200, 'SxTK200', findTicket(savedDb, request.params.id), 'Estado actualizado correctamente'));
});

await app.listen({ port: 3002, host: '0.0.0.0' });
