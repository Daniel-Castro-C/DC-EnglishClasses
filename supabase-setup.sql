-- ==========================================================
-- CONFIGURAÇÃO DO BANCO DE DADOS — Portal D.C English Classes
-- Cole este arquivo inteiro no Supabase em: SQL Editor > New query > Run
-- ==========================================================

-- 1) TABELA DE PERFIS (alunos e professor)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamp with time zone default now()
);

-- 2) TABELA DE AULAS
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  topic text,
  lesson_date date,
  created_at timestamp with time zone default now()
);

-- 3) TABELA DE MATERIAIS DE CADA AULA (ppt, pdf, exercícios, relatórios)
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('ppt','pdf','ex','rep')),
  name text not null,
  description text,
  file_path text not null, -- caminho dentro do Storage
  created_at timestamp with time zone default now()
);

-- ==========================================================
-- 4) CRIA AUTOMATICAMENTE UM PERFIL QUANDO UM NOVO LOGIN É CRIADO
--    (todo novo usuário entra como "student" por padrão;
--     você transforma sua própria conta em "admin" manualmente, veja o passo 8 mais abaixo)
-- ==========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================================
-- 5) FUNÇÃO AUXILIAR: verifica se o usuário logado é o professor (admin)
-- ==========================================================
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ==========================================================
-- 6) REGRAS DE SEGURANÇA (RLS) — cada aluno só vê os próprios dados
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.lessons enable row level security;
alter table public.resources enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- lessons
drop policy if exists "lessons_select" on public.lessons;
create policy "lessons_select" on public.lessons
  for select using (student_id = auth.uid() or public.is_admin());

drop policy if exists "lessons_insert" on public.lessons;
create policy "lessons_insert" on public.lessons
  for insert with check (public.is_admin());

drop policy if exists "lessons_update" on public.lessons;
create policy "lessons_update" on public.lessons
  for update using (public.is_admin());

drop policy if exists "lessons_delete" on public.lessons;
create policy "lessons_delete" on public.lessons
  for delete using (public.is_admin());

-- resources
drop policy if exists "resources_select" on public.resources;
create policy "resources_select" on public.resources
  for select using (
    exists (
      select 1 from public.lessons
      where lessons.id = resources.lesson_id
      and (lessons.student_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "resources_insert" on public.resources;
create policy "resources_insert" on public.resources
  for insert with check (public.is_admin());

drop policy if exists "resources_delete" on public.resources;
create policy "resources_delete" on public.resources
  for delete using (public.is_admin());

-- ==========================================================
-- 7) ÁREA DE ARQUIVOS (Storage) — crie o bucket manualmente antes:
--    Painel Supabase > Storage > New bucket > nome: materiais > Public: NÃO (deixe privado)
--    Depois rode o restante deste script.
-- ==========================================================
drop policy if exists "materiais_select" on storage.objects;
create policy "materiais_select" on storage.objects
  for select using (
    bucket_id = 'materiais' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    )
  );

drop policy if exists "materiais_insert" on storage.objects;
create policy "materiais_insert" on storage.objects
  for insert with check (
    bucket_id = 'materiais' and public.is_admin()
  );

drop policy if exists "materiais_delete" on storage.objects;
create policy "materiais_delete" on storage.objects
  for delete using (
    bucket_id = 'materiais' and public.is_admin()
  );

-- ==========================================================
-- 8) ÚLTIMO PASSO (fazer manualmente, depois de você criar seu próprio login):
--    Troque 'seuemail@exemplo.com' pelo seu e-mail de professor e rode:
--
--    update public.profiles set role = 'admin' where email = 'seuemail@exemplo.com';
-- ==========================================================
