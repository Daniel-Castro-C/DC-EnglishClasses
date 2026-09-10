-- ==========================================================
-- ATUALIZAÇÃO 7 — Remove Financeiro / Adiciona Guias de Gramática
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

-- 1) Remove os campos financeiros (não serão mais usados)
alter table public.profiles drop column if exists payment_day;
alter table public.profiles drop column if exists monthly_fee;

-- Atualiza a trava de segurança do perfil (removendo as referências aos campos financeiros)
create or replace function public.protect_profile_columns()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.permanent_lesson_link := old.permanent_lesson_link;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ==========================================================
-- 2) Configurações gerais do app (usado para bloquear/desbloquear os Guias de Gramática)
-- ==========================================================
create table if not exists public.app_settings (
  key text primary key,
  value text
);
alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings for select using ( true );

drop policy if exists "app_settings_insert" on public.app_settings;
create policy "app_settings_insert" on public.app_settings for insert with check ( public.is_admin() );

drop policy if exists "app_settings_update" on public.app_settings;
create policy "app_settings_update" on public.app_settings for update using ( public.is_admin() );

insert into public.app_settings(key, value) values ('grammar_guides_locked','true')
on conflict (key) do nothing;

-- ==========================================================
-- 3) Materiais dos Guias de Gramática (Básico / Intermediário / Avançado)
-- ==========================================================
create table if not exists public.grammar_materials (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('basico','intermediario','avancado')),
  title text not null,
  file_path text not null,
  created_at timestamp with time zone default now()
);
alter table public.grammar_materials enable row level security;

-- Só é possível VER os materiais se: for admin, OU o conteúdo estiver desbloqueado
drop policy if exists "grammar_materials_select" on public.grammar_materials;
create policy "grammar_materials_select" on public.grammar_materials
  for select using (
    public.is_admin() or exists (
      select 1 from public.app_settings where key = 'grammar_guides_locked' and value = 'false'
    )
  );

drop policy if exists "grammar_materials_insert" on public.grammar_materials;
create policy "grammar_materials_insert" on public.grammar_materials
  for insert with check ( public.is_admin() );

drop policy if exists "grammar_materials_delete" on public.grammar_materials;
create policy "grammar_materials_delete" on public.grammar_materials
  for delete using ( public.is_admin() );

-- ==========================================================
-- 4) Permissões de arquivo (Storage) para a pasta compartilhada "grammar"
--    dentro do bucket "materiais" já existente
-- ==========================================================
drop policy if exists "materiais_select_grammar" on storage.objects;
create policy "materiais_select_grammar" on storage.objects
  for select using (
    bucket_id = 'materiais' and (storage.foldername(name))[1] = 'grammar' and (
      public.is_admin() or exists (
        select 1 from public.app_settings where key = 'grammar_guides_locked' and value = 'false'
      )
    )
  );

drop policy if exists "materiais_insert_grammar" on storage.objects;
create policy "materiais_insert_grammar" on storage.objects
  for insert with check (
    bucket_id = 'materiais' and (storage.foldername(name))[1] = 'grammar' and public.is_admin()
  );

drop policy if exists "materiais_delete_grammar" on storage.objects;
create policy "materiais_delete_grammar" on storage.objects
  for delete using (
    bucket_id = 'materiais' and (storage.foldername(name))[1] = 'grammar' and public.is_admin()
  );
