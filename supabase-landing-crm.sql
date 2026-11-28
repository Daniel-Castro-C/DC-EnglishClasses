-- Apply only after approval, before deploying the updated landing.
begin;
create table if not exists public.landing_lead_contacts (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.landing_leads(id) on delete cascade,
 kind text not null check (kind in ('outbound','inbound','note')),
 note text not null default '' check (char_length(note)<=2000),
 created_at timestamptz not null default now()
);
alter table public.landing_lead_contacts enable row level security;
revoke all on public.landing_lead_contacts from public, anon, authenticated;
grant select on public.landing_lead_contacts to authenticated;
grant insert(lead_id,kind,note) on public.landing_lead_contacts to authenticated;
create policy landing_contact_admin_read on public.landing_lead_contacts for select to authenticated
 using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create policy landing_contact_admin_insert on public.landing_lead_contacts for insert to authenticated
 with check (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
create index if not exists landing_contact_lead_created_idx on public.landing_lead_contacts(lead_id,created_at desc);

-- Last actual message, excluding private notes. The server clock controls the 48-hour deadline.
create or replace function public.landing_lead_followups()
returns table(lead_id uuid, last_contact timestamptz, due boolean)
language sql stable security invoker set search_path=''
as $$
 select l.id,c.created_at,(c.kind='outbound' and c.created_at<=now()-interval '48 hours')
 from public.landing_leads l
 cross join lateral (select h.created_at,h.kind from public.landing_lead_contacts h
   where h.lead_id=l.id and h.kind in ('outbound','inbound') order by h.created_at desc,h.id desc limit 1) c
 where l.status in ('novo','contatado') and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin');
$$;
revoke all on function public.landing_lead_followups() from public,anon,authenticated;
grant execute on function public.landing_lead_followups() to authenticated;

-- Source is an allowlisted category; no URLs, campaigns, identifiers or referrer strings.
alter table public.landing_visit_events add column if not exists source text not null default 'unknown';
alter table public.landing_visit_events add constraint landing_visit_source_check
 check (source in ('unknown','direct','instagram','youtube','whatsapp','google','facebook','linkedin','tiktok','referral','other'));
grant insert(source) on public.landing_visit_events to anon, authenticated;
create or replace function public.landing_analytics_sources(p_days integer default 30)
returns table(source text,visits bigint)
language sql stable security invoker set search_path=''
as $$
 select e.source,count(*) from public.landing_visit_events e
 where exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
   and e.kind='landing'
   and e.created_at>=((now() at time zone 'America/Sao_Paulo')::date-(least(90,greatest(1,coalesce(p_days,30)))-1))::timestamp at time zone 'America/Sao_Paulo'
 group by e.source order by count(*) desc,e.source;
$$;
revoke all on function public.landing_analytics_sources(integer) from public,anon,authenticated;
grant execute on function public.landing_analytics_sources(integer) to authenticated;
commit;
