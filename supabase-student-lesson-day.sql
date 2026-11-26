-- Apply after approval. Only a boolean for the signed-in student's current day is exposed.
-- Calendar states and group membership remain protected by their existing RLS policies.
create schema if not exists portal_private;
revoke all on schema portal_private from public,anon;
grant usage on schema portal_private to authenticated;

create or replace function portal_private.calendar_habitual(p_schedule jsonb,p_day date,p_days text,p_time text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare change_row jsonb; days text; lesson_time text;
begin
 if (nullif(p_schedule->>'start','') is not null and p_day::text < p_schedule->>'start')
 or (nullif(p_schedule->>'end','') is not null and p_day::text > p_schedule->>'end') then return false; end if;
 days:=coalesce(p_schedule->>'weekdays',p_schedule->>'days',p_days,'');
 lesson_time:=coalesce(p_schedule->>'time',p_time,'');
 select e into change_row from jsonb_array_elements(
  case when jsonb_typeof(p_schedule->'changes')='array' then p_schedule->'changes' else '[]'::jsonb end
 ) e where e->>'from'<=p_day::text order by e->>'from' desc limit 1;
 if found then days:=coalesce(change_row->>'weekdays','');lesson_time:=coalesce(change_row->>'time',''); end if;
 return lesson_time<>'' and extract(isodow from p_day)::integer::text=any(string_to_array(days,','));
end $$;
revoke all on function portal_private.calendar_habitual(jsonb,date,text,text) from public,anon,authenticated;

-- Pure helper so precedence can be verified using synthetic dates and calendar payloads.
create or replace function portal_private.calendar_unavailable(p_global jsonb,p_day date)
returns boolean language sql immutable security invoker set search_path='' as $$
 select exists(select 1 from jsonb_array_elements(coalesce(p_global,'[]'::jsonb)) e
  where e->>'start'<=p_day::text and e->>'end'>=p_day::text
  and e->>'status' in ('holiday','break') and coalesce(e->>'disabled','false')<>'true')
 or (p_day::text in ('2027-01-01','2027-03-26','2027-04-21','2027-05-01','2027-09-07','2027-10-12','2027-11-02','2027-11-15','2027-11-20','2027-12-25')
 and not exists(select 1 from jsonb_array_elements(coalesce(p_global,'[]'::jsonb)) e
  where e->>'start'<=p_day::text and e->>'end'>=p_day::text and e->>'disabled'='true'));
$$;
revoke all on function portal_private.calendar_unavailable(jsonb,date) from public,anon,authenticated;

create or replace function portal_private.calendar_day_visible(p_event jsonb,p_has_registered boolean,p_habitual boolean,p_unavailable boolean)
returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(p_has_registered,false) or
 (coalesce(p_event->>'skip','false')<>'true' and
  case when nullif(p_event->>'status','') is not null then p_event->>'status' in ('planned','done')
       else coalesce(p_habitual,false) and not coalesce(p_unavailable,false) end);
$$;
revoke all on function portal_private.calendar_day_visible(jsonb,boolean,boolean,boolean) from public,anon,authenticated;

-- The privileged lookup is intentionally in a non-exposed schema. The caller cannot pass a
-- student ID or date; the identity is taken from the signed JWT and checked against profiles.
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
 if exists(select 1 from public.lessons l where l.student_id=sid and l.lesson_date=today) then return true; end if;
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

create or replace function public.student_has_lesson_today()
returns boolean language sql stable security invoker set search_path='' as $$
 select portal_private.student_has_lesson_today();
$$;
revoke all on function public.student_has_lesson_today() from public,anon;
grant execute on function public.student_has_lesson_today() to authenticated;
