-- Migracion inicial dedicada solo a la tabla users y a su trigger/policies basicos.
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text not null,
  email text not null unique,
  password_hash text not null,
  phone text,
  birth_date date,
  address text,
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Allow anon read users'
  ) then
    create policy "Allow anon read users"
      on public.users
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Allow anon insert users'
  ) then
    create policy "Allow anon insert users"
      on public.users
      for insert
      to anon
      with check (true);
  end if;
end;
$$;
