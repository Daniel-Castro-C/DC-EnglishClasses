# Padronização terminológica do Portal DC

Use a nomenclatura abaixo em títulos, menus, formulários, notificações e textos explicativos. A tradução PT/EN dos tipos de material e dos recursos fica em `js/common.js`; reutilize as chaves existentes em vez de redefini-las em outro módulo.

| Conceito | Português (preferido) | English | Evitar como rótulo da mesma função |
|---|---|---|---|
| Tipo de material `rep` | Relatório de desempenho | Performance report | Relatório de performance |
| Tipo `ppt` | Slides | Slides | Slides (PPT), apresentações como categoria |
| Tipo `ex` | Exercícios | Exercises | Exercise em interface PT, Exercício como categoria |
| Tipo `pdf` | PDF | PDF | — |
| Tipo desconhecido | Arquivo | File | File em interface PT |
| Aplicação do aluno | Portal do aluno | Student portal | Área do aluno, Painel do aluno como nome da aplicação |
| Aplicação administrativa | Painel do professor | Teacher dashboard | — |
| Página inicial do aluno | Início | Home | Home como rótulo em PT |
| Perfil | Perfil | Profile | Meu perfil como rótulo alternativo |
| Conteúdo diário | Termo do dia | Word of the day | Palavra do dia, Word of the Day em interface PT |
| Recurso de vocabulário | Expandindo seu vocabulário | Expanding your vocabulary | Novos Vocabulários / New Vocabulary |
| Recurso de escrita | Aprimorando a Escrita | Improving Your Writing | Devolutiva como nome da correção |
| Guias | Guias de Gramática | Grammar Guides | Guias de gramática como rótulo de menu alternativo |
| Envios do aluno para uso em aula | Pedidos de material | Material requests | Materiais recebidos / Materiais do aluno |
| Pergunte ao Daniel | Perguntas | Questions | Dúvidas como rótulo concorrente na caixa de entrada |
| Estado de pergunta não respondida | Aguardando resposta | Waiting for answer | Aguardando (sem contexto) |
| Estado da correção entregue | Correção pronta | Correction ready | Correção disponível |
| Aulas ocorridas | Realizada / realizadas | Completed | Concluídas como rótulo do mesmo estado |
| Conquistas | Mural de conquistas | Achievement wall | Badge como termo da interface PT |

## Regras para manutenção

- `materialTypeLabel(type, lang)` é a fonte de rótulos dos materiais em cadastro, listagem e materiais recentes.
- `materialDisplayName(resource)` normaliza somente a expressão legada de relatórios do tipo `rep` na exibição. Nomes gravados e caminhos existentes não são reescritos.
- Identificadores técnicos (`rep`, `ppt`, `done`, tabelas, nomes de funções, IDs e rotas) não são texto de interface. Não os renomeie por motivos editoriais.
- Termos do conteúdo didático em inglês, títulos de aulas, nomes personalizados dos materiais e expressões genéricas podem ser distintos. Não traduza nem substitua indiscriminadamente.
- Agenda é a visão global; Calendário é o controle individual ou compartilhado da turma. Enviar material é a ação do aluno, Pedidos de material é a coleção recebida pelo professor. Modo visitante e Modo aluno de teste são ambientes distintos.
- O PDF estático `guia-portal-do-aluno.pdf` é um guia histórico sem fonte editável no repositório; refere-se à Área do aluno como página inicial. Sua atualização editorial completa deve acompanhar a renovação do guia (não alterar o PDF sem sua fonte).
- Os PDFs demonstrativos novos são gerados com o rótulo padronizado; antigos caminhos públicos permanecem como aliases de compatibilidade. O texto pedagógico dos PDFs continua em inglês.
