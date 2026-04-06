-- =============================================================================
-- PRACTICA 2 - Migración completa de todas las tablas base
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- Orden: users → groups → group_members → permissions →
--        user_group_permissions → tickets (+ auxiliares)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensiones
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid        primary key default gen_random_uuid(),
  full_name     text        not null,
  username      text        not null,
  email         text        not null unique,
  password_hash text        not null,
  phone         text        default '',
  birth_date    text        default '2000-01-01',
  address       text        default '',
  is_super_admin boolean   not null default false,
  is_active     boolean     not null default true,
  last_login    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. GROUPS
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text        default '',
  llm_model   text        default '',
  llm_color   text        default '#3b82f6',
  created_by  uuid        references public.users(id) on delete set null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. GROUP_MEMBERS  (relación n:m usuarios ↔ grupos)
-- ---------------------------------------------------------------------------
create table if not exists public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.users(id)  on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 4. PERMISSIONS  (catálogo de claves de permiso)
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,   -- ej: "ticket:edit", "user:view"
  description text default ''
);

-- Permisos base que usa la app
insert into public.permissions (key, description) values
  ('ticket:view',       'Ver tickets del grupo')          on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('ticket:create',     'Crear nuevos tickets')           on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('ticket:edit',       'Editar tickets existentes')      on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('ticket:delete',     'Eliminar tickets')               on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('ticket:close',      'Cerrar tickets')                 on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('ticket:assign',     'Asignar tickets a usuarios')     on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('user:view',         'Ver lista de usuarios')          on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('user:create',       'Crear usuarios')                 on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('user:edit',         'Editar usuarios')                on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('user:delete',       'Eliminar usuarios')              on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('group:view',        'Ver grupos')                     on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('group:create',      'Crear grupos')                   on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('group:edit',        'Editar grupos')                  on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('group:delete',      'Eliminar grupos')                on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('report:view',       'Ver reportes')                   on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('profile:view',      'Ver perfil propio')              on conflict (key) do nothing;
insert into public.permissions (key, description) values
  ('profile:edit',      'Editar perfil propio')           on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 5. USER_GROUP_PERMISSIONS  (permisos efectivos por usuario + grupo)
-- ---------------------------------------------------------------------------
create table if not exists public.user_group_permissions (
  id            uuid        primary key default gen_random_uuid(),
  group_id      uuid        not null references public.groups(id)      on delete cascade,
  user_id       uuid        not null references public.users(id)       on delete cascade,
  permission_id uuid        not null references public.permissions(id) on delete cascade,
  granted_by    uuid        references public.users(id) on delete set null,
  granted_at    timestamptz not null default now(),
  unique (group_id, user_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- 6. TICKET_STATUSES  (catálogo)
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_statuses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0
);

insert into public.ticket_statuses (name, sort_order) values
  ('Pendiente',   1),
  ('En progreso', 2),
  ('En revisión', 3),
  ('Hecho',       4),
  ('Cancelado',   5)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 7. TICKET_PRIORITIES  (catálogo)
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_priorities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0
);

insert into public.ticket_priorities (name, sort_order) values
  ('Baja',    1),
  ('Media',   2),
  ('Alta',    3),
  ('Crítica', 4)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 8. TICKETS
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,   -- ej: "TK-1001"
  group_id    uuid        not null references public.groups(id)           on delete cascade,
  title       text        not null,
  description text        default '',
  created_by  uuid        not null references public.users(id)            on delete restrict,
  assignee_id uuid        references public.users(id)                     on delete set null,
  status_id   uuid        not null references public.ticket_statuses(id)  on delete restrict,
  priority_id uuid        not null references public.ticket_priorities(id) on delete restrict,
  due_date    date,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 9. TICKET_COMMENTS
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id         uuid        primary key default gen_random_uuid(),
  ticket_id  uuid        not null references public.tickets(id) on delete cascade,
  author_id  uuid        not null references public.users(id)   on delete restrict,
  message    text        not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10. TICKET_HISTORY  (auditoría de cambios)
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_history (
  id         uuid        primary key default gen_random_uuid(),
  ticket_id  uuid        not null references public.tickets(id) on delete cascade,
  actor_id   uuid        not null references public.users(id)   on delete restrict,
  action     text        not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. TRIGGER updated_at (reutilizable)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at       on public.users;
drop trigger if exists trg_groups_updated_at      on public.groups;
drop trigger if exists trg_tickets_updated_at     on public.tickets;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create trigger trg_tickets_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------
alter table public.users                  enable row level security;
alter table public.groups                 enable row level security;
alter table public.group_members          enable row level security;
alter table public.permissions            enable row level security;
alter table public.user_group_permissions enable row level security;
alter table public.ticket_statuses        enable row level security;
alter table public.ticket_priorities      enable row level security;
alter table public.tickets                enable row level security;
alter table public.ticket_comments        enable row level security;
alter table public.ticket_history         enable row level security;

-- Policies: anon puede leer y escribir (demo app sin Auth de Supabase)
do $$
declare
  tbls text[] := array[
    'users', 'groups', 'group_members', 'permissions',
    'user_group_permissions', 'ticket_statuses', 'ticket_priorities',
    'tickets', 'ticket_comments', 'ticket_history'
  ];
  t text;
begin
  foreach t in array tbls loop
    -- SELECT
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'anon_select_' || t
    ) then
      execute format(
        'create policy "anon_select_%I" on public.%I for select to anon using (true)',
        t, t
      );
    end if;

    -- INSERT
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'anon_insert_' || t
    ) then
      execute format(
        'create policy "anon_insert_%I" on public.%I for insert to anon with check (true)',
        t, t
      );
    end if;

    -- UPDATE
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'anon_update_' || t
    ) then
      execute format(
        'create policy "anon_update_%I" on public.%I for update to anon using (true)',
        t, t
      );
    end if;

    -- DELETE
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'anon_delete_' || t
    ) then
      execute format(
        'create policy "anon_delete_%I" on public.%I for delete to anon using (true)',
        t, t
      );
    end if;
  end loop;
end;
$$;
