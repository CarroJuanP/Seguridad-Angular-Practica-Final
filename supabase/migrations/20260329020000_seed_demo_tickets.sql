-- =============================================================================
-- PRACTICA 2 - Seed demo tickets
-- Creates sample tickets for the 3 demo groups if they do not exist
-- =============================================================================

with refs as (
  select
    (select id from public.groups where name = 'ERP Finanzas' limit 1) as g_erp,
    (select id from public.groups where name = 'Mesa de Soporte' limit 1) as g_support,
    (select id from public.groups where name = 'BI Analitica' limit 1) as g_bi,
    (select id from public.users where email = 'admin@marher.com' limit 1) as u_admin,
    (select id from public.users where email = 'pm@marher.com' limit 1) as u_pm,
    (select id from public.users where email = 'dev@marher.com' limit 1) as u_dev,
    (select id from public.users where email = 'support@marher.com' limit 1) as u_support,
    (select id from public.ticket_statuses where name = 'Pendiente' limit 1) as s_pending,
    (select id from public.ticket_statuses where name = 'En progreso' limit 1) as s_progress,
    (select id from public.ticket_statuses where name = 'Revision' limit 1) as s_review,
    (select id from public.ticket_priorities where name = 'Alta' limit 1) as p_high,
    (select id from public.ticket_priorities where name = 'Media' limit 1) as p_medium,
    (select id from public.ticket_priorities where name = 'Muy alta' limit 1) as p_very_high
),
demo_tickets as (
  select * from (
    values
      ('TK-10001', 'ERP corte mensual no cuadra', 'Revisar descuadre en conciliacion bancaria.', 'ERP Finanzas'),
      ('TK-10002', 'Error al generar reporte SLA', 'El reporte de SLA no muestra datos del dia actual.', 'Mesa de Soporte'),
      ('TK-10003', 'Dashboard ventas con metricas inconsistentes', 'KPI de conversion no coincide con fuente operativa.', 'BI Analitica')
  ) as t(code, title, description, group_name)
)
insert into public.tickets (
  code,
  group_id,
  title,
  description,
  created_by,
  assignee_id,
  status_id,
  priority_id,
  due_date
)
select
  dt.code,
  case dt.group_name
    when 'ERP Finanzas' then r.g_erp
    when 'Mesa de Soporte' then r.g_support
    when 'BI Analitica' then r.g_bi
  end as group_id,
  dt.title,
  dt.description,
  coalesce(r.u_admin, r.u_pm, r.u_dev, r.u_support) as created_by,
  case dt.group_name
    when 'ERP Finanzas' then coalesce(r.u_pm, r.u_admin)
    when 'Mesa de Soporte' then coalesce(r.u_support, r.u_admin)
    when 'BI Analitica' then coalesce(r.u_dev, r.u_admin)
  end as assignee_id,
  case dt.group_name
    when 'ERP Finanzas' then coalesce(r.s_pending, r.s_progress, r.s_review)
    when 'Mesa de Soporte' then coalesce(r.s_progress, r.s_pending, r.s_review)
    when 'BI Analitica' then coalesce(r.s_review, r.s_progress, r.s_pending)
  end as status_id,
  case dt.group_name
    when 'ERP Finanzas' then coalesce(r.p_very_high, r.p_high, r.p_medium)
    when 'Mesa de Soporte' then coalesce(r.p_high, r.p_medium, r.p_very_high)
    when 'BI Analitica' then coalesce(r.p_medium, r.p_high, r.p_very_high)
  end as priority_id,
  (current_date + interval '7 days')::date as due_date
from demo_tickets dt
cross join refs r
where not exists (
  select 1 from public.tickets t where t.code = dt.code
);

-- Initial history entries for seeded tickets
insert into public.ticket_history (ticket_id, actor_id, action)
select
  t.id,
  coalesce(r.u_admin, r.u_pm, r.u_dev, r.u_support) as actor_id,
  'Ticket demo creado por seed'
from public.tickets t
cross join (
  select
    (select id from public.users where email = 'admin@marher.com' limit 1) as u_admin,
    (select id from public.users where email = 'pm@marher.com' limit 1) as u_pm,
    (select id from public.users where email = 'dev@marher.com' limit 1) as u_dev,
    (select id from public.users where email = 'support@marher.com' limit 1) as u_support
) r
where t.code in ('TK-10001', 'TK-10002', 'TK-10003')
  and not exists (
    select 1
    from public.ticket_history h
    where h.ticket_id = t.id and h.action = 'Ticket demo creado por seed'
  );
