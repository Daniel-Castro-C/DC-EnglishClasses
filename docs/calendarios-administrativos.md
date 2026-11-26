# Calendários administrativos

O calendário do aluno e o calendário da turma usam o mesmo componente mensal em `js/admin-calendar-test.js`. Ambos permitem editar horários habituais, alterações de recorrência por data, status, horário e observações de uma aula, além de agendar reposições.

## Uso

- Clique em uma data. As alterações válidas entram no rascunho; o mês e os registros são atualizados imediatamente na tela.
- Para excluir uma aula prevista na recorrência, clique em **Excluir registro de aula**. Uma exceção `skip` impede que o dia reapareça pela recorrência; a recorrência das outras datas não muda. Registros manuais em dias não habituais são removidos.
- Para reagendar uma aula agendada, escolha **Reagendar para...** em **Status da aula** e selecione a nova data. A origem fica com status **Reagendado**; a nova data fica agendada e vinculada à origem. Datas já ocupadas, feriados e recessos são protegidos. Reagendamentos são distintos de reposições.
- Excluir a nova data de um reagendamento ainda não realizado cancela o vínculo e restaura a origem. Excluir a data original cancela o vínculo e retira a aula dessa data. Aulas já cadastradas com materiais não são removidas por operações do calendário.
- Na turma, a frequência pode ser ajustada para todos ou individualmente. A reposição coletiva continua disponível apenas quando todos os integrantes faltam. As datas da turma são gerenciadas em seu próprio calendário, inclusive quando acessadas pelo perfil individual.
- Clique em **Salvar calendário** ao terminar. A confirmação individual usa `save_admin_calendar`; a confirmação coletiva usa `portal_group_calendar_save` (uma transação para todos os integrantes). Não é necessária uma migração de banco.
- As alterações ainda não salvas são mantidas na memória da sessão ao alternar páginas e meses. **Descartar alterações** elimina o rascunho; **Atualizar do servidor** exige confirmação se houver rascunho. O navegador alerta ao tentar recarregar/fechar com alterações pendentes.
- Conflitos de revisão e falhas de gravação não confirmam as alterações. Rascunhos que afetam o mesmo aluno não podem sobrescrever uns aos outros.

## Validação

`node --test tests/*.test.mjs` cobre exclusões de datas habituais/manuais, reagendamentos e vínculos, proteção de aulas cadastradas, frequência coletiva, projeção de horários, integração com agenda, renderização compartilhada e salvamento por revisão.
