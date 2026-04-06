/*Crear usuario:*/
insert into users (full_name, username, email, password_hash, phone, birth_date, address, is_super_admin)
values ('Juan Pablo Carrillo Rodriguez', 'carrillo', '2023371057@uteq.edu.mx', 'HASH_AQUI', '5551000002', '2002-03-14', 'Queretaro', false)
returning *;

/*Leer usuarios:*/
select id, full_name, username, email, phone, is_super_admin, is_active, last_login, created_at
from users
order by created_at desc;

/*Leer 1 usuario:*/
select *
from users
where id = 'UUID_USER';

/*Actualizar usuario:*/
update users
set full_name = 'Nuevo Nombre',
    phone = '5550001111',
    address = 'Nueva direccion',
    is_active = true
where id = 'UUID_USER'
returning *;

/*Eliminar usuario:*/
delete from users
where id = 'UUID_USER';



---



/*Crear grupo:*/
insert into groups (name, description, llm_model, llm_color, created_by)
values ('Mesa de Soporte', 'Seguimiento de incidencias operativas y SLA.', 'Perfil Operativo', '#6d597a', 'UUID_USER_CREATOR')
returning *;

/*Leer grupos:*/
select g.*, u.full_name as creator_name
from groups g
join users u on u.id = g.created_by
order by g.created_at desc;

/*Leer grupos de un usuario:*/
select g.*
from groups g
join group_members gm on gm.group_id = g.id
where gm.user_id = 'UUID_USER'
order by g.name;

/*Actualizar grupo:*/
update groups
set name = 'Mesa de Soporte N1',
    description = 'Incidencias N1',
    llm_model = 'Perfil Operativo',
    llm_color = '#5a4b81'
where id = 'UUID_GROUP'
returning *;

/*Eliminar grupo:*/
delete from groups
where id = 'UUID_GROUP';

/*Agregar usuario a grupo:*/
insert into group_members (group_id, user_id)
values ('UUID_GROUP', 'UUID_USER')
on conflict do nothing;

/*Quitar usuario de grupo:*/
delete from group_members
where group_id = 'UUID_GROUP'
and user_id = 'UUID_USER';



---



/*Crear permiso:*/
insert into permissions (key, description)
values ('report:view', 'View reports')
returning *;

/*Leer permisos:*/
select * from permissions order by key;

/*Actualizar permiso:*/
update permissions
set description = 'View and list reports'
where key = 'report:view'
returning *;

/*Eliminar permiso:*/
delete from permissions
where key = 'report:view';

/*Asignar permiso a usuario en grupo:*/
insert into user_group_permissions (group_id, user_id, permission_id, granted_by)
values (
  'UUID_GROUP',
  'UUID_USER',
  (select id from permissions where key = 'ticket:edit'),
  'UUID_ADMIN'
)
on conflict do nothing;

/*Revocar permiso:*/
delete from user_group_permissions
where group_id = 'UUID_GROUP'
and user_id = 'UUID_USER'
and permission_id = (select id from permissions where key = 'ticket:edit');

/*Obtener permisos efectivos:*/
select p.key
from user_group_permissions ugp
join permissions p on p.id = ugp.permission_id
where ugp.user_id = 'UUID_USER'
and ugp.group_id = 'UUID_GROUP'
order by p.key;



---



/*Crear ticket:*/
insert into tickets (
  code, group_id, title, description, created_by, assignee_id, status_id, priority_id, due_date
)
values (
  'TK-1001',
  'UUID_GROUP',
  'Error en login de usuarios remotos',
  'Usuarios con VPN reportan timeout al autenticar',
  'UUID_CREATOR',
  'UUID_ASSIGNEE',
  (select id from ticket_statuses where name = 'Pendiente'),
  (select id from ticket_priorities where name = 'Alta'),
  '2026-04-10'
)
returning *;

/*Leer tickets por grupo:*/
select
  t.id, t.code, t.title, t.description, t.created_at, t.due_date, t.closed_at,
  ts.name as status_name,
  tp.name as priority_name,
  uc.full_name as creator_name,
  ua.full_name as assignee_name
from tickets t
join ticket_statuses ts on ts.id = t.status_id
join ticket_priorities tp on tp.id = t.priority_id
join users uc on uc.id = t.created_by
left join users ua on ua.id = t.assignee_id
where t.group_id = 'UUID_GROUP'
order by t.created_at desc;

/*Leer 1 ticket:*/
select *
from tickets
where id = 'UUID_TICKET';

/*Actualizar ticket:*/
update tickets
set title = 'Titulo actualizado',
    description = 'Descripcion actualizada',
    assignee_id = 'UUID_ASSIGNEE',
    status_id = (select id from ticket_statuses where name = 'En progreso'),
    priority_id = (select id from ticket_priorities where name = 'Critica'),
    due_date = '2026-04-15'
where id = 'UUID_TICKET'
returning *;

/*Cerrar ticket:*/
update tickets
set status_id = (select id from ticket_statuses where name = 'Hecho'),
    closed_at = now()
where id = 'UUID_TICKET'
returning *;

/*Eliminar ticket:*/
delete from tickets
where id = 'UUID_TICKET';

/*Agregar comentario:*/
insert into ticket_comments (ticket_id, author_id, message)
values ('UUID_TICKET', 'UUID_USER', 'Comentario de avance')
returning *;

/*Historial:*/
insert into ticket_history (ticket_id, actor_id, action)
values ('UUID_TICKET', 'UUID_USER', 'Estado movido a En progreso');

