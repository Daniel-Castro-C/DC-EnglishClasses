-- ==========================================================
-- ATUALIZAÇÃO 6 — Editar/excluir pergunta (aluno) e minimizar respondidas (professor)
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique em Run.
-- ==========================================================

-- Permite que o ALUNO edite a própria pergunta, só enquanto ela ainda não tiver resposta
drop policy if exists "daniel_questions_update_student" on public.daniel_questions;
create policy "daniel_questions_update_student" on public.daniel_questions
  for update using ( student_id = auth.uid() and answer is null )
  with check ( student_id = auth.uid() and answer is null );

-- Permite que o ALUNO exclua a própria pergunta, só enquanto ela ainda não tiver resposta
drop policy if exists "daniel_questions_delete_student" on public.daniel_questions;
create policy "daniel_questions_delete_student" on public.daniel_questions
  for delete using ( student_id = auth.uid() and answer is null );
