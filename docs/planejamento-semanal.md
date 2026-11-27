# Planejamento semanal do professor

O card da visão geral usa os mesmos calendários salvos que a Agenda de hoje. Cada aula individual ou coletiva aparece uma vez por data. A semana começa na segunda-feira; os botões navegam entre semanas. A preparação é independente da frequência e não altera a numeração, reposições ou status.

- Clique em **Preparar** (ou **Editar**) para definir o tema, anotações e arrastar arquivos. A classificação usa a regra dos materiais existentes e pode ser corrigida manualmente.
- **Marcar como preparada** é um controle do professor, não um registro de presença. Salve para manter os dados entre sessões.
- Se uma aula sair da agenda, o planejamento fica disponível na semana original com aviso. Não é descartado automaticamente.
- No calendário da data, marque a aula como realizada e clique em **Usar planejamento semanal** no cadastro da aula. Os arquivos são copiados para o rascunho privado do calendário; em turma, selecione o destinatário de cada relatório de desempenho antes de salvar. A publicação continua sob o fluxo existente de **Salvar calendário**. Para uma aula reagendada, o importador também procura a preparação da data original.
- O planejamento original permanece privado, mesmo depois da publicação de uma cópia. Arquivos de planejamento podem ser baixados/removidos sem afetar os materiais publicados.

## Implantação

1. Depois da aprovação da PR, aplicar `supabase-weekly-lesson-planning.sql` no projeto Supabase do portal antes do merge.
2. Confirmar que a tabela tem RLS ativo, acesso de anon revogado e política exclusiva de administradores. Confirmar que o bucket `lesson-planning` é privado, com políticas de leitura, inserção, remoção para administradores e proteção restritiva para não administradores. Executar testes de acesso com JWT/role de aluno e admin numa transação de teste, sem dados reais publicados.
3. Efetuar merge e verificar deployment de produção.
4. A prévia `admin-home-calendar-preview.html` usa armazenamento em memória e dados fictícios. Ao recarregar, os exemplos voltam ao estado inicial; o botão de calendário informa o comportamento do portal real.

Limite de 50 MB por arquivo e 30 arquivos por aula, sujeito também aos limites globais do Storage. Uma falha de rede mantém o formulário em edição para nova tentativa. Quando a confirmação do banco é ambígua, arquivos privados recém-enviados são preservados para evitar perda; uma posterior limpeza de arquivos órfãos pode ser necessária.

Testes: `node --test tests/*.test.mjs`.
