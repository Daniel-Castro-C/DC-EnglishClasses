-- Apply after approval, before deploying the calendar editor.
-- Null retains the historical meaning (a registered lesson was realized).
alter table public.lessons add column if not exists calendar_status text
 check (calendar_status in ('planned','done','absent','owed','teacher','holiday','break','vacation','rescheduled'));

create or replace function public.portal_calendar_save_registered_statuses(
 p_group uuid,p_student uuid,p_schedule jsonb,p_changes jsonb,p_metadata jsonb,p_moves jsonb,p_deletions jsonb
) returns bigint language plpgsql security invoker set search_path='' as $$
declare item jsonb; c jsonb; lesson record; ids uuid[]; expected uuid[]; members uuid[]; day date; event jsonb; original text; target text; revision bigint;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 if (p_group is null)=(p_student is null) or jsonb_typeof(p_changes) is distinct from 'array'
  or jsonb_typeof(p_metadata) is distinct from 'array' or jsonb_array_length(p_metadata)=0
  or jsonb_typeof(p_moves) is distinct from 'array' or jsonb_typeof(p_deletions) is distinct from 'array' then raise exception 'Invalid status request'; end if;
 lock table public.lessons in share row exclusive mode;
 if p_group is not null then select g.members into strict members from public.portal_groups g where g.id=p_group for update;
 else members:=array[p_student]; end if;
 if jsonb_array_length(p_changes)<>cardinality(members)
  or (select count(distinct x->>'id') from jsonb_array_elements(p_changes) x)<>cardinality(members)
  or exists(select 1 from jsonb_array_elements(p_changes) x where not coalesce((x->>'id')::uuid=any(members),false)) then raise exception 'Invalid members'; end if;
 for item in select value from jsonb_array_elements(p_metadata) loop
  day:=(item->>'date')::date;
  if day is null or jsonb_typeof(item->'ids') is distinct from 'array' then raise exception 'Invalid lesson'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(item->'ids');
  if item->>'attendance'='true' and p_group is null then
   select array_agg(l.id) into expected from public.lessons l join public.portal_groups g on g.id=l.group_id
   where l.student_id=p_student and l.lesson_date=day and p_student=any(g.members);
   if cardinality(expected) is distinct from 1 then raise exception 'Ambiguous attendance'; end if;
  else expected:=public.portal_calendar_lesson_ids(p_group,p_student,day); end if;
  if ids is null or expected is null or cardinality(ids)<>cardinality(expected) or not (ids <@ expected and expected <@ ids) then raise exception 'Lesson changed; refresh'; end if;
  if exists(select 1 from public.lessons l where l.student_id=any(members) and l.lesson_date=day and not l.id=any(ids)) then raise exception 'Conflicting lesson'; end if;
  for lesson in select l.id,l.student_id,l.group_id from public.lessons l where l.id=any(ids) loop
   select x into strict c from jsonb_array_elements(p_changes) x where x->>'id'=lesson.student_id::text;
   event:=c->'payload'->'events'->day::text;
   if event->>'status' is null or event->>'status' not in ('planned','done','absent','owed','teacher','holiday','break','vacation','rescheduled') or event->>'skip'='true' then raise exception 'Invalid status'; end if;
   if item->>'attendance'='true' and (event->>'group_id' is distinct from lesson.group_id::text or event->>'status' not in ('planned','done','absent','owed')) then raise exception 'Invalid individual attendance'; end if;
   if p_group is not null and (event->>'group_id' is distinct from p_group::text or event->>'group_status' is distinct from p_schedule->'calendar_events'->day::text->>'status') then raise exception 'Collective status mismatch'; end if;
   original:=event->>'original';
   if original is not null then
    if event->>'status' not in ('planned','done','absent') or original::date>=day then raise exception 'Invalid replacement'; end if;
    if exists(select 1 from jsonb_array_elements(p_changes) x where
      coalesce(x->'payload'->'events'->original->>'status','') not in ('owed','absent','teacher')
      or (p_group is not null and (x->'payload'->'events'->original->>'group_id' is distinct from p_group::text or x->'payload'->'events'->original->>'status' not in ('owed','absent')))
      or exists(select 1 from jsonb_each(x->'payload'->'events') e where e.key<>day::text and e.value->>'original'=original and e.value->>'status' in ('planned','done'))) then raise exception 'Replacement unavailable'; end if;
   end if;
   if event->>'status'='rescheduled' then
    target:=event->>'rescheduled_to';
    if target is null or target::date=day or c->'payload'->'events'->target->>'rescheduled_from' is distinct from day::text or c->'payload'->'events'->target->>'status' is distinct from 'planned'
     or exists(select 1 from public.lessons l where l.student_id=any(members) and l.lesson_date=target::date) then raise exception 'Invalid reschedule'; end if;
   end if;
   update public.lessons set calendar_status=event->>'status' where id=lesson.id;
  end loop;
 end loop;
 if jsonb_array_length(p_moves)>0 then revision:=public.portal_calendar_save_with_moves(p_group,p_student,p_schedule,p_changes,p_moves,p_deletions);
 elsif jsonb_array_length(p_deletions)>0 then revision:=public.portal_calendar_save_with_deletions(p_group,p_student,p_schedule,p_changes,p_deletions);
 elsif p_group is not null then perform public.portal_group_calendar_save(p_group,p_schedule,p_changes);
 else c:=p_changes->0;revision:=public.save_admin_calendar(p_student::text,c->'payload',(c->>'revision')::bigint);
 end if;
 return revision;
