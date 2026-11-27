/* Shared dashboard rows and activity view, also used by the isolated preview. */
const ACTIVITY_LABELS = {
  login: 'Acessou o portal',
  preview_material: 'Visualizou material',
  download_material: 'Baixou um material de aula',
  download_grammar: 'Baixou um material de gramática',
  material_request: 'Enviou um pedido de material',
  daniel_question: 'Fez uma pergunta ao Daniel'
};

function crmActivityPageHtml(refreshAction){
  return '<header class="crm-heading"><div><h1>Atividades recentes</h1><p>Acompanhe as últimas atividades dos alunos no portal.</p></div></header>'+
    '<section class="crm-panel crm-activity-panel"><div class="crm-panel-head"><h3>Últimas atividades</h3><button type="button" class="btn-ghost" onclick="'+refreshAction+'">Atualizar</button></div>'+
    '<p class="crm-muted">Até 50 registros, do mais recente ao mais antigo.</p>'+
    '<div id="admin-recent-activity-list" aria-live="polite"><p class="crm-empty">Carregando atividades...</p></div></section>';
}
function crmActivityRows(logs, profiles){
  if (!logs.length) return '<p class="crm-empty">Ainda não há atividades registradas.</p>';
  const names = new Map(profiles.map(s => [s.id, s.full_name || s.email]));
  return logs.map(log => {
    const date = new Date(log.created_at);
    const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
    const action = ACTIVITY_LABELS[log.action] || log.action;
    return '<div class="admin-activity-row"><span class="admin-activity-marker" aria-hidden="true"></span>'+
      '<div><strong>'+escapeHtml(names.get(log.student_id) || 'Aluno')+'</strong><small>'+escapeHtml(action)+'</small></div><time>'+escapeHtml(when)+'</time></div>';
  }).join('');
}

function crmGroupedLessons(pendencies){
 const groups=new Map();
 for(const p of pendencies){
  const l=p.lesson,g=tgGroups.find(x=>x.id===l.group_id);
  const key=g&&l.lesson_date?g.id+'|'+l.lesson_date+'|'+(p.missingLesson?'missing':'report'):'single|'+(l.id||l.student_id+'|'+l.lesson_date);
  if(!groups.has(key))groups.set(key,{g,rows:[]});groups.get(key).rows.push(p);
 }
 return [...groups.values()].map(({g,rows})=>{
  const first=rows[0],l=first.lesson;
  const detail=(first.missingLesson?'Cadastro da aula e relatório pendentes':'Relatório pendente')+' · '+(l.lesson_date?formatDate(l.lesson_date):l.title)+(g?' · '+rows.length+' de '+g.members.length+' alunos':'');
  const buttons=({lesson,missingLesson})=>missingLesson?[
   '<button class="btn-ghost" onclick="'+ccEsc(g?"tgOpenMissing('"+g.id+"','"+lesson.lesson_date+"')":"openMissingLesson('"+lesson.student_id+"','"+lesson.lesson_date+"')")+'">Cadastrar aula</button>',
   crmDismissButton(lesson.student_id,'missing:'+lesson.lesson_date)
  ]:[
   '<button class="btn-ghost" onclick="openPendingReport(&quot;'+ccEsc(lesson.student_id)+'&quot;,&quot;'+ccEsc(lesson.id)+'&quot;)">Adicionar relatório</button>',
   '<button class="resource-action" onclick="dismissReportPending(&quot;'+ccEsc(lesson.id)+'&quot;)">Descartar pendência</button>'
  ];
  return g?crmPendingRow('file',g.name,detail,'',rows.map(p=>crmPendingMember(p.studentName,...buttons(p))).join('')):crmPendingRow('file',first.studentName,detail,crmPendingActions(...buttons(first)));
 }).join('')||'<div class="small-note">Nenhuma aula realizada aguarda cadastro ou relatório.</div>';
}
