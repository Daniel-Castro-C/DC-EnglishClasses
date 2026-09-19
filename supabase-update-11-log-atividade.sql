-- ==========================================================
-- ATUALIZAÇÃO 14 — Log de atividades dos alunos
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  details text,
  created_at timestamp with time zone default now()
);

alter table public.activity_log enable row level security;

-- O próprio aluno pode registrar as próprias ações (mas não consegue ler o log de ninguém)
drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert with check ( student_id = auth.uid() );

-- Só o professor (admin) consegue visualizar o log
drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select using ( public.is_admin() );
