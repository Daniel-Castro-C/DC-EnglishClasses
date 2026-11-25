-- Manual calendar completions, separate from teaching materials.
create table if not exists public.calendar_completed_days (
 student_id uuid not null references public.profiles(id) on delete cascade,
 lesson_date date not null,
 primary key(student_id,lesson_date)
);
alter table public.calendar_completed_days enable row level security;
revoke all on public.calendar_completed_days from anon, authenticated;
grant select,insert,delete on public.calendar_completed_days to authenticated;
drop policy if exists calendar_completed_read on public.calendar_completed_days;
create policy calendar_completed_read on public.calendar_completed_days for select to authenticated using (student_id=auth.uid() or public.is_admin());
drop policy if exists calendar_completed_insert on public.calendar_completed_days;
create policy calendar_completed_insert on public.calendar_completed_days for insert to authenticated with check (public.is_admin());
drop policy if exists calendar_completed_delete on public.calendar_completed_days;
create policy calendar_completed_delete on public.calendar_completed_days for delete to authenticated using (public.is_admin());
create or replace function public.completed_lesson_count(p_student uuid)
returns bigint language sql stable security invoker set search_path='' as $$
 select
 (select count(*) from public.lessons l where l.student_id=p_student)
 +
 (select count(*) from public.calendar_completed_days c where c.student_id=p_student
 and not exists(select 1 from public.lessons l where l.student_id=c.student_id and l.lesson_date=c.lesson_date));
$$;
revoke all on function public.completed_lesson_count(uuid) from public,anon;
grant execute on function public.completed_lesson_count(uuid) to authenticated;
