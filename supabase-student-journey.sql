-- New notification categories and explicitly published annual snapshots.
begin;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
 check(type in ('new_lesson','new_material','new_report','daniel_answered','text_corrected'));
-- Existing new_lesson rows remain readable for compatibility; from now on notify only on actual files.
create or replace function public.portal_skip_legacy_lesson_notification()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.type='new_lesson' then return null; end if;
 return new;
end;
$$;
revoke all on function public.portal_skip_legacy_lesson_notification() from public,anon,authenticated;
create trigger portal_skip_legacy_lesson_notification before insert on public.notifications
 for each row execute function public.portal_skip_legacy_lesson_notification();
create or replace function public.portal_notify_resource()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.file_path is not distinct from old.file_path and new.type is not distinct from old.type then return new; end if;
 insert into public.notifications(student_id,type)
 select l.student_id,case when new.type='rep' then 'new_report' else 'new_material' end
 from public.lessons l where l.id=new.lesson_id;
 return new;
end;
$$;
revoke all on function public.portal_notify_resource() from public,anon,authenticated;
create trigger portal_notify_resource after insert or update of file_path,type on public.resources
 for each row execute function public.portal_notify_resource();

create table public.student_retrospectives (
 student_id uuid not null references public.profiles(id) on delete cascade,
 year integer not null check(year between 2000 and 2100),
 stats jsonb not null,
 published boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(student_id,year)
);
alter table public.student_retrospectives enable row level security;
revoke all on public.student_retrospectives from public,anon,authenticated;
grant select,insert,update on public.student_retrospectives to authenticated;
create policy retrospective_read on public.student_retrospectives for select to authenticated
 using(public.is_admin() or (student_id=(select auth.uid()) and published));
create policy retrospective_insert on public.student_retrospectives for insert to authenticated
 with check(public.is_admin());
create policy retrospective_update on public.student_retrospectives for update to authenticated
 using(public.is_admin()) with check(public.is_admin());

create or replace function public.admin_retrospective_stats(p_student uuid,p_year integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare first_day date; next_year date; result jsonb;
begin
 if not public.is_admin() or p_year not between 2000 and 2100 or not exists(select 1 from public.profiles p where p.id=p_student and p.role='student') then
  raise exception 'Acesso ou ano inválido'; end if;
 first_day=make_date(p_year,1,1);next_year=make_date(p_year+1,1,1);
 with all_completed as (
   select coalesce(l.lesson_date,(l.created_at at time zone 'America/Sao_Paulo')::date) d
   from public.lessons l where l.student_id=p_student and coalesce(l.calendar_status,'done')='done'
   union all select c.lesson_date from public.calendar_completed_days c where c.student_id=p_student
   and not exists(select 1 from public.lessons l where l.student_id=c.student_id and l.lesson_date=c.lesson_date)
 ), counts as(select count(*) filter(where d<first_day) before_year,count(*) filter(where d<next_year) through_year,count(*) filter(where d>=first_day and d<next_year) in_year from all_completed)
 select jsonb_build_object(
  'completed',in_year,
  'saved',(select count(*) from public.word_of_day_answers w where w.student_id=p_student and w.answer='nao_uso' and (w.updated_at at time zone 'America/Sao_Paulo')::date>=first_day and (w.updated_at at time zone 'America/Sao_Paulo')::date<next_year),
  'guides',(select count(*) from public.grammar_material_status g where g.student_id=p_student and g.status='estudado' and (g.updated_at at time zone 'America/Sao_Paulo')::date>=first_day and (g.updated_at at time zone 'America/Sao_Paulo')::date<next_year),
  'badges',(select count(*) from unnest(array[10,30,50,100,150,200]) b where b>before_year and b<=through_year),
  'grammarUnlocked',coalesce((select value='false' from public.app_settings where key='grammar_guides_locked'),false)
 ) into result from counts;
 return result;
end;
$$;
revoke all on function public.admin_retrospective_stats(uuid,integer) from public,anon,authenticated;
grant execute on function public.admin_retrospective_stats(uuid,integer) to authenticated;
create or replace function public.admin_publish_retrospective(p_student uuid,p_year integer,p_publish boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb;
begin
 if not public.is_admin() then raise exception 'Acesso negado'; end if;
 if p_publish then
  snapshot=public.admin_retrospective_stats(p_student,p_year);
  insert into public.student_retrospectives(student_id,year,stats,published) values(p_student,p_year,snapshot,true)
  on conflict(student_id,year) do update set stats=excluded.stats,published=true,updated_at=now();
 else
  update public.student_retrospectives set published=false,updated_at=now() where student_id=p_student and year=p_year;
 end if;
end;
$$;
revoke all on function public.admin_publish_retrospective(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.admin_publish_retrospective(uuid,integer,boolean) to authenticated;
commit;
