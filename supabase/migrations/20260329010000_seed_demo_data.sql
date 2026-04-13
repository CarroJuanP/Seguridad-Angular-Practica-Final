-- =============================================================================
-- PRACTICA 2 - Seed demo data (users, groups, memberships, permissions)
-- Must match UUIDs in src/app/models/permissions.model.ts
-- =============================================================================

-- Este seed rellena catalogos y datos demo para que la app pueda operar sin captura manual inicial.

-- ---------------------------------------------------------------------------
-- 0) Compatibility fixes for older schemas
-- ---------------------------------------------------------------------------
alter table if exists public.users
  add column if not exists phone text default '';

alter table if exists public.users
  add column if not exists birth_date text default '2000-01-01';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'birth_date'
      and data_type <> 'text'
  ) then
    execute 'alter table public.users alter column birth_date type text using birth_date::text';
  end if;
end;
$$;

alter table if exists public.users
  add column if not exists address text default '';

alter table if exists public.users
  add column if not exists is_super_admin boolean not null default false;

alter table if exists public.users
  add column if not exists is_active boolean not null default true;

alter table if exists public.groups
  add column if not exists description text default '';

alter table if exists public.groups
  add column if not exists llm_model text default '';

alter table if exists public.groups
  add column if not exists llm_color text default '#3b82f6';

alter table if exists public.groups
  add column if not exists created_by uuid references public.users(id) on delete set null;

alter table if exists public.groups
  add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- 1) Ensure permission catalog includes all keys used by frontend
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('group:view', 'Ver grupos'),
  ('group:add', 'Agregar grupos'),
  ('group:edit', 'Editar grupos'),
  ('group:delete', 'Eliminar grupos'),
  ('group:add:member', 'Agregar miembros a grupo'),
  ('group:remove:member', 'Quitar miembros de grupo'),
  ('group:manage', 'Gestion completa de grupos'),
  ('user:view', 'Ver usuarios'),
  ('user:add', 'Agregar usuarios'),
  ('user:edit', 'Editar usuarios'),
  ('user:edit:profile', 'Editar perfil de usuario'),
  ('user:delete', 'Eliminar usuarios'),
  ('user:assign', 'Asignar usuarios'),
  ('user:view:all', 'Ver todos los usuarios'),
  ('user:edit:permissions', 'Editar permisos de usuario'),
  ('user:deactivate', 'Desactivar usuarios'),
  ('user:activate', 'Activar usuarios'),
  ('user:manage', 'Gestion completa de usuarios'),
  ('ticket:view', 'Ver tickets'),
  ('ticket:add', 'Agregar tickets'),
  ('ticket:edit', 'Editar tickets'),
  ('ticket:delete', 'Eliminar tickets'),
  ('ticket:edit:state', 'Editar estado del ticket'),
  ('ticket:edit:comment', 'Comentar ticket'),
  ('ticket:edit:priority', 'Editar prioridad del ticket'),
  ('ticket:edit:deadline', 'Editar fecha limite del ticket'),
  ('ticket:edit:assign', 'Reasignar ticket'),
  ('ticket:manage', 'Gestion completa de tickets')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Ensure ticket catalogs match UI labels
-- ---------------------------------------------------------------------------
alter table if exists public.ticket_statuses
  add column if not exists sort_order int not null default 0;

alter table if exists public.ticket_priorities
  add column if not exists sort_order int not null default 0;

insert into public.ticket_statuses (name, sort_order) values
  ('Pendiente', 1),
  ('En progreso', 2),
  ('Revision', 3),
  ('Hecho', 4),
  ('Bloqueado', 5)
on conflict (name) do nothing;

insert into public.ticket_priorities (name, sort_order) values
  ('Critica', 1),
  ('Muy alta', 2),
  ('Alta', 3),
  ('Media', 4),
  ('Baja', 5),
  ('Muy baja', 6),
  ('Bloqueado', 7)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Seed demo users
