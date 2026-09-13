-- ==========================================================
-- ATUALIZAÇÃO 10 — Subnível (A1/A2/B1/B2/C1) nos Guias de Gramática
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

alter table public.grammar_materials
  add column if not exists sublevel text;
