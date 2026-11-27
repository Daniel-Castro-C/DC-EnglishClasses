# Calendários administrativos

O calendário do aluno e o calendário da turma usam o mesmo componente mensal em `js/admin-calendar-test.js`. Ambos permitem editar horários habituais, alterações de recorrência por data, status, horário e observações de uma aula, além de agendar reposições.

## Uso

- Clique em uma data. As alterações válidas entram no rascunho; o mês e os registros são atualizados imediatamente na tela.
- Para excluir uma aula prevista na recorrência, clique em **Excluir registro de aula**. Uma exceção `skip` impede que o dia reapareça pela recorrência; a recorrência das outras datas não muda. Registros manuais em dias não habituais são removidos.
- Para reagendar uma aula agendada, escolha **Reagendar para...** em **Status da aula** e selecione a nova data. A origem fica com status **Reagendado**; a nova data fica agendada e vinculada à origem. Datas já ocupadas são protegidas; feriados e recessos podem receber aulas excepcionais. Reagendamentos são distintos de reposições.
- Excluir a nova data de um reagendamento ainda não realizado cancela o vínculo e restaura a origem. Excluir a data original cancela o vínculo e retira a aula dessa data. Para aulas já cadastradas com materiais, use **Excluir aula**: a data fica vazia no rascunho e a confirmação remove a aula, os vínculos dos materiais e o evento. A exceção impede que a recorrência recrie a aula. A exclusão coletiva é espelhada em todos os integrantes.
- Na turma, a frequência pode ser ajustada para todos ou individualmente. A reposição coletiva continua disponível apenas quando todos os integrantes faltam e o status coletivo não é **Falta sem reposição**. Selecionar esse status de forma explícita contabiliza a falta para todos sem gerar débito, mesmo que todos faltem. Isso também vale para aulas cadastradas e para a Agenda de hoje. Uma reposição já vinculada precisa ser removida antes de converter a falta original em falta sem reposição. As datas da turma são gerenciadas em seu próprio calendário, inclusive quando acessadas pelo perfil individual.
- Se uma data habitual da turma contém uma antiga exclusão individual simples (sem aula cadastrada nem vínculos), o calendário da turma oferece **Sincronizar com a turma**. Também é possível alterar o status ou excluir a data para todos; nada é gravado até salvar. Registros independentes e vínculos de reposição/reagendamento continuam protegidos.
- Clique em **Salvar calendário** ao terminar. A confirmação individual usa `save_admin_calendar`; a confirmação coletiva usa `portal_group_calendar_save` (uma transação para todos os integrantes). Quando há aulas cadastradas marcadas para exclusão, a confirmação usa `portal_calendar_save_with_deletions`, que remove esses cadastros e atualiza os calendários na mesma transação. Esta operação requer a migração `supabase-calendar-lesson-numbering.sql` após a aprovação da PR.
- As alterações ainda não salvas são mantidas na memória da sessão ao alternar páginas e meses. **Descartar alterações** elimina o rascunho; **Atualizar do servidor** exige confirmação se houver rascunho. O navegador alerta ao tentar recarregar/fechar com alterações pendentes.
- Conflitos de revisão e falhas de gravação não confirmam as alterações. Rascunhos que afetam o mesmo aluno não podem sobrescrever uns aos outros.

## Validação

`node --test tests/*.test.mjs` cobre exclusões de datas habituais/manuais, reagendamentos e vínculos, proteção de aulas cadastradas, frequência coletiva, projeção de horários, integração com agenda, renderização compartilhada e salvamento por revisão.

- Em **Editar aula**, altere **Data da aula** e salve o calendário. A data anterior é suprimida e a nova recebe o registro realizado (inclusive os materiais e a frequência); a numeração automática acompanha a cronologia. A operação exige a migração `supabase-calendar-lesson-moves.sql`, a aplicar após aprovação.
- Feriados nacionais previstos para 2027 ficam cinza, assim como os recessos globais. Aulas excepcionais podem ser cadastradas nessas datas. Carnaval e Corpus Christi são pontos facultativos e não foram incluídos automaticamente; podem ser adicionados na Agenda.