-- ---------------------------------------------------------------------------
with seed_users (
  id, full_name, username, email, password_hash, phone, birth_date, address, is_super_admin, is_active
) as (
  values
    ('b2c3d4e5-f6a1-0000-0000-000000000001'::uuid, 'Super Admin', 'superadmin', 'superadmin@local', 'Admin@12345', '5551000001', '1990-01-01', 'Centro de operaciones', true, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000002'::uuid, 'Juan Pablo Carrillo Rodriguez', 'carrillo', '2023371057@uteq.edu.mx', 'Admin@12345', '5551000002', '2002-03-14', 'Queretaro', false, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000003'::uuid, 'Admin Marher', 'admin', 'admin@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', true, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000004'::uuid, 'Project Manager', 'pm', 'pm@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', false, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000005'::uuid, 'Developer', 'dev', 'dev@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', false, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000006'::uuid, 'Support', 'support', 'support@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', false, true)
)
update public.users u
set
  full_name = s.full_name,
  username = s.username,
  email = s.email,
  password_hash = s.password_hash,
  phone = s.phone,
  birth_date = s.birth_date,
  address = s.address,
  is_super_admin = s.is_super_admin,
  is_active = s.is_active
from seed_users s
where u.id = s.id or u.email = s.email or u.username = s.username;

with seed_users (
  id, full_name, username, email, password_hash, phone, birth_date, address, is_super_admin, is_active
) as (
  values
    ('b2c3d4e5-f6a1-0000-0000-000000000001'::uuid, 'Super Admin', 'superadmin', 'superadmin@local', 'Admin@12345', '5551000001', '1990-01-01', 'Centro de operaciones', true, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000002'::uuid, 'Juan Pablo Carrillo Rodriguez', 'carrillo', '2023371057@uteq.edu.mx', 'Admin@12345', '5551000002', '2002-03-14', 'Queretaro', false, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000003'::uuid, 'Admin Marher', 'admin', 'admin@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', true, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000004'::uuid, 'Project Manager', 'pm', 'pm@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', false, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000005'::uuid, 'Developer', 'dev', 'dev@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', false, true),
    ('b2c3d4e5-f6a1-0000-0000-000000000006'::uuid, 'Support', 'support', 'support@marher.com', '$p4$ww0rD1234', '', '1990-01-01', '', false, true)
)
insert into public.users (
  id, full_name, username, email, password_hash, phone, birth_date, address, is_super_admin, is_active
)
select
  s.id, s.full_name, s.username, s.email, s.password_hash, s.phone, s.birth_date, s.address, s.is_super_admin, s.is_active
from seed_users s
where not exists (
  select 1
  from public.users u
  where u.id = s.id or u.email = s.email or u.username = s.username
);

-- ---------------------------------------------------------------------------
-- 4) Seed demo groups
-- ---------------------------------------------------------------------------
insert into public.groups (id, name, description, llm_model, llm_color, created_by, is_active) values
  (
    'a1b2c3d4-e5f6-0000-0000-000000000001',
    'ERP Finanzas',
    'Flujos financieros, facturacion y reportes contables.',
    'Perfil Financiero',
    '#0d3b66',
    (select id from public.users where email = 'superadmin@local' limit 1),
    true
  ),
  (
    'a1b2c3d4-e5f6-0000-0000-000000000002',
    'Mesa de Soporte',
    'Seguimiento de incidencias operativas y SLA.',
    'Perfil Operativo',
    '#6d597a',
    (select id from public.users where email = 'superadmin@local' limit 1),
    true
  ),
  (
    'a1b2c3d4-e5f6-0000-0000-000000000003',
    'BI Analitica',
    'Analitica, dashboards ejecutivos y calidad de datos.',
    'Perfil Analitico',
    '#2a9d8f',
    (select id from public.users where email = 'superadmin@local' limit 1),
    true
  )
on conflict (name) do update set
  description = excluded.description,
  llm_model = excluded.llm_model,
  llm_color = excluded.llm_color,
  created_by = excluded.created_by,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 5) Seed memberships (resolved by current IDs in DB)
