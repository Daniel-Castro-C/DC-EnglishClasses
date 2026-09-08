-- ==========================================================
-- ATUALIZAÇÃO 5 — "Pergunte ao Daniel"
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

create table if not exists public.daniel_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  question text not null,
  answer text,
  answered_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table public.daniel_questions enable row level security;

drop policy if exists "daniel_questions_select" on public.daniel_questions;
create policy "daniel_questions_select" on public.daniel_questions
  for select using ( student_id = auth.uid() or public.is_admin() );

drop policy if exists "daniel_questions_insert" on public.daniel_questions;
create policy "daniel_questions_insert" on public.daniel_questions
  for insert with check ( student_id = auth.uid() );

drop policy if exists "daniel_questions_update" on public.daniel_questions;
create policy "daniel_questions_update" on public.daniel_questions
  for update using ( public.is_admin() );

drop policy if exists "daniel_questions_delete" on public.daniel_questions;
create policy "daniel_questions_delete" on public.daniel_questions
  for delete using ( public.is_admin() );
