/* Prévia isolada de Turmas: nenhum lançamento real é criado nesta versão. */
let tgGroups=[],tgSelected=null,tgTab='calendar',tgFiles=[];
const tgEsc=v=>escapeHtml(String(v??''));
function tgMembers(){return (tgSelected?.members||[]).map(id=>students.find(s=>s.id===id)).filter(Boolean);}
function tgOpen(){currentView='turmas';currentStudent=null;renderNav();tgRender();}
function tgRender(){
 const root=document.getElementById('main-content');
 const real=students.filter(s=>!s.is_test_profile);
 root.innerHTML='<header class="crm-heading"><div><h1>Turmas</h1><p>Gerencie aulas em dupla ou em grupo.</p></div><button class="btn-dark-sm" onclick="tgNew()">+ Nova turma</button></header><p class="small-note">Prévia de teste: turmas e lançamentos simulados nesta sessão, sem publicar materiais ou modificar calendários reais.</p><div id="tg-list"></div><div id="tg-detail"></div>';
 document.getElementById('tg-list').innerHTML='<div class="crm-panel" style="margin-bottom:18px">'+(tgGroups.map(g=>'<button class="btn-ghost" style="margin:8px" onclick="tgSelect(&quot;'+tgEsc(g.id)+'&quot;)">'+tgEsc(g.name)+' · '+g.members.length+' alunos</button>').join('')||'<p>Nenhuma turma de teste criada.</p>')+'</div>';
 if(tgSelected)tgDetail();
}
function tgNew(){
 document.getElementById('tg-detail').innerHTML='<section class="crm-panel"><h3>Nova turma</h3><label>Nome da turma<input id="tg-name" placeholder="Ex.: Laryssa e Barbara"></label><h4>Integrantes</h4>'+students.filter(s=>!s.is_test_profile).map(s=>'<label style="display:flex;align-items:center;gap:8px;margin:10px 0"><input style="width:auto;min-height:0" type="checkbox" name="tg-members" value="'+tgEsc(s.id)+'">'+tgEsc(s.full_name||s.email)+'</label>').join('')+'<button class="btn-dark-sm" onclick="tgCreate()">Criar turma de teste</button></section>';
}
function tgCreate(){const name=document.getElementById('tg-name').value.trim(),members=[...document.querySelectorAll('[name=tg-members]:checked')].map(e=>e.value);if(!name||members.length<2)return alert('Informe o nome e selecione pelo menos dois alunos.');tgSelected={id:crypto.randomUUID(),name,members,days:'',time:'',start:'',end:'',events:{},lessons:[]};tgGroups.push(tgSelected);tgTab='calendar';tgRender();}
function tgSelect(id){tgSelected=tgGroups.find(g=>g.id===id);tgTab='calendar';tgDetail();}
function tgSwitch(tab){tgTab=tab;tgDetail();}
function tgDetail(){
 const g=tgSelected;if(!g)return;
 document.getElementById('tg-detail').innerHTML='<section class="crm-panel"><div class="crm-panel-head"><div><h3>'+tgEsc(g.name)+'</h3><p class="small-note">'+tgMembers().map(s=>tgEsc(s.full_name||s.email)).join(' · ')+'</p></div></div><div class="row"><button class="btn-ghost" onclick="tgSwitch(&quot;calendar&quot;)">Calendário</button><button class="btn-ghost" onclick="tgSwitch(&quot;lesson&quot;)">Cadastrar aula</button><button class="btn-ghost" onclick="tgSwitch(&quot;history&quot;)">Histórico</button></div><div id="tg-body"></div></section>';
 if(tgTab==='calendar')tgCalendar();else if(tgTab==='lesson')tgLesson();else tgHistory();
}
function tgCalendar(){const g=tgSelected;document.getElementById('tg-body').innerHTML='<h3>Calendário compartilhado</h3><div class="row"><label>Início<input type="date" id="tg-start" value="'+tgEsc(g.start)+'"></label><label>Fim (opcional)<input type="date" id="tg-end" value="'+tgEsc(g.end)+'"></label><label>Horário<input type="time" id="tg-time" value="'+tgEsc(g.time)+'"></label></div><div class="cc-weekday-group">'+ccDayInputs(g.days,'tg-day')+'</div><button class="btn-dark-sm" onclick="tgSaveSchedule()">Salvar calendário de teste</button><hr><h3>Frequência individual</h3><label>Data da aula<input type="date" id="tg-date" value="'+adminToday().date+'" onchange="tgAttendance()"></label><div id="tg-attendance"></div><button class="btn-dark-sm" onclick="tgSaveAttendance()">Registrar frequência de teste</button>';tgAttendance();}
function tgSaveSchedule(){const g=tgSelected,start=document.getElementById('tg-start').value,end=document.getElementById('tg-end').value,time=document.getElementById('tg-time').value,days=ccPickedDays('tg-day');if(!start||!time||!days||end&&end<start)return alert('Confira as datas, dias habituais e horário.');Object.assign(g,{start,end,time,days});alert('Calendário compartilhado simulado. Nenhum calendário real foi alterado.');}
function tgAttendance(){const date=document.getElementById('tg-date').value;document.getElementById('tg-attendance').innerHTML=tgMembers().map(s=>'<label>'+tgEsc(s.full_name||s.email)+'<select data-tg-person="'+tgEsc(s.id)+'">'+Object.entries(ccStatus).map(([k,v])=>'<option value="'+k+'" '+((tgSelected.events[date]?.[s.id]||'done')===k?'selected':'')+'>'+tgEsc(v)+'</option>').join('')+'</select></label>').join('');}
function tgSaveAttendance(){const d=document.getElementById('tg-date').value;if(!d)return alert('Informe a data.');tgSelected.events[d]=Object.fromEntries([...document.querySelectorAll('[data-tg-person]')].map(e=>[e.dataset.tgPerson,e.value]));alert('Frequência simulada por aluno.');}
function tgLesson(){document.getElementById('tg-body').innerHTML='<h3>Cadastrar aula para a turma</h3><label>Título<input id="tg-title"></label><label>Tema<input id="tg-topic"></label><label>Data<input id="tg-lesson-date" type="date" value="'+adminToday().date+'"></label><hr><h3>Materiais compartilhados</h3><p class="small-note">Selecione os slides e exercícios uma única vez.</p><label>Slides<input id="tg-slides" type="file" multiple accept=".pdf,.ppt,.pptx"></label><label>Exercícios<input id="tg-exercises" type="file" multiple></label><hr><h3>Relatórios de performance individuais</h3>'+tgMembers().map(s=>'<div class="box"><label>'+tgEsc(s.full_name||s.email)+'<input type="file" data-tg-report="'+tgEsc(s.id)+'" accept=".pdf,.doc,.docx"></label><p class="small-note">Exclusivo deste aluno.</p></div>').join('')+'<button class="btn-primary" onclick="tgSaveLesson()">Simular cadastro da aula</button>';}
function tgSaveLesson(){const title=document.getElementById('tg-title').value.trim(),date=document.getElementById('tg-lesson-date').value;if(!title||!date)return alert('Informe título e data.');const files=id=>[...document.getElementById(id).files].map(f=>f.name);tgSelected.lessons.push({id:crypto.randomUUID(),title,date,topic:document.getElementById('tg-topic').value,slides:files('tg-slides'),exercises:files('tg-exercises'),reports:Object.fromEntries([...document.querySelectorAll('[data-tg-report]')].map(e=>[e.dataset.tgReport,e.files[0]?.name||'Pendente']))});tgSwitch('history');}
function tgHistory(){document.getElementById('tg-body').innerHTML='<h3>Aulas simuladas</h3>'+ (tgSelected.lessons.map(l=>'<div class="box"><h3>'+tgEsc(l.title)+'</h3><p>'+tgEsc(l.date)+' · '+tgEsc(l.topic)+'</p><p>Slides: '+tgEsc(l.slides.join(', ')||'—')+'</p><p>Exercícios: '+tgEsc(l.exercises.join(', ')||'—')+'</p>'+tgMembers().map(s=>'<p><strong>'+tgEsc(s.full_name||s.email)+'</strong> · Relatório: '+tgEsc(l.reports[s.id])+'</p>').join('')+'</div>').join('')||'<p>Nenhuma aula simulada.</p>')+'<h3>Frequências registradas</h3>'+Object.entries(tgSelected.events).map(([d,e])=>'<div class="box"><strong>'+tgEsc(d)+'</strong>'+tgMembers().map(s=>'<p>'+tgEsc(s.full_name||s.email)+' · '+tgEsc(ccStatus[e[s.id]])+'</p>').join('')+'</div>').join('');}

