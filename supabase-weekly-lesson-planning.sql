-- Apply after approval, before deploying the weekly planning UI.
-- Plans and attachments are private to administrators, never lessons/resources.
begin;
create table if not exists public.portal_lesson_plans (
  subject_type text not null check (subject_type in ('student','group')),
  subject_id uuid not null,
  lesson_date date not null,
  topic text not null default '' check (length(topic)<=300),
  notes text not null default '' check (length(notes)<=4000),
  ready boolean not null default false,
  files jsonb not null default '[]'::jsonb check (jsonb_typeof(files)='array' and jsonb_array_length(files)<=30),
  revision integer not null default 1 check (revision>0),
  updated_at timestamptz not null default now(),
  primary key(subject_type,subject_id,lesson_date)
);
create index if not exists portal_lesson_plans_date_idx on public.portal_lesson_plans(lesson_date);
alter table public.portal_lesson_plans enable row level security;
revoke all on public.portal_lesson_plans from public,anon,authenticated;
grant select,insert,update,delete on public.portal_lesson_plans to authenticated;
drop policy if exists lesson_plans_admin on public.portal_lesson_plans;
create policy lesson_plans_admin on public.portal_lesson_plans for all to authenticated
 using ((select public.is_admin())) with check ((select public.is_admin()));
-- Separate bucket: no existing material policies grant student access.
insert into storage.buckets(id,name,public,file_size_limit)
values ('lesson-planning','lesson-planning',false,52428800)
on conflict(id) do update set public=false;
drop policy if exists lesson_planning_private on storage.objects;
create policy lesson_planning_private on storage.objects as restrictive for all to public
 using (bucket_id<>'lesson-planning' or (select public.is_admin()))
 with check (bucket_id<>'lesson-planning' or (select public.is_admin()));
drop policy if exists lesson_planning_admin_read on storage.objects;
create policy lesson_planning_admin_read on storage.objects for select to authenticated
 using (bucket_id='lesson-planning' and (select public.is_admin()));
drop policy if exists lesson_planning_admin_add on storage.objects;
create policy lesson_planning_admin_add on storage.objects for insert to authenticated
 with check (bucket_id='lesson-planning' and (select public.is_admin()));
drop policy if exists lesson_planning_admin_delete on storage.objects;
create policy lesson_planning_admin_delete on storage.objects for delete to authenticated
 using (bucket_id='lesson-planning' and (select public.is_admin()));
commit;
