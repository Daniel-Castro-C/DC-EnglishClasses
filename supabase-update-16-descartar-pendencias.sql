-- PR #5 — Descarte persistente de pendências de relatório.
-- Execute no SQL Editor do Supabase antes de validar o botão na interface.
-- Não exclui aulas, recursos nem dados existentes.

alter table public.lessons
  add column if not exists report_pending_dismissed boolean not null default false;

-- A política lessons_update existente já limita atualizações aos administradores.
-- Assim, alunos não podem descartar pendências.
comment on column public.lessons.report_pending_dismissed is
  'Oculta da Home administrativa a pendência de relatório desta aula, sem apagar a aula ou seus materiais.';