/* Pendências da simulação: agrupadas pela aula/turma, nunca por nome ou data apenas.
   Não modifica a central real nem grava dados no Supabase. */
function tgPendingSummary(){
 const rows=[];
 for(const g of tgGroups){
  for(const l of g.lessons){
   const ids=g.members.filter(id=>l.reports[id]==='Pendente'&&(!g.events[l.date]?.[id]||g.events[l.date][id]==='done'));
   if(ids.length)rows.push({g,l,ids,type:'report'});
  }
  const dates=Object.entries(g.events);
  for(const [date,attendance] of dates){
   const ids=g.members.filter(id=>['owed','teacher'].includes(attendance[id])&&!g.resolvedReplacements?.[date]?.[id]);
   if(ids.length)rows.push({g,date,ids,type:'replacement'});
  }
 }
 return rows;
}
function tgPendingHtml(){
 const rows=tgPendingSummary();
 if(!tgGroups.length)return '';
 const name=id=>tgEsc(students.find(s=>s.id===id)?.full_name||'Aluno');
 return '<div class="box" style="margin-top:16px"><h3>Turmas — pendências de teste</h3><p class="small-note">Simulação separada dos registros reais · '+rows.reduce((n,r)=>n+r.ids.length,0)+' pendência(s) individual(is).</p>'+ (rows.map(r=>'<div class="crm-pending-row">'+crmIcon(r.type==='report'?'file':'refresh')+'<div class="crm-pending-text"><strong>'+tgEsc(r.g.name)+'</strong><small>'+(r.type==='report'?'Relatório pendente · '+tgEsc(r.l.title)+' · '+tgEsc(r.l.date):'Reposição pendente · '+tgEsc(r.date))+' · '+r.ids.length+' de '+r.g.members.length+' alunos</small>'+r.ids.map(id=>'<div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span>'+name(id)+'</span>'+(r.type==='report'?'<button class="btn-ghost" onclick="tgResolveReport(&quot;'+r.g.id+'&quot;,&quot;'+r.l.id+'&quot;,&quot;'+id+'&quot;)">Adicionar relatório</button>':'<button class="btn-ghost" onclick="tgResolveReplacement(&quot;'+r.g.id+'&quot;,&quot;'+r.date+'&quot;,&quot;'+id+'&quot;)">Registrar reposição</button>')+'</div>').join('')+'</div></div>').join('')||'<p class="small-note">Nenhuma pendência simulada.</p>')+'</div>';
}
function tgRefreshPending(){const el=document.getElementById('tg-home-pending');if(el)el.innerHTML=tgPendingHtml();}
function tgResolveReport(groupId,lessonId,studentId){
 const lesson=tgGroups.find(g=>g.id===groupId)?.lessons.find(l=>l.id===lessonId);
 if(!lesson||lesson.reports[studentId]!=='Pendente')return;
 const input=document.createElement('input');input.type='file';input.accept='.pdf,.doc,.docx';
 input.onchange=()=>{if(!input.files[0])return;lesson.reports[studentId]=input.files[0].name;tgRefreshPending();};
 input.click();
}
function tgResolveReplacement(groupId,date,studentId){
 const g=tgGroups.find(g=>g.id===groupId);if(!g||!['owed','teacher'].includes(g.events[date]?.[studentId]))return;
 if(!confirm('Simular a conclusão da reposição deste aluno? Nenhum calendário real será alterado.'))return;
 g.resolvedReplacements??={};g.resolvedReplacements[date]??={};g.resolvedReplacements[date][studentId]=true;tgRefreshPending();
}
