-- ==========================================================
-- ATUALIZAÇÃO 2 — Perfil, Financeiro e Link permanente da aula
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- (Isso é além do supabase-setup.sql original — rode este depois daquele)
-- ==========================================================

-- 1) Novos campos no perfil de cada pessoa
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists permanent_lesson_link text,
  add column if not exists payment_day int check (payment_day between 1 and 31),
  add column if not exists monthly_fee numeric(10,2);

-- ==========================================================
-- 2) SEGURANÇA EXTRA: impede que um aluno edite (mesmo tentando "por fora")
--    seus próprios dados financeiros, o link da aula, ou vire admin.
--    Só o professor (admin) pode alterar esses campos.
--    O aluno só pode alterar: nome (full_name) e foto (avatar_url).
-- ==========================================================
create or replace function public.protect_profile_columns()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.payment_day := old.payment_day;
    new.monthly_fee := old.monthly_fee;
    new.permanent_lesson_link := old.permanent_lesson_link;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_profile_columns_trigger on public.profiles;
create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile_columns();

-- ==========================================================
-- 3) FOTOS DE PERFIL (Storage)
--    Antes de rodar o restante: vá em Storage > New bucket
--    Nome: avatars   |   Public bucket: MARQUE COMO PÚBLICO (diferente do "materiais")
--    Fotos de perfil podem ser públicas, então isso simplifica a exibição.
-- ==========================================================
drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select using ( bucket_id = 'avatars' );

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    )
  );

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    )
  );

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (
      (storage.foldername(name))[1] = auth.uid()::text or public.is_admin()
    )
  );