-- ---------------------------------------------------------------------------
with members(group_name, user_email) as (
  values
    ('ERP Finanzas', 'superadmin@local'),
    ('Mesa de Soporte', 'superadmin@local'),
    ('BI Analitica', 'superadmin@local'),
    ('Mesa de Soporte', '2023371057@uteq.edu.mx'),
    ('ERP Finanzas', 'admin@marher.com'),
    ('Mesa de Soporte', 'admin@marher.com'),
    ('BI Analitica', 'admin@marher.com'),
    ('ERP Finanzas', 'pm@marher.com'),
    ('Mesa de Soporte', 'pm@marher.com'),
    ('BI Analitica', 'pm@marher.com'),
    ('ERP Finanzas', 'dev@marher.com'),
    ('Mesa de Soporte', 'dev@marher.com'),
    ('BI Analitica', 'dev@marher.com'),
    ('Mesa de Soporte', 'support@marher.com')
)
insert into public.group_members (group_id, user_id)
select g.id, u.id
from members m
join public.groups g on g.name = m.group_name
join public.users u on u.email = m.user_email
on conflict (group_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6) Seed user_group_permissions
-- ---------------------------------------------------------------------------
with
all_permissions as (
  select id as permission_id from public.permissions
),
all_groups as (
  select id as group_id from public.groups where name in ('ERP Finanzas', 'Mesa de Soporte', 'BI Analitica')
),
users_map as (
  select email, id as user_id
  from public.users
  where email in (
    'superadmin@local',
    '2023371057@uteq.edu.mx',
    'admin@marher.com',
    'pm@marher.com',
    'dev@marher.com',
    'support@marher.com'
  )
),
custom_grants as (
  -- Carrillo in support
  select
    (select user_id from users_map where email = '2023371057@uteq.edu.mx' limit 1) as user_id,
    (select id from public.groups where name = 'Mesa de Soporte' limit 1) as group_id,
    unnest(array[
      'group:view', 'group:add',
      'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:edit:state', 'ticket:edit:comment'
    ]) as permission_key

  union all

  -- PM in all groups
  select
    (select user_id from users_map where email = 'pm@marher.com' limit 1),
    g.group_id,
    unnest(array[
      'user:view', 'user:edit:profile',
      'group:view', 'group:add', 'group:edit', 'group:delete', 'group:manage',
      'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:delete',
      'ticket:edit:state', 'ticket:edit:comment', 'ticket:manage'
    ])
  from all_groups g

  union all

  -- DEV in all groups
  select
    (select user_id from users_map where email = 'dev@marher.com' limit 1),
    g.group_id,
    unnest(array[
      'user:view', 'user:edit:profile',
      'group:view',
      'ticket:view', 'ticket:add', 'ticket:edit', 'ticket:edit:state', 'ticket:edit:comment'
    ])
  from all_groups g

  union all

  -- Support user in support group
  select
    (select user_id from users_map where email = 'support@marher.com' limit 1),
    (select id from public.groups where name = 'Mesa de Soporte' limit 1),
    unnest(array[
      'user:view', 'user:edit:profile', 'group:view',
      'ticket:view', 'ticket:add', 'ticket:edit:comment'
    ])
)
insert into public.user_group_permissions (group_id, user_id, permission_id, granted_by)
select
  g.group_id,
  (select user_id from users_map where email = 'superadmin@local' limit 1),
  p.permission_id,
  (select user_id from users_map where email = 'superadmin@local' limit 1)
from all_groups g
cross join all_permissions p

union all

-- Admin Marher with all permissions in all groups
select
  g.group_id,
  (select user_id from users_map where email = 'admin@marher.com' limit 1),
  p.permission_id,
  (select user_id from users_map where email = 'superadmin@local' limit 1)
from all_groups g
cross join all_permissions p

union all

-- Custom grants for non-admin users
select
  cg.group_id,
  cg.user_id,
  p.id as permission_id,
  (select user_id from users_map where email = 'superadmin@local' limit 1)
from custom_grants cg
join public.permissions p on p.key = cg.permission_key
where cg.group_id is not null and cg.user_id is not null
on conflict (group_id, user_id, permission_id) do nothing;
