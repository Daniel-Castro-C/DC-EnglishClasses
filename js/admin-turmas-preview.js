/* Turmas: persistência e operações transacionais no Supabase. */
let tgGroups=[],tgSelected=null,tgTab='calendar',tgFiles=[];
const tgEsc=v=>escapeHtml(String(v??''));
function tgMembers(){return (tgSelected?.members||[]).map(id=>students.find(s=>s.id===id)).filter(Boolean);}
async function tgOpen(){currentView='turmas';currentStudent=null;renderNav();try{await tgLoad();if(currentView==='turmas')tgRender();}catch(e){alert('Não foi possível carregar turmas: '+e.message);}}
function tgRender(){
 const root=document.getElementById('main-content');
 const real=students.filter(s=>!s.is_test_profile);
 root.innerHTML='<header class="crm-heading"><div><h1>Turmas</h1><p>Gerencie aulas em dupla ou em grupo.</p></div><button class="btn-dark-sm" onclick="tgNew()">+ Nova turma</button></header><p class="small-note">Turmas persistidas no Supabase. Os lançamentos afetam os registros reais dos alunos.</p><div id="tg-list"></div><div id="tg-detail"></div>';
 document.getElementById('tg-list').innerHTML='<div class="crm-panel" style="margin-bottom:18px">'+(tgGroups.map(g=>'<button class="btn-ghost" style="margin:8px" onclick="tgSelect(&quot;'+tgEsc(g.id)+'&quot;)">'+tgEsc(g.name)+' · '+g.members.length+' alunos</button>').join('')||'<p>Nenhuma turma criada.</p>')+'</div>';
 if(tgSelected)tgDetail();
}
function tgNew(){
 document.getElementById('tg-detail').innerHTML='<section class="crm-panel"><h3>Nova turma</h3><label>Nome da turma<input id="tg-name" placeholder="Ex.: Laryssa e Barbara"></label><h4>Integrantes</h4>'+students.filter(s=>!s.is_test_profile).map(s=>'<label style="display:flex;align-items:center;gap:8px;margin:10px 0"><input style="width:auto;min-height:0" type="checkbox" name="tg-members" value="'+tgEsc(s.id)+'">'+tgEsc(s.full_name||s.email)+'</label>').join('')+'<button class="btn-dark-sm" onclick="tgCreate()">Criar turma</button></section>';
}
async function tgCreate(){const name=document.getElementById('tg-name').value.trim(),members=[...document.querySelectorAll('[name=tg-members]:checked')].map(e=>e.value);if(!name||members.length<2)return alert('Informe o nome e selecione pelo menos dois alunos.');try{const {data,error}=await sb.from('portal_groups').insert({name,members}).select().single();if(error)throw error;await tgLoad();tgSelected=tgGroups.find(g=>g.id===data.id);tgTab='calendar';tgRender();}catch(e){alert(e.message);}}
function tgSelect(id){tgSelected=tgGroups.find(g=>g.id===id);tgTab='calendar';ccDate=new Date();ccSelected='';ccActiveKey='';tgDetail();}
function tgSwitch(tab){tgTab='calendar';tgDetail();if(tab==='lesson')ccOpenSuggested();if(tab==='history')ccLessonHistory();}
function tgDetail(){
 const g=tgSelected;if(!g)return;
 document.getElementById('tg-detail').innerHTML='<section class="crm-panel"><div class="crm-panel-head"><div><h3>'+tgEsc(g.name)+'</h3><p class="small-note">'+tgMembers().map(s=>tgEsc(s.full_name||s.email)).join(' · ')+'</p></div></div><div class="row"><button class="btn-ghost" onclick="tgSwitch(&quot;calendar&quot;)">Calendário e aulas</button></div><div id="tg-body"></div></section>';
 if(tgTab==='calendar')tgCalendar();else if(tgTab==='lesson')tgLesson();else tgHistory();
}
function tgCalendar(){ccRender();}
async function tgOpenDate(groupId,date){
 currentView='turmas';currentStudent=null;renderNav();
 try{await tgLoad();tgSelected=tgGroups.find(g=>g.id===groupId);if(!tgSelected)throw Error('Turma não encontrada.');
 tgTab='calendar';ccDate=new Date(date+'T12:00:00');ccSelected=date;const draft=ccDrafts.get('group:'+groupId);if(draft){draft.date=ccDate;draft.selected=date;}ccActiveKey='';tgRender();
 }catch(e){alert(e.message);}
}
function tgLesson(){document.getElementById('tg-body').innerHTML='<h3>Cadastrar aula para a turma</h3><label>Título<input id="tg-title"></label><label>Tema<input id="tg-topic"></label><label>Data<input id="tg-lesson-date" type="date" value="'+adminToday().date+'"></label><hr><h3>Materiais compartilhados</h3><p class="small-note">Selecione os slides e exercícios uma única vez.</p><label>Slides<input id="tg-slides" type="file" multiple accept=".pdf,.ppt,.pptx"></label><label>Exercícios<input id="tg-exercises" type="file" multiple></label><hr><h3>Relatórios de desempenho individuais</h3>'+tgMembers().map(s=>'<div class="box"><label>'+tgEsc(s.full_name||s.email)+'<input type="file" data-tg-report="'+tgEsc(s.id)+'" accept=".pdf,.doc,.docx"></label><p class="small-note">Exclusivo deste aluno.</p></div>').join('')+'<button class="btn-primary" onclick="tgSaveLesson()">Cadastrar aula</button>';}
async function tgSaveLesson(){if(tgSelected.members.some(ccHasDirtyForMember))return alert('Salve o calendário da turma antes de cadastrar aulas.');const g=tgSelected,title=document.getElementById('tg-title').value.trim(),date=document.getElementById('tg-lesson-date').value,topic=document.getElementById('tg-topic').value;if(!title||!date)return alert('Informe título e data.');const members=g.members.filter(id=>{const e=ccData(students.find(s=>s.id===id)).events[date];return !e?.skip&&(!e?.status||['done','planned'].includes(e.status));});if(!members.length)return alert('Nenhum aluno presente nesta data.');if(!confirm('Publicar aula e materiais para '+members.length+' aluno(s)?'))return;const btn=document.querySelector('[onclick="tgSaveLesson()"]');if(btn.disabled)return;btn.disabled=true;const uploaded=[];try{const files=[];for(const [field,type] of [['tg-slides','ppt'],['tg-exercises','ex']])for(const file of document.getElementById(field).files)files.push({file,type});for(const el of document.querySelectorAll('[data-tg-report]'))if(el.files[0]&&members.includes(el.dataset.tgReport))files.push({file:el.files[0],type:'rep',student:el.dataset.tgReport});const materials=[];for(const f of files){const path=(f.student||'turmas')+'/'+g.id+'/'+crypto.randomUUID()+'-'+f.file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const {error}=await sb.storage.from('materiais').upload(path,f.file);if(error)throw error;uploaded.push(path);materials.push({path,type:f.type,name:f.file.name,student:f.student||null});}const {error}=await sb.rpc('portal_publish_group_lesson',{p_group:g.id,p_date:date,p_title:title,p_topic:topic,p_members:members,p_materials:materials});if(error)throw error;await tgLoad();tgSwitch('history');}catch(e){alert('Falha ao publicar: '+e.message+'; confira o histórico antes de repetir.');}finally{btn.disabled=false;}}
function tgHistory(){document.getElementById('tg-body').innerHTML='<h3>Aulas cadastradas</h3>'+ (tgSelected.lessons.map(l=>'<div class="box"><h3>'+tgEsc(l.title)+'</h3><p>'+tgEsc(l.date)+' · '+tgEsc(l.topic)+'</p><p>Slides: '+tgEsc(l.slides.join(', ')||'—')+'</p><p>Exercícios: '+tgEsc(l.exercises.join(', ')||'—')+'</p>'+tgMembers().map(s=>'<p><strong>'+tgEsc(s.full_name||s.email)+'</strong> · Relatório: '+tgEsc(l.reports[s.id])+'</p>').join('')+'</div>').join('')||'<p>Nenhuma aula cadastrada.</p>')+'<h3>Frequências registradas</h3>'+Object.entries(tgSelected.events).map(([d,e])=>'<div class="box"><strong>'+tgEsc(d)+'</strong>'+tgMembers().map(s=>'<p>'+tgEsc(s.full_name||s.email)+' · '+tgEsc(ccStatus[e[s.id]])+'</p>').join('')+'</div>').join('');}


