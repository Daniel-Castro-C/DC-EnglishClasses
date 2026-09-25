-- ==========================================================
-- ATUALIZAÇÃO 18 — Notificações no portal + status de estudo nos Guias de Gramática
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

-- ==========================================================
-- 1) NOTIFICAÇÕES DENTRO DO PORTAL
--    (sininho ao lado do módulo correspondente na barra lateral do aluno)
-- ==========================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('new_lesson','daniel_answered')),
  read boolean not null default false,
  created_at timestamp with time zone default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using ( student_id = auth.uid() );

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert with check ( public.is_admin() );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using ( student_id = auth.uid() ) with check ( student_id = auth.uid() );

-- ==========================================================
-- 2) STATUS DE ESTUDO nos Guias de Gramática ("Já estudei" / "Estudar mais")
-- ==========================================================
create table if not exists public.grammar_material_status (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.grammar_materials(id) on delete cascade,
  status text not null check (status in ('estudado','estudar_mais')),
  updated_at timestamp with time zone default now(),
  unique (student_id, material_id)
);

alter table public.grammar_material_status enable row level security;

-- O aluno vê e edita só o próprio status; o professor (admin) pode ver o de todos
-- (usado no painel, dentro do Perfil de cada aluno)
drop policy if exists "grammar_material_status_select" on public.grammar_material_status;
create policy "grammar_material_status_select" on public.grammar_material_status
  for select using ( student_id = auth.uid() or public.is_admin() );

drop policy if exists "grammar_material_status_insert" on public.grammar_material_status;
create policy "grammar_material_status_insert" on public.grammar_material_status
  for insert with check ( student_id = auth.uid() );

drop policy if exists "grammar_material_status_update" on public.grammar_material_status;
create policy "grammar_material_status_update" on public.grammar_material_status
  for update using ( student_id = auth.uid() ) with check ( student_id = auth.uid() );
