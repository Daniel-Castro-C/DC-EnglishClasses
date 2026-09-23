-- ==========================================================
-- Update 13 — Idioma do portal (PT/EN) para os alunos
-- Cole este SQL inteiro no Supabase SQL Editor e rode.
-- ==========================================================

-- Coluna que guarda o idioma escolhido pelo aluno ('pt' ou 'en')
alter table profiles
  add column if not exists preferred_language text not null default 'pt';

-- Garante que só aceita 'pt' ou 'en'
alter table profiles
  drop constraint if exists profiles_preferred_language_check;

alter table profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('pt', 'en'));

-- Garante que o próprio aluno pode atualizar essa coluna (a policy de update
-- de profiles já existente permite o aluno editar seu próprio perfil; esta
-- coluna entra automaticamente nela, não precisa de policy nova).
