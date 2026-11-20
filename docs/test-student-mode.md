# Modo Aluno de Teste (professor)

Este recurso **não cria uma conta fictícia**. Na sessão autenticada do administrador, a interface do aluno usa o mesmo UUID do professor como `student_id`. O papel real em `public.profiles` continua sendo `admin`. O modo é habilitado apenas por ação do professor, validada novamente via Supabase Auth + perfil.

## Como usar

1. Entre normalmente no painel do professor.
2. Clique em **Modo Aluno de Teste** no menu lateral.
3. Explore a Home, Minhas aulas, Guias de Gramática, Pergunte ao Daniel, Materiais e os estados de notificação.
4. Use **Voltar ao painel do professor** para retornar sem sair da conta.
5. No painel do professor, escolha **Perfil de teste → Cadastrar nova aula** para criar materiais de teste. Os registros persistem no Supabase e aparecem na área do aluno de teste.

O primeiro acesso não cria aulas automaticamente. Aulas fictícias devem ser cadastradas pelo professor, usando os formulários já existentes.

## Comunicados reais

Na seção **Comunicados**, a opção **Perfil de teste — teacherdaniel.cas@gmail.com** pode ser marcada como destinatária. O envio usa a função EmailJS já existente, com assunto, corpo e link de anexo exatamente como os demais destinatários. A opção **Todos os alunos reais** **não** seleciona o perfil de teste; escolha-o explicitamente sempre que desejar receber o e-mail de conferência.

**Não há envio automático de e-mails de teste.** O envio ocorre somente quando o professor confirmar um comunicado com Perfil de teste selecionado. Pedidos de material, dúvidas e textos de teste são registrados, mas não enviam e-mail de notificação ao professor. Respostas de teste geram o aviso interno ao aluno sem disparar outro e-mail.

## Proteções

- A lista de alunos reais continua vindo de `profiles.role = 'student'`. O perfil de teste é apenas uma entrada local na interface do administrador.
- Aulas, materiais, perguntas, pedidos e atividades de teste usam `student_id = auth.uid()` do professor. As políticas RLS existentes continuam sendo aplicadas. Nenhuma migração, elevação de privilégio ou service role foi necessária.
- O teste é excluído dos indicadores reais de alunos, pendências de relatório e atividade recente do dashboard.
- O perfil exibido na visualização do aluno é uma projeção em memória. Nome, foto, senha e horário do professor não podem ser alterados pelas telas de perfil do modo de teste.
- Idioma e modo escuro mudam localmente durante o teste, mas os valores anteriores são restaurados ao retornar ou sair.
- O sinalizador do modo usa `sessionStorage`, vinculado à aba/sessão e ao ID da conta atual.
- O e-mail do perfil de teste é configurado em `TEACHER_TEST_EMAIL` em `js/common.js`; não depende do e-mail de login do professor.
- Os dados de testes persistem até que o professor os exclua. **Não são dados fictícios gerados em uma tabela de usuários separada**, mas registros reais associados ao UID do administrador. Não use dados sensíveis de alunos reais para criar exemplos.

## Verificações recomendadas

- [ ] Administrador consegue abrir modo teste e voltar sem sair da conta
- [ ] Estudante real não consegue acessar painel do professor ou ativar modo teste
- [ ] Perfil de teste não aparece como aluno real nem contamina estatísticas
- [ ] Cadastrar aula de teste e abrir material do teste no mesmo login
- [ ] Editar status de guia, abrir dúvidas, pedidos e notificações do teste
- [ ] Perfil do teste não permite trocar senha, nome, avatar ou agendar aula do professor
- [ ] Enviar um comunicado **somente** ao Perfil de teste e confirmar recebimento no e-mail indicado
- [ ] Selecionar "Todos os alunos reais" e verificar que Perfil de teste continua desmarcado
- [ ] Tema claro/escuro, navegação mobile e idiomas PT/EN
- [ ] Nenhum e-mail é enviado por uma ação de teste diferente de comunicado

A execução de testes automatizados **não** substitui a revisão autenticada de cada fluxo no deployment de prévia.
