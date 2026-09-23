-- ==========================================================
-- ATUALIZAÇÃO 16 — Dia e horário fixo da aula (para ordenar a lista de alunos)
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

alter table public.profiles
  add column if not exists lesson_weekday smallint check (lesson_weekday between 1 and 7), -- 1=Segunda ... 7=Domingo
  add column if not exists lesson_time time;

-- Atualiza a trava de segurança para também proteger o dia/horário da aula
-- (só o professor pode alterar; o aluno não consegue editar isso, mesmo "por fora")
create or replace function public.protect_profile_columns()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.permanent_lesson_link := old.permanent_lesson_link;
    new.lesson_weekday := old.lesson_weekday;
    new.lesson_time := old.lesson_time;
  end if;
  return new;
end;
$$ language plpgsql security definer;
