-- Observabilidad del API Gateway: logs centralizados y métricas simples.

create table if not exists public.gateway_request_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  method text not null,
  user_id uuid references public.users(id) on delete set null,
  ip_address text,
  status_code integer not null,
  int_op_code text,
  duration_ms integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.endpoint_metrics (
  method text not null,
  endpoint text not null,
  request_count integer not null default 0,
  total_duration_ms bigint not null default 0,
  average_duration_ms numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (method, endpoint)
);

alter table public.gateway_request_logs enable row level security;
alter table public.endpoint_metrics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gateway_request_logs' and policyname = 'anon_select_gateway_request_logs'
  ) then
    create policy "anon_select_gateway_request_logs"
      on public.gateway_request_logs for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gateway_request_logs' and policyname = 'anon_insert_gateway_request_logs'
  ) then
    create policy "anon_insert_gateway_request_logs"
      on public.gateway_request_logs for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'endpoint_metrics' and policyname = 'anon_select_endpoint_metrics'
  ) then
    create policy "anon_select_endpoint_metrics"
      on public.endpoint_metrics for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'endpoint_metrics' and policyname = 'anon_insert_endpoint_metrics'
  ) then
    create policy "anon_insert_endpoint_metrics"
      on public.endpoint_metrics for insert to anon with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'endpoint_metrics' and policyname = 'anon_update_endpoint_metrics'
  ) then
    create policy "anon_update_endpoint_metrics"
      on public.endpoint_metrics for update to anon using (true);
  end if;
end;
$$;