// Pendências reais são renderizadas pela central de aulas, não duplicadas aqui.
function tgPendingHtml(){return '';}
async function tgLoad(){
 const {data,error}=await sb.from('portal_groups').select('*').order('created_at');if(error)throw error;
 const ids=[...new Set((data||[]).flatMap(g=>g.members))],lessons=[];
 for(let offset=0;ids.length;offset+=500){
  const {data:batch,error:le}=await sb.from('lessons').select('*,resources(*)').in('student_id',ids).order('id',{ascending:true}).range(offset,offset+499);
  if(le)throw le;lessons.push(...(batch||[]));if((batch||[]).length<500)break;
 }
 const old=tgSelected?.id;
 tgGroups=(data||[]).map(row=>{const g={...row,days:'',time:'',start:'',end:'',...row.schedule,events:{},lessons:[],calendarLessons:lessons.filter(l=>row.members.includes(l.student_id))};const by=new Map();for(const l of (lessons||[]).filter(l=>l.group_id===g.id)){const k=l.lesson_date;let a=by.get(k);if(!a){a={id:l.id,date:k,title:l.title,topic:l.topic,slides:[],exercises:[],reports:{}};by.set(k,a);}for(const r of l.resources||[]){if(r.type==='rep')a.reports[l.student_id]=materialDisplayName(r);else{const arr=r.type==='ex'?a.exercises:a.slides;if(!arr.includes(r.name))arr.push(r.name);}}a.reports[l.student_id]??='Pendente';}g.lessons=[...by.values()];return g;});for(const g of tgGroups)for(const id of g.members){const s=students.find(s=>s.id===id);if(!s)continue;for(const [date,e] of Object.entries(ccData(s).events||{}))if(e.group_id===g.id&&!e.skip)(g.events[date]??={})[id]=e.status;}tgSelected=tgGroups.find(g=>g.id===old)||null;
}
function tgOpenMissing(groupId,date){return tgOpenDate(groupId,date);}

