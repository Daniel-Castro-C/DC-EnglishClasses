-- ==========================================================
-- ATUALIZAÇÃO 13 — Anexos nos Comunicados
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

-- Permite que qualquer aluno logado baixe um anexo de comunicado
-- (os arquivos ficam na pasta "comunicados" dentro do bucket "materiais").
drop policy if exists "materiais_select_comunicados" on storage.objects;
create policy "materiais_select_comunicados" on storage.objects
  for select using (
    bucket_id = 'materiais'
    and (storage.foldername(name))[1] = 'comunicados'
    and auth.uid() is not null
  );
