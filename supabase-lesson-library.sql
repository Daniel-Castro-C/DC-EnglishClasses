-- Apply only after approval; additive migration, no existing data replaced.
begin;
alter table public.lessons add column if not exists grammar_content text not null default '' check(char_length(grammar_content)<=500);
create or replace function public.portal_calendar_lesson_save_with_grammar(
 p_group uuid,p_student uuid,p_date date,p_title text,p_topic text,p_members uuid[],p_materials jsonb,p_edit boolean,p_grammar text
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 if char_length(coalesce(p_grammar,''))>500 then raise exception 'Grammar content too long'; end if;
 perform public.portal_calendar_lesson_save(p_group,p_student,p_date,p_title,p_topic,p_members,p_materials,p_edit);
 update public.lessons set grammar_content=coalesce(p_grammar,'') where id=any(public.portal_calendar_lesson_ids(p_group,p_student,p_date));
end $$;
revoke all on function public.portal_calendar_lesson_save_with_grammar(uuid,uuid,date,text,text,uuid[],jsonb,boolean,text) from public,anon;
grant execute on function public.portal_calendar_lesson_save_with_grammar(uuid,uuid,date,text,text,uuid[],jsonb,boolean,text) to authenticated;
-- Apply only after approval. Keeps IDs, resources and calendar updates in a single transaction.
create or replace function public.portal_calendar_save_with_moves(
 p_group uuid,p_student uuid,p_schedule jsonb,p_changes jsonb,p_moves jsonb,p_deletions jsonb
) returns bigint language plpgsql security invoker set search_path='' as $$
declare item jsonb; c jsonb; ids uuid[]; expected uuid[]; members uuid[]; participants uuid[]; source date; destination date; revision bigint;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 if (p_group is null)=(p_student is null) or jsonb_typeof(p_changes) is distinct from 'array'
  or jsonb_typeof(p_moves) is distinct from 'array' or jsonb_array_length(p_moves)=0
  or jsonb_typeof(p_deletions) is distinct from 'array' then raise exception 'Invalid calendar move'; end if;
 lock table public.lessons in share row exclusive mode;
 if p_group is not null then
  select g.members into strict members from public.portal_groups g where g.id=p_group for update;
 else
  members:=array[p_student];
 end if;
 if jsonb_array_length(p_changes)<>cardinality(members)
  or (select count(distinct x->>'id') from jsonb_array_elements(p_changes) x)<>cardinality(members)
  or exists(select 1 from jsonb_array_elements(p_changes) x where not coalesce((x->>'id')::uuid=any(members),false)) then raise exception 'Invalid members'; end if;
 for item in select value from jsonb_array_elements(p_moves) loop
  source:=(item->>'date')::date; destination:=(item->>'to')::date;
  if source is null or destination is null or source=destination or jsonb_typeof(item->'ids') is distinct from 'array' then raise exception 'Invalid dates'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(item->'ids');
  expected:=public.portal_calendar_lesson_ids(p_group,p_student,source);
  if ids is null or expected is null or cardinality(ids)<>cardinality(expected) or not (ids <@ expected and expected <@ ids) then raise exception 'Lesson changed; refresh'; end if;
  select array_agg(student_id) into participants from public.lessons where id=any(ids);
  if not participants <@ members then raise exception 'Invalid participants'; end if;
  if exists(select 1 from public.lessons l where l.student_id=any(members) and (l.lesson_date=destination or l.lesson_date=source and not l.id=any(ids))) then raise exception 'Conflicting lesson; refresh'; end if;
  if exists(select 1 from jsonb_array_elements(p_changes) x where x->'payload'->'events'->(source::text)->>'skip' is distinct from 'true'
   or ((x->>'id')::uuid=any(participants) and (x->'payload'->'events'->(destination::text)->>'status' is distinct from 'done' or x->'payload'->'events'->(destination::text)->>'skip'='true')))
   or (p_group is not null and (p_schedule->'calendar_events'->(source::text)->>'skip' is distinct from 'true' or p_schedule->'calendar_events'->(destination::text)->>'status' is distinct from 'done')) then raise exception 'Missing calendar move'; end if;
  update public.lessons set lesson_date=destination,group_id=p_group where id=any(ids);
  perform public.portal_calendar_lesson_save(p_group,p_student,destination,item->>'title',item->>'topic',participants,item->'materials',true);
  if item ? 'grammar' then update public.lessons set grammar_content=coalesce(item->>'grammar','') where id=any(ids); end if;
 end loop;
 if jsonb_array_length(p_deletions)>0 then
  revision:=public.portal_calendar_save_with_deletions(p_group,p_student,p_schedule,p_changes,p_deletions);
 elsif p_group is not null then
  perform public.portal_group_calendar_save(p_group,p_schedule,p_changes);
 else
  c:=p_changes->0;
  revision:=public.save_admin_calendar(p_student::text,c->'payload',(c->>'revision')::bigint);
 end if;
 return revision;
end $$;
revoke all on function public.portal_calendar_save_with_moves(uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.portal_calendar_save_with_moves(uuid,uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;

commit;
