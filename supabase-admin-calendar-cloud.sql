create table if not exists public.admin_calendar_states (
 calendar_key text primary key,
 payload jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 check (calendar_key='global' or calendar_key ~ '^[0-9a-f-]{36}$'),
 check ((calendar_key='global' and jsonb_typeof(payload)='array') or (calendar_key<>'global' and jsonb_typeof(payload)='object'))
);
alter table public.admin_calendar_states enable row level security;
revoke all on public.admin_calendar_states from anon,authenticated;
grant select,insert,update on public.admin_calendar_states to authenticated;
create policy admin_calendar_read on public.admin_calendar_states for select to authenticated using (public.is_admin());
create policy admin_calendar_insert on public.admin_calendar_states for insert to authenticated with check (public.is_admin());
create policy admin_calendar_update on public.admin_calendar_states for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Restore already-synchronized manual dates without deleting existing completion rows.
insert into public.admin_calendar_states(calendar_key,payload)
select student_id::text,jsonb_build_object('events',jsonb_object_agg(lesson_date::text,jsonb_build_object('status','done')))
from public.calendar_completed_days group by student_id on conflict do nothing;
create or replace function public.save_admin_calendar(p_key text,p_payload jsonb,p_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_revision bigint;
begin
 if not public.is_admin() then raise exception 'Access denied'; end if;
 if p_key <> 'global' and not exists(select 1 from public.profiles where id::text=p_key and role='student') then raise exception 'Invalid student'; end if;
 if p_revision=0 then
 insert into public.admin_calendar_states(calendar_key,payload) values(p_key,p_payload) on conflict do nothing returning revision into v_revision;
 else
 update public.admin_calendar_states set payload=p_payload,revision=revision+1,updated_at=now() where calendar_key=p_key and revision=p_revision returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'Calendar conflict: reload before saving' using errcode='40001'; end if;
 if p_key<>'global' then
 insert into public.calendar_completed_days(student_id,lesson_date)
 select p_key::uuid,k::date from jsonb_each(coalesce(p_payload->'events','{}'::jsonb)) as e(k,v)
 where v->>'status'='done' and coalesce(v->>'skip','false')<>'true' on conflict do nothing;
 delete from public.calendar_completed_days c where c.student_id=p_key::uuid and not exists(
 select 1 from jsonb_each(coalesce(p_payload->'events','{}'::jsonb)) as e(k,v)
 where k=c.lesson_date::text and v->>'status'='done' and coalesce(v->>'skip','false')<>'true');
 end if;
 return v_revision;
end $$;
revoke all on function public.save_admin_calendar(text,jsonb,bigint) from public,anon;
grant execute on function public.save_admin_calendar(text,jsonb,bigint) to authenticated;