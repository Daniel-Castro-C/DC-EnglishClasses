-- Apply only after approval of the unified calendar PR. No files or lesson IDs are changed.
begin;
alter table public.lessons add column if not exists title_automatic boolean;
update public.lessons set title_automatic = title ~* '^(Class|Aula)[[:space:]]*#?[[:space:]]*[0-9]+$'
 where title_automatic is null;
alter table public.lessons alter column title_automatic set default false;
alter table public.lessons alter column title_automatic set not null;

-- Historical group sessions without group_id are recognized only when all current members
-- have an identical dated title/topic. Keep explicit individual records otherwise.
create or replace function public.portal_calendar_resequence(p_student uuid,p_group uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare members uuid[];
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 if p_group is null then
  with ranked as (
    select id, row_number() over(order by coalesce(lesson_date,created_at::date),created_at,id) as n
    from public.lessons where student_id=p_student
  )
  update public.lessons l set title='Class #'||ranked.n from ranked
   where l.id=ranked.id and l.group_id is null and l.title_automatic and l.title is distinct from 'Class #'||ranked.n;
 else
  select g.members into strict members from public.portal_groups g where g.id=p_group;
  with legacy as (
   select lesson_date,title,coalesce(topic,'') as topic from public.lessons
    where student_id=any(members) and group_id is null and lesson_date is not null
    group by lesson_date,title,coalesce(topic,'') having count(distinct student_id)=cardinality(members)
  ), collective as (
   select l.id,l.lesson_date from public.lessons l where l.group_id=p_group
   union
   select l.id,l.lesson_date from public.lessons l join legacy v on l.lesson_date=v.lesson_date and l.title=v.title and coalesce(l.topic,'')=v.topic
    where l.group_id is null and l.student_id=any(members)
  ), ranked as (
   select id,dense_rank() over(order by lesson_date) as n from collective
  )
  update public.lessons l set title='Class #'||ranked.n from ranked
   where l.id=ranked.id and l.title_automatic and l.title is distinct from 'Class #'||ranked.n;
 end if;
end $$;
revoke all on function public.portal_calendar_resequence(uuid,uuid) from public,anon;
grant execute on function public.portal_calendar_resequence(uuid,uuid) to authenticated;

-- Resolve the full registered session, including unambiguous historical group records.
create or replace function public.portal_calendar_lesson_ids(p_group uuid,p_student uuid,p_date date)
returns uuid[] language plpgsql security invoker set search_path='' as $$
declare ids uuid[]; members uuid[]; n integer; variants integer;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 if p_date is null or (p_group is null)=(p_student is null) then raise exception 'Invalid lesson'; end if;
 if p_group is null then
  select array_agg(id) into ids from public.lessons where student_id=p_student and group_id is null and lesson_date=p_date;
  if coalesce(cardinality(ids),0)<>1 then raise exception 'Ambiguous lesson'; end if;
 else
  select g.members into strict members from public.portal_groups g where g.id=p_group;
  select array_agg(id),count(distinct student_id) into ids,n from public.lessons where group_id=p_group and lesson_date=p_date;
  if ids is null then
   select array_agg(id),count(distinct student_id),count(distinct (title,coalesce(topic,''))) into ids,n,variants from public.lessons
    where group_id is null and student_id=any(members) and lesson_date=p_date;
   if n<>cardinality(members) or cardinality(ids)<>n or variants<>1 then raise exception 'Ambiguous historical group lesson'; end if;
  elsif cardinality(ids)<>n then raise exception 'Ambiguous group lesson'; end if;
 end if;
 return ids;
end $$;
revoke all on function public.portal_calendar_lesson_ids(uuid,uuid,date) from public,anon;
grant execute on function public.portal_calendar_lesson_ids(uuid,uuid,date) to authenticated;

create or replace function public.portal_calendar_lesson_delete(p_group uuid,p_student uuid,p_date date,p_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare ids uuid[]; affected integer;
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 lock table public.lessons in share row exclusive mode;
 ids:=public.portal_calendar_lesson_ids(p_group,p_student,p_date);
 if ids is null or p_ids is null or cardinality(ids)<>cardinality(p_ids) or not (ids <@ p_ids and p_ids <@ ids) then raise exception 'Lesson changed; refresh'; end if;
 -- The resource foreign key cascades. Never delete storage objects: shared files may have other references.
 delete from public.lessons where id=any(ids);
 get diagnostics affected = row_count;
 if affected<>cardinality(ids) then raise exception 'Lesson changed; refresh'; end if;
 perform public.portal_calendar_resequence(p_student,p_group);
end $$;
revoke all on function public.portal_calendar_lesson_delete(uuid,uuid,date,uuid[]) from public,anon;
grant execute on function public.portal_calendar_lesson_delete(uuid,uuid,date,uuid[]) to authenticated;

create or replace function public.portal_calendar_lesson_save(
 p_group uuid,p_student uuid,p_date date,p_title text,p_topic text,p_members uuid[],p_materials jsonb,p_edit boolean
) returns void language plpgsql security invoker set search_path='' as $$
declare sid uuid; lid uuid; m jsonb; members uuid[]; ids uuid[]; expected uuid[];
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 if p_date is null or (p_group is null)=(p_student is null) or p_title is not null and btrim(p_title)='' then raise exception 'Invalid lesson'; end if;
 if coalesce(cardinality(p_members),0)=0 or p_materials is null or jsonb_typeof(p_materials)<>'array' or p_edit is null then raise exception 'Invalid request'; end if;
 -- Serialize lesson creation/reordering, including concurrent historic registrations.
 lock table public.lessons in share row exclusive mode;
 if p_group is not null then
  select g.members into strict members from public.portal_groups g where g.id=p_group;
  if not p_members <@ members or cardinality(p_members)<>(select count(distinct x) from unnest(p_members) x) then raise exception 'Invalid participants'; end if;
 else
  if p_members<>array[p_student] then raise exception 'Invalid student'; end if;
 end if;
 if p_edit then
  ids:=public.portal_calendar_lesson_ids(p_group,p_student,p_date);
  select array_agg(student_id) into expected from public.lessons where id=any(ids);
  if ids is null or not (expected <@ p_members and p_members <@ expected) or cardinality(ids)<>cardinality(p_members) then raise exception 'Lesson changed; refresh'; end if;
 elsif exists(select 1 from public.lessons where student_id=any(p_members) and lesson_date=p_date) then
  raise exception 'Aula já cadastrada nesta data; atualize o calendário';
 end if;
 for m in select value from jsonb_array_elements(p_materials) loop
  if m->>'type' is null or m->>'type' not in ('ppt','pdf','ex','rep') or nullif(m->>'name','') is null then raise exception 'Invalid material'; end if;
  if p_group is null then
   if m->>'student' is not null or split_part(m->>'path','/',1)<>p_student::text or split_part(m->>'path','/',2)<>'calendar' then raise exception 'Invalid private file'; end if;
  elsif m->>'type'='rep' then
   if not coalesce((m->>'student')::uuid=any(p_members),false) or split_part(m->>'path','/',1)<>m->>'student' or split_part(m->>'path','/',2)<>p_group::text then raise exception 'Invalid private report'; end if;
  elsif m->>'student' is not null or split_part(m->>'path','/',1)<>'turmas' or split_part(m->>'path','/',2)<>p_group::text then raise exception 'Invalid shared material';
  end if;
  if not exists(select 1 from storage.objects where bucket_id='materiais' and name=m->>'path') then raise exception 'File not found'; end if;
 end loop;
 foreach sid in array p_members loop
  if p_edit then
   update public.lessons set title=coalesce(p_title,'Class #1'),title_automatic=p_title is null,topic=p_topic
    where id=any(ids) and student_id=sid returning id into strict lid;
  else
   insert into public.lessons(student_id,group_id,title,topic,lesson_date,title_automatic)
    values(sid,p_group,coalesce(p_title,'Class #1'),p_topic,p_date,p_title is null) returning id into lid;
  end if;
  for m in select value from jsonb_array_elements(p_materials) loop
   if p_group is null or m->>'type'<>'rep' or m->>'student'=sid::text then
    insert into public.resources(lesson_id,type,name,file_path) values(lid,m->>'type',m->>'name',m->>'path');
   end if;
  end loop;
  if not p_edit or jsonb_array_length(p_materials)>0 then
   insert into public.notifications(student_id,type) values(sid,'new_lesson');
  end if;
 end loop;
 perform public.portal_calendar_resequence(p_student,p_group);
end $$;
revoke all on function public.portal_calendar_lesson_save(uuid,uuid,date,text,text,uuid[],jsonb,boolean) from public,anon;
grant execute on function public.portal_calendar_lesson_save(uuid,uuid,date,text,text,uuid[],jsonb,boolean) to authenticated;
commit;