end $$;
revoke all on function public.portal_calendar_save_registered_statuses(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.portal_calendar_save_registered_statuses(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.completed_lesson_count(p_student uuid)
returns bigint language sql stable security invoker set search_path='' as $$
 select (select count(*) from public.lessons l where l.student_id=p_student and coalesce(l.calendar_status,'done')='done')
 + (select count(*) from public.calendar_completed_days c where c.student_id=p_student
 and not exists(select 1 from public.lessons l where l.student_id=c.student_id and l.lesson_date=c.lesson_date));
$$;
revoke all on function public.completed_lesson_count(uuid) from public,anon;
grant execute on function public.completed_lesson_count(uuid) to authenticated;

create or replace function portal_private.student_has_lesson_today()
returns boolean language plpgsql stable security definer set search_path='' as $$
declare
 sid uuid:=auth.uid(); today date:=(now() at time zone 'America/Sao_Paulo')::date;
 profile_days text; profile_time text; payload jsonb; global_days jsonb;
 own_event jsonb; effective_event jsonb; group_event jsonb; group_row record; habitual boolean; linked_group boolean;
begin
 if sid is null then return false; end if;
 select p.lesson_weekday::text,p.lesson_time::text into profile_days,profile_time
 from public.profiles p where p.id=sid and p.role='student';
 if not found then return false; end if;
 if exists(select 1 from public.lessons l where l.student_id=sid and l.lesson_date=today and coalesce(l.calendar_status,'done') in ('planned','done')) then return true; end if;
 if exists(select 1 from public.lessons l where l.student_id=sid and l.lesson_date=today) then return false; end if;
 select s.payload into payload from public.admin_calendar_states s where s.calendar_key=sid::text;
 select s.payload into global_days from public.admin_calendar_states s where s.calendar_key='global';
 payload:=coalesce(payload,'{}'::jsonb);
 own_event:=payload->'events'->(today::text);
 effective_event:=own_event;
 habitual:=portal_private.calendar_habitual(payload,today,profile_days,profile_time);

 -- The group calendar is the source of collective events. Individual attendance overrides
 -- apply only to an active group session, not to cancelled or rescheduled original dates.
 for group_row in select g.id,g.schedule from public.portal_groups g where sid=any(g.members) order by g.id loop
  if nullif(own_event->>'group_id','') is not null and own_event->>'group_id'<>group_row.id::text then continue; end if;
  group_event:=group_row.schedule->'calendar_events'->(today::text);
  linked_group:=coalesce(own_event->>'group_id'=group_row.id::text,false);
  if group_event is not null then
   effective_event:=group_event;
   if linked_group and group_event->>'status' in ('planned','done','absent','owed')
      and own_event->>'attendance_override' in ('done','absent','owed') then
     effective_event:=jsonb_set(group_event,'{status}',to_jsonb(own_event->>'attendance_override'),true);
   end if;
   exit;
  elsif linked_group or (nullif(group_row.schedule->>'start','') is not null
    and portal_private.calendar_habitual(group_row.schedule,today,'','')
    and (own_event is null or (coalesce(own_event->>'skip','false')<>'true'
      and nullif(own_event->>'original','') is null and nullif(own_event->>'rescheduled_from','') is null
      and nullif(own_event->>'rescheduled_to','') is null))) then
   habitual:=portal_private.calendar_habitual(group_row.schedule,today,'','');
   exit;
  end if;
 end loop;
 return portal_private.calendar_day_visible(effective_event,false,habitual,portal_private.calendar_unavailable(global_days,today));
end $$;
revoke all on function portal_private.student_has_lesson_today() from public,anon;
grant execute on function portal_private.student_has_lesson_today() to authenticated;

