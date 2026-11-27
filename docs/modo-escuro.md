# Revisão de contraste do Portal DC

Escopo: portal autenticado do professor e do aluno, login e recuperação de senha. Landing page e arquivos de aula (PDF, PPT, etc.) não são tematizados por esta alteração.

## Auditoria

| Área | Correção |
| --- | --- |
| Visão geral, agenda de hoje, calendário mensal | Superfícies azuis escuras com nomes/horários claros, dia atual legível, estados de agenda e botões. |
| Calendários individuais e de turmas | Células selecionadas, feriados/recessos em cinza escuro, frequência, status, controles de data e hora, materiais. |
| Central de pendências, planejamento semanal, atividades recentes, perfil e busca | Textos secundários, ações de abrir/salvar/descartar, links, estados e contadores. |
| Home do aluno, chamada, conquistas e menus | Ícones, links, botões, texto de apoio e modal de celebração. |
| Minhas aulas, recursos, guias, perguntas e envio de materiais | Ícones de arquivos, etiquetas, status de estudo/correção, campos, botão de arquivo e mensagens. |
| Login, senha e informações de perfil | Campos, foco, placeholders, mensagens de erro/sucesso e links; login/recuperação respeitam a preferência local. |

As combinações principais de texto normal verificadas em testes têm razão mínima de 4,5:1; bordas dos controles verificadas têm razão mínima de 3:1. A combinação de nomes em eventos mensais tem 9,35:1; a de horários, 6,99:1. A paleta clara mantém seus valores existentes. Os tokens de marca `--ink` e `--ink-dark` permanecem estáveis; fundos de status e cores de texto usam tokens separados.

## Prévia

Abrir `admin-home-calendar-preview.html?theme=dark`, `calendar-preview.html?theme=dark`, `home-lesson-preview.html?theme=dark` ou `student-resources-preview.html?theme=dark` para conferir componentes reais com informações fictícias. O botão Alternar tema não modifica preferências persistidas.

`node --test tests/*.test.mjs` inclui testes de contraste usando a luminância relativa das cores encontradas no CSS. Eles não substituem uma auditoria visual em navegador com dados reais.
