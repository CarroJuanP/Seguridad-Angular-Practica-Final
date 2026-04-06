-- =============================================================================
-- PRACTICA 2 - Verification queries for demo seed
-- Run section by section in Supabase SQL Editor
-- =============================================================================

-- 1) Basic counts
select 'users' as table_name, count(*) as total from public.users
union all
select 'groups', count(*) from public.groups
union all
select 'group_members', count(*) from public.group_members
union all
select 'permissions', count(*) from public.permissions
union all
select 'user_group_permissions', count(*) from public.user_group_permissions
union all
select 'ticket_statuses', count(*) from public.ticket_statuses
union all
select 'ticket_priorities', count(*) from public.ticket_priorities
union all
select 'tickets', count(*) from public.tickets
union all
select 'ticket_comments', count(*) from public.ticket_comments
union all
select 'ticket_history', count(*) from public.ticket_history;

-- 2) Demo users expected in DB
select id, full_name, username, email, is_super_admin, is_active
from public.users
where email in (
  'superadmin@local',
  '2023371057@uteq.edu.mx',
  'admin@marher.com',
  'pm@marher.com',
  'dev@marher.com',
  'support@marher.com'
)
order by email;

-- 3) Demo groups expected in DB
select id, name, description, llm_model, llm_color, is_active
from public.groups
where name in ('ERP Finanzas', 'Mesa de Soporte', 'BI Analitica')
order by name;

-- 4) Memberships by group
select
  g.name as group_name,
  u.email,
  u.username,
  u.full_name
from public.group_members gm
join public.groups g on g.id = gm.group_id
join public.users u on u.id = gm.user_id
where g.name in ('ERP Finanzas', 'Mesa de Soporte', 'BI Analitica')
order by g.name, u.email;

-- 5) Permission totals by user and group
select
  g.name as group_name,
  u.email,
  count(*) as granted_permissions
from public.user_group_permissions ugp
join public.groups g on g.id = ugp.group_id
join public.users u on u.id = ugp.user_id
where g.name in ('ERP Finanzas', 'Mesa de Soporte', 'BI Analitica')
  and u.email in (
    'superadmin@local',
    '2023371057@uteq.edu.mx',
    'admin@marher.com',
    'pm@marher.com',
    'dev@marher.com',
    'support@marher.com'
  )
group by g.name, u.email
order by g.name, u.email;

-- 6) Full permission detail for one user (change email if needed)
select
  u.email,
  g.name as group_name,
  p.key as permission_key
from public.user_group_permissions ugp
join public.users u on u.id = ugp.user_id
join public.groups g on g.id = ugp.group_id
join public.permissions p on p.id = ugp.permission_id
where u.email = '2023371057@uteq.edu.mx'
order by g.name, p.key;

-- 7) Ticket catalogs used by the frontend
select id, name, sort_order
from public.ticket_statuses
order by sort_order, name;

select id, name, sort_order
from public.ticket_priorities
order by sort_order, name;

-- 8) Optional: create one smoke test ticket manually in app, then run this
select
  t.id,
  t.code,
  g.name as group_name,
  t.title,
  creator.email as created_by_email,
  assignee.email as assignee_email,
  ts.name as status_name,
  tp.name as priority_name,
  t.created_at,
  t.updated_at
from public.tickets t
join public.groups g on g.id = t.group_id
join public.users creator on creator.id = t.created_by
left join public.users assignee on assignee.id = t.assignee_id
join public.ticket_statuses ts on ts.id = t.status_id
join public.ticket_priorities tp on tp.id = t.priority_id
order by t.created_at desc;

-- 9) Optional: verify comments and history after editing/commenting in app
select * from public.ticket_comments order by created_at desc;
select * from public.ticket_history order by created_at desc;
