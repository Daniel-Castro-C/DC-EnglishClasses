-- ==========================================================
-- ATUALIZAÇÃO 11 — Segundo arquivo (PT + EN) para materiais do nível Básico
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

alter table public.grammar_materials
  add column if not exists file_path_en text;