function tgNormalizeAttendance(members,attendance){
 const allAbsent=members.every(id=>['absent','owed'].includes(attendance[id]));
 return Object.fromEntries(members.map(id=>[id,['absent','owed'].includes(attendance[id])?(allAbsent?'owed':'absent'):attendance[id]]));
}
function tgGroupReplacementEligible(groupId,date){
 const g=tgGroups.find(v=>v.id===groupId);if(!g)return false;
 return g.members.every(id=>{const e=ccRead(id).events?.[date];return !g.calendarLessons?.some(l=>l.student_id===id&&l.lesson_date===date&&l.group_id===groupId)&&e?.group_id===groupId&&['absent','owed'].includes(ccAttendanceStatus(g.calendar_events?.[date]?.status||e.status,e.attendance_override));});
}
function tgGroupReplacementRows(){
 const result=[];
 for(const g of tgGroups){
 const dates=new Set(g.members.flatMap(id=>Object.entries(ccRead(id).events||{}).filter(([d,e])=>e.group_id===g.id&&['absent','owed'].includes(e.status)).map(([d])=>d)));
 for(const date of dates){
 if(!tgGroupReplacementEligible(g.id,date))continue;
 const pending=g.members.filter(id=>!Object.entries(ccRead(id).events||{}).some(([d,e])=>e.original===date&&e.group_id===g.id&&(e.status==='done'||crmRegisteredDates?.has(id+'|'+d))));
 if(pending.length)result.push({g,date,pending,visible:pending.filter(id=>!crmDismissed(id,'replacement:'+date))});
 }}
 return result;
}
async function tgOpenReplacement(groupId,date){
 await tgOpenDate(groupId,date);
 const ctx=ccContext();if(!ctx?.group||ctx.group.id!==groupId||!tgGroupReplacementEligible(groupId,date))return alert('Reposição coletiva indisponível.');
 document.getElementById('cc-edit').insertAdjacentHTML('afterbegin','<div class="box"><h3>Reposição coletiva</h3><p>Referente à aula de '+tgEsc(formatDate(date))+'</p><label>Data da reposição<input type="date" id="tg-replacement-date"></label><label>Horário<input type="time" id="tg-replacement-time" value="'+tgEsc(ccSchedule(ccDraft(ctx).schedule,date).time)+'"></label><button class="btn-ghost" onclick="tgStageReplacement(&quot;'+date+'&quot;,false)">Agendar reposição</button> <button class="btn-ghost" onclick="tgStageReplacement(&quot;'+date+'&quot;,true)">Marcar reposição realizada</button><p class="small-note">Use Salvar calendário para confirmar.</p></div>');
}
function tgStageReplacement(original,done){
 const ctx=ccContext(),d=ccDraft(ctx),date=document.getElementById('tg-replacement-date')?.value,time=document.getElementById('tg-replacement-time')?.value;
 if(!ctx?.group||!date||date<=original||!time||ccSaving)return alert('Selecione uma data posterior à falta coletiva e um horário.');
 try{
  ccDestinationFree(ctx,d,date);
  if(!ctx.members.every(s=>{const x=d.payloads[s.id];return x.events[original]?.group_id===ctx.group.id&&['absent','owed'].includes(x.events[original]?.status)&&ccReplacementAvailable(x,original,date,ctx.lessons.filter(l=>l.student_id===s.id),true);}))throw Error('Reposição coletiva indisponível.');
  d.schedule.events[date]={status:done?'done':'planned',original,time};
  for(const s of ctx.members)d.payloads[s.id].events[date]={...d.schedule.events[date],group_id:ctx.group.id,group_status:d.schedule.events[date].status};
  ccMarkDirty(ctx,d);ccJump(date);
 }catch(e){alert(e.message);}
}
