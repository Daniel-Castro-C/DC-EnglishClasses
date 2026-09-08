-- ==========================================================
-- ATUALIZAÇÃO 3 — Aluno envia material para usar em uma aula futura
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

-- 1) Tabela dos pedidos de material enviados pelo aluno
create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  requested_date date,
  notes text,
  external_link text,
  file_path text,
  file_name text,
  created_at timestamp with time zone default now()
);

alter table public.material_requests enable row level security;

drop policy if exists "material_requests_select" on public.material_requests;
create policy "material_requests_select" on public.material_requests
  for select using ( student_id = auth.uid() or public.is_admin() );

drop policy if exists "material_requests_insert" on public.material_requests;
create policy "material_requests_insert" on public.material_requests
  for insert with check ( student_id = auth.uid() );

drop policy if exists "material_requests_delete" on public.material_requests;
create policy "material_requests_delete" on public.material_requests
  for delete using ( public.is_admin() );

-- ==========================================================
-- 2) Permite que qualquer aluno logado veja o e-mail/nome do professor
--    (necessário para o sistema saber para quem mandar o aviso).
--    Isso não expõe nada sensível — só nome e e-mail do professor.
-- ==========================================================
drop policy if exists "profiles_select_admin_public" on public.profiles;
create policy "profiles_select_admin_public" on public.profiles
  for select using ( role = 'admin' );

-- ==========================================================
-- 3) Permite que o aluno envie arquivos para dentro da própria pasta
--    no bucket "materiais" (antes, só o professor podia enviar arquivos).
-- ==========================================================
drop policy if exists "materiais_insert" on storage.objects;
create policy "materiais_insert" on storage.objects
  for insert with check (
    bucket_id = 'materiais' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
