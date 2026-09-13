-- ==========================================================
-- ATUALIZAÇÃO 9 — Link de videoaula (YouTube) nos Guias de Gramática
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

alter table public.grammar_materials
  add column if not exists youtube_link text,
  add column if not exists video_visible boolean not null default false;
