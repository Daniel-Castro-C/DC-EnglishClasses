-- Anonymous, write-only events; no IP, cookie identifier, user ID, URL or personal data.
-- The tracking_start row is created only by this migration.
create table public.landing_visit_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('landing','portal','tracking_start')),
  created_at timestamptz not null default now()
);
alter table public.landing_visit_events enable row level security;
revoke all on public.landing_visit_events from anon, authenticated;
grant insert(kind) on public.landing_visit_events to anon, authenticated;
grant select on public.landing_visit_events to authenticated;
create policy landing_visit_public_insert on public.landing_visit_events
  for insert to anon, authenticated with check (kind in ('landing','portal'));
create policy landing_visit_admin_select on public.landing_visit_events
  for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create index landing_visit_events_created_kind_idx on public.landing_visit_events (created_at,kind);
insert into public.landing_visit_events(kind) values ('tracking_start');

-- Use the authenticated administrator's own permissions, not security definer.
-- The cutoff excludes historical leads recorded before this feature existed.
create function public.landing_analytics_daily(p_days integer default 30)
returns table(day date, landing_visits bigint, portal_visits bigint, forms bigint, tracking_start timestamptz)
language sql stable security invoker set search_path = ''
as $$
  with access as (
    select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin') allowed
  ), bounds as (
    select min(e.created_at) filter(where e.kind='tracking_start') started,
      (now() at time zone 'America/Sao_Paulo')::date today
    from public.landing_visit_events e,access a where a.allowed
  ), window_start as (
    select started,today,greatest((started at time zone 'America/Sao_Paulo')::date,
      today-(least(90,greatest(1,coalesce(p_days,30)))-1)) first_day
    from bounds where started is not null
  ), visits as (
    select (e.created_at at time zone 'America/Sao_Paulo')::date d,
      count(*) filter(where e.kind='landing') landing_count,
      count(*) filter(where e.kind='portal') portal_count
    from public.landing_visit_events e cross join window_start w
    where e.created_at>=greatest(w.started,w.first_day::timestamp at time zone 'America/Sao_Paulo')
      and e.kind in ('landing','portal')
    group by 1
  ), submissions as (
    select (l.created_at at time zone 'America/Sao_Paulo')::date d,count(*) n
    from public.landing_leads l cross join window_start w
    where l.source='landing'
      and l.created_at>=greatest(w.started,w.first_day::timestamp at time zone 'America/Sao_Paulo')
    group by 1
  )
  select (w.first_day+i)::date,coalesce(v.landing_count,0),coalesce(v.portal_count,0),
    coalesce(s.n,0),w.started
  from window_start w cross join lateral generate_series(0,w.today-w.first_day) i
  left join visits v on v.d=w.first_day+i
  left join submissions s on s.d=w.first_day+i
  order by 1;
$$;
revoke all on function public.landing_analytics_daily(integer) from public, anon, authenticated;
grant execute on function public.landing_analytics_daily(integer) to authenticated;
