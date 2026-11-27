-- Apply before merging the rolling planning/calendar/countdown PR.
-- A single integer (0=today, null=no class) is returned to the authenticated student.
begin;
create or replace function portal_private.calendar_student_visible_on(
 p_day date,p_payload jsonb,p_groups jsonb,p_global jsonb,p_registered jsonb,p_profile_days text,p_profile_time text
) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare own_event jsonb; effective_event jsonb; group_event jsonb; group_row jsonb; schedule jsonb; habitual boolean; linked_group boolean;
begin
 -- A registered status is authoritative, including corrected absences.
 if p_registered ? p_day::text then return (p_registered->>p_day::text)::boolean; end if;
 own_event:=p_payload->'events'->p_day::text;
 effective_event:=own_event;
 habitual:=portal_private.calendar_habitual(p_payload,p_day,p_profile_days,p_profile_time);
 for group_row in select e from jsonb_array_elements(p_groups) e order by e->>'id' loop
  if nullif(own_event->>'group_id','') is not null and own_event->>'group_id'<>group_row->>'id' then continue; end if;
  schedule:=group_row->'schedule';
  group_event:=schedule->'calendar_events'->p_day::text;
  linked_group:=coalesce(own_event->>'group_id'=group_row->>'id',false);
  if group_event is not null then
   effective_event:=group_event;
   if linked_group and group_event->>'status' in ('planned','done','absent','owed') and own_event->>'attendance_override' in ('done','absent','owed') then
    effective_event:=jsonb_set(group_event,'{status}',to_jsonb(own_event->>'attendance_override'),true);
   end if;
   habitual:=portal_private.calendar_habitual(schedule,p_day,'','');
   exit;
  elsif linked_group or (nullif(schedule->>'start','') is not null
    and portal_private.calendar_habitual(schedule,p_day,'','')
    and (own_event is null or (coalesce(own_event->>'skip','false')<>'true'
     and nullif(own_event->>'original','') is null and nullif(own_event->>'rescheduled_from','') is null
     and nullif(own_event->>'rescheduled_to','') is null))) then
   habitual:=portal_private.calendar_habitual(schedule,p_day,'','');
   exit;
  end if;
 end loop;
 return portal_private.calendar_day_visible(effective_event,false,habitual,portal_private.calendar_unavailable(p_global,p_day));
end $$;
revoke all on function portal_private.calendar_student_visible_on(date,jsonb,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated;

-- No arbitrary search horizon: between schedule boundaries the habitual pattern repeats
-- every seven days. Test each boundary and the six following days, plus today's window.
-- Every manual exception, holiday/recess, schedule change and registered lesson contributes
-- its own boundary and/or the following day, including long future breaks.
create or replace function portal_private.calendar_next_student_day(
 p_today date,p_payload jsonb,p_groups jsonb,p_global jsonb,p_registered jsonb,p_profile_days text,p_profile_time text
) returns date language sql immutable security invoker set search_path='' as $$
 with schedules as (
  select p_payload as schedule,coalesce(p_payload->'events','{}'::jsonb) as events
  union all
  select g->'schedule',coalesce(g->'schedule'->'calendar_events','{}'::jsonb) from jsonb_array_elements(p_groups) g
 ), boundaries as (
  select p_today as day
  union select nullif(schedule->>'start','')::date from schedules
  union select nullif(schedule->>'end','')::date+1 from schedules
  union select nullif(c->>'from','')::date from schedules cross join lateral jsonb_array_elements(case when jsonb_typeof(schedule->'changes')='array' then schedule->'changes' else '[]'::jsonb end) c
  union select k::date from schedules cross join lateral jsonb_object_keys(case when jsonb_typeof(events)='object' then events else '{}'::jsonb end) k
  union select k::date+1 from schedules cross join lateral jsonb_object_keys(case when jsonb_typeof(events)='object' then events else '{}'::jsonb end) k
  union select nullif(g->>'start','')::date from jsonb_array_elements(p_global) g
  union select nullif(g->>'end','')::date+1 from jsonb_array_elements(p_global) g
  union select k::date from jsonb_object_keys(p_registered) k
  union select k::date+1 from jsonb_object_keys(p_registered) k
  union select d from unnest(array['2027-01-01','2027-03-26','2027-04-21','2027-05-01','2027-09-07','2027-10-12','2027-11-02','2027-11-15','2027-11-20','2027-12-25']::date[]) d
  union select d+1 from unnest(array['2027-01-01','2027-03-26','2027-04-21','2027-05-01','2027-09-07','2027-10-12','2027-11-02','2027-11-15','2027-11-20','2027-12-25']::date[]) d
 ), candidates as (
  select distinct day+offset_days as day from boundaries cross join generate_series(0,6) offset_days where day>=p_today
 )
 select day from candidates where portal_private.calendar_student_visible_on(day,p_payload,p_groups,p_global,p_registered,p_profile_days,p_profile_time) order by day limit 1;
$$;
revoke all on function portal_private.calendar_next_student_day(date,jsonb,jsonb,jsonb,jsonb,text,text) from public,anon,authenticated;

create or replace function portal_private.student_next_lesson_days()
returns integer language plpgsql stable security definer set search_path='' as $$
declare sid uuid:=auth.uid(); today date:=(now() at time zone 'America/Sao_Paulo')::date;
 profile_days text; profile_time text; payload jsonb; global_days jsonb; groups jsonb; registered jsonb;
begin
 if sid is null then return null; end if;
 select p.lesson_weekday::text,p.lesson_time::text into profile_days,profile_time from public.profiles p where p.id=sid and p.role='student';
 if not found then return null; end if;
 select s.payload into payload from public.admin_calendar_states s where s.calendar_key=sid::text;
 select s.payload into global_days from public.admin_calendar_states s where s.calendar_key='global';
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'schedule',g.schedule)),'[]'::jsonb) into groups from public.portal_groups g where sid=any(g.members);
 select coalesce(jsonb_object_agg(day,visible),'{}'::jsonb) into registered from (
  select l.lesson_date::text as day,bool_or(coalesce(l.calendar_status,'done') in ('planned','done')) as visible
  from public.lessons l where l.student_id=sid and l.lesson_date>=today group by l.lesson_date
 ) r;
 return portal_private.calendar_next_student_day(today,coalesce(payload,'{}'::jsonb),groups,case when jsonb_typeof(global_days)='array' then global_days else '[]'::jsonb end,registered,profile_days,profile_time)-today;
end $$;
revoke all on function portal_private.student_next_lesson_days() from public,anon;
grant execute on function portal_private.student_next_lesson_days() to authenticated;

create or replace function public.student_next_lesson_days()
returns integer language sql stable security invoker set search_path='' as $$
 select portal_private.student_next_lesson_days();
$$;
revoke all on function public.student_next_lesson_days() from public,anon;
grant execute on function public.student_next_lesson_days() to authenticated;
commit;
