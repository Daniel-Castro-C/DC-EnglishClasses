/* Calendários administrativos: rascunhos locais, confirmação transacional no Supabase. */
const ccStatus={planned:'Agendada',rescheduled:'Reagendado',done:'Realizada',absent:'Falta sem reposição',owed:'Falta com reposição',teacher:'Cancelada pelo professor',holiday:'Feriado',break:'Recesso',vacation:'Férias do aluno'};
let ccDate=new Date(),ccSelected='';
const ccCloud=new Map();
let ccCloudReady=false;
let ccSaving=false;
function ccRead(id){if(students.find(s=>s.id===id)?.is_test_profile){try{return JSON.parse(localStorage.getItem('dc-calendar-test:'+id)||'{}')}catch{return {}}}return JSON.parse(JSON.stringify(ccCloud.get(id)?.payload||{}));}
function ccManualDoneDates(data){return Object.entries(data.events||{}).filter(([d,e])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&e.status==='done'&&!e.skip).map(([d])=>d);}
async function ccLoadCloud(){
 const {data,error}=await sb.from('admin_calendar_states').select('calendar_key,payload,revision');
 if(error){ccCloudReady=false;throw error;}
 ccCloud.clear();for(const row of data||[])ccCloud.set(row.calendar_key,row);
 ccCloudReady=true;
}
async function ccSaveCloud(key,payload){
 if(!ccCloudReady){alert('Calendário indisponível. Recarregue a página antes de editar.');return false;}
 if(ccSaving){alert('Aguarde a confirmação do registro anterior.');return false;}
 ccSaving=true;
 try{
 const revision=ccCloud.get(key)?.revision||0;
 const {data,error}=await sb.rpc('save_admin_calendar',{p_key:key,p_payload:payload,p_revision:revision});
 if(error)throw error;
 ccCloud.set(key,{calendar_key:key,payload:JSON.parse(JSON.stringify(payload)),revision:data});
 return true;
 }catch(error){console.error(error);alert('Não foi possível salvar no Supabase. Nenhum salvamento foi confirmado. Se houve alteração em outro dispositivo, recarregue a página e tente novamente.');return false;}
 finally{ccSaving=false;}
}
async function ccWrite(id,data){
 if(students.find(s=>s.id===id)?.is_test_profile){localStorage.setItem('dc-calendar-test:'+id,JSON.stringify(data));return true;}
 return ccSaveCloud(id,data);
}
function ccISO(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function ccEsc(v){return escapeHtml(String(v??''))}
function ccData(s){const x=ccRead(s.id);return {plan:x.plan||'',start:x.start||'',weekdays:x.weekdays??String(s.lesson_weekday||''),time:x.time??String(s.lesson_time||'').slice(0,5),changes:Array.isArray(x.changes)?x.changes:[],end:x.end||'',events:x.events||{},dismissedAlerts:x.dismissedAlerts||{}}}
function ccSchedule(x,date){const changes=x.changes.filter(c=>c.from<=date).sort((a,b)=>a.from.localeCompare(b.from));return changes.at(-1)||{weekdays:x.weekdays,time:x.time};}
function ccHabitual(x,date){return (!x.start||date>=x.start)&&(!x.end||date<=x.end)&&ccSchedule(x,date).weekdays.split(',').includes(String(new Date(date+'T12:00:00').getDay()||7));}
function ccDayInputs(days,prefix){return ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((label,i)=>'<label class="cc-weekday-chip"><input type="checkbox" name="'+prefix+'" value="'+(i+1)+'" '+(days.split(',').includes(String(i+1))?'checked':'')+'> '+label+'</label>').join('');}
function ccPickedDays(name){return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(e=>e.value).join(',');}
// Drafts are isolated from the committed calendar and kept per student/group while navigating.
const ccDrafts=new Map();
const ccClone=v=>JSON.parse(JSON.stringify(v));
let ccActiveKey='';
function ccGroupSchedule(g){return {plan:g.plan||'',start:g.start||'',end:g.end||'',weekdays:g.days||'',time:g.time||'',changes:Array.isArray(g.changes)?ccClone(g.changes):[],events:{}};}
function ccGroupForDate(id,date){
 const event=ccRead(id).events?.[date];
 return tgGroups.find(g=>g.members.includes(id)&&(event?.group_id===g.id||(!event&&g.start&&ccHabitual(ccGroupSchedule(g),date))))||null;
}
function ccContext(){
 if(currentView==='turmas'&&tgSelected&&tgTab==='calendar')return {key:'group:'+tgSelected.id,group:tgSelected,members:tgMembers(),lessons:tgSelected.calendarLessons||[]};
 if(currentView==='student'&&currentStudent&&currentTab==='calendario')return {key:'student:'+currentStudent.id,group:null,members:[currentStudent],lessons:ccLessons(currentStudent)};
 return null;
}
function ccHasDirtyForMember(id){return [...ccDrafts.values()].some(d=>d.dirty&&Object.hasOwn(d.payloads,id));}
function ccDraft(ctx=ccContext()){
 if(!ctx||!ctx.members.length)return null;
 const existing=ccDrafts.get(ctx.key);
 if(existing&&!existing.dirty&&ctx.members.some(s=>(ccCloud.get(s.id)?.revision||0)!==existing.revisions[s.id]))ccDrafts.delete(ctx.key);
 if(!ccDrafts.has(ctx.key)){
  const payloads=Object.fromEntries(ctx.members.map(s=>[s.id,ccData(s)]));
  ccDrafts.set(ctx.key,{key:ctx.key,payloads,base:ccClone(payloads),revisions:Object.fromEntries(ctx.members.map(s=>[s.id,ccCloud.get(s.id)?.revision||0])),schedule:ctx.group?ccGroupSchedule(ctx.group):null,baseSchedule:ctx.group?ccGroupSchedule(ctx.group):null,dirty:false,date:new Date(ccDate),selected:ccSelected});
 }
 return ccDrafts.get(ctx.key);
}
function ccModel(ctx,d){return ctx.group?d.schedule:d.payloads[ctx.members[0].id];}
function ccRegistered(ctx,id,date){return ctx.lessons.some(l=>l.student_id===id&&l.lesson_date===date);}
function ccIsHabitual(x,date){return !!ccSchedule(x,date).time&&ccHabitual(x,date);}
function ccEvent(ctx,d,id,date){const e=d.payloads[id].events[date];return ctx.group&&e?.group_id!==ctx.group.id?undefined:e;}
function ccDateState(ctx,d,date){
 const x=ccModel(ctx,d),rows=ctx.members.map(s=>{
  const e=ccEvent(ctx,d,s.id,date),real=ctx.lessons.some(l=>l.student_id===s.id&&l.lesson_date===date&&(!ctx.group||l.group_id===ctx.group.id));
  return {id:s.id,e,status:real?'done':e?.skip?'':e?.status||ccGlobalStatus(date)||((!ctx.group||x.start)&&ccIsHabitual(x,date)?'planned':'')};
 });
 const statuses=[...new Set(rows.map(r=>r.status))];
 return {rows,status:statuses.length===1?statuses[0]:'mixed',event:rows.find(r=>r.e)?.e,real:ctx.members.some(s=>ccRegistered(ctx,s.id,date))};
}
function ccDateLabel(status){return status==='mixed'?'Frequência mista':ccStatus[status]||'';}
function ccNextDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
function ccGroupProjection(d,next){
 const previous=d.schedule;
 for(const x of Object.values(d.payloads)){
  const previousChanges=[...previous.changes];
  if(previous.start&&x.start!==previous.start)previousChanges.push({from:previous.start,weekdays:previous.weekdays,time:previous.time});
  if(previous.end&&x.end!==previous.end)previousChanges.push({from:ccNextDate(previous.end),weekdays:'',time:''});
  x.changes=x.changes.filter(c=>!previousChanges.some(p=>p.from===c.from&&p.weekdays===c.weekdays&&p.time===c.time));
  const direct=!x.start||x.start===previous.start;
  if(direct){x.start=next.start;x.weekdays=next.weekdays;x.time=next.time;x.end=next.end;}
  else if(next.start){x.changes=x.changes.filter(c=>c.from!==next.start);x.changes.push({from:next.start,weekdays:next.weekdays,time:next.time});}
  for(const c of next.changes){x.changes=x.changes.filter(v=>v.from!==c.from);x.changes.push(ccClone(c));}
  if(next.end&&!direct){const from=ccNextDate(next.end);x.changes=x.changes.filter(c=>c.from!==from);x.changes.push({from,weekdays:'',time:''});}
  if(next.plan||previous.plan)x.plan=next.plan;
 }
 d.schedule=next;
}
function ccStageConfig(){
 const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving)return false;
 const x=ccModel(ctx,d),next={...x,plan:document.getElementById('cc-plan').value,start:document.getElementById('cc-start').value,weekdays:ccPickedDays('cc-base-day'),time:document.getElementById('cc-base-time').value,end:document.getElementById('cc-end').value};
 if(JSON.stringify(x)===JSON.stringify(next))return true;
 if(next.weekdays&&(!next.time||ctx.group&&!next.start)||next.end&&next.start&&next.end<next.start){ccMessage('Informe início e horário para os dias habituais e confira o período.');return false;}
 if(next.changes.some(c=>!next.start||c.from<next.start||next.end&&c.from>next.end)){ccMessage('As mudanças de horário precisam estar dentro do período configurado.');return false;}
 if(ctx.group)ccGroupProjection(d,next);else d.payloads[ctx.members[0].id]=next;
 ccMarkDirty(ctx,d);ccRefreshGrid();return true;
}
function ccMessage(msg){const el=document.getElementById('cc-message');if(el)el.textContent=msg;}
function ccMarkDirty(ctx,d){d.dirty=true;ccUpdateToolbar(d);}
function ccUpdateToolbar(d){const btn=document.getElementById('cc-save-all'),discard=document.getElementById('cc-discard');if(btn)btn.disabled=ccSaving||!d.dirty;if(discard)discard.disabled=ccSaving||!d.dirty;ccMessage(d.dirty?'Alterações não salvas. Salve o calendário para confirmar.':'Calendário salvo.');}
function ccChangeAdd(){
 const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!ccStageConfig())return;
 const x=ccModel(ctx,d),from=document.getElementById('cc-change-date').value,weekdays=ccPickedDays('cc-change-day'),time=document.getElementById('cc-change-time').value;
 if(!from||!x.start||from<x.start||x.end&&from>x.end||weekdays&&!time)return alert('Informe uma data de vigência dentro do período e um horário para os dias escolhidos.');
 if(x.changes.some(c=>c.from===from)&&!confirm('Substituir a alteração já cadastrada para esta data?'))return;
 const next={...x,changes:[...x.changes.filter(c=>c.from!==from),{from,weekdays,time}]};
 if(ctx.group)ccGroupProjection(d,next);else d.payloads[ctx.members[0].id]=next;
 ccMarkDirty(ctx,d);ccRender();
}
function ccChangeRemove(from){
 const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!confirm('Excluir esta mudança de horário? A recorrência anterior voltará a valer.'))return;
 const x=ccModel(ctx,d),next={...x,changes:x.changes.filter(c=>c.from!==from)};
 if(ctx.group)ccGroupProjection(d,next);else d.payloads[ctx.members[0].id]=next;
 ccMarkDirty(ctx,d);ccRender();
}
function ccChangeEdit(from){const ctx=ccContext(),d=ccDraft(ctx),c=ccModel(ctx,d).changes.find(v=>v.from===from);if(!c)return;document.getElementById('cc-change-date').value=c.from;document.getElementById('cc-change-time').value=c.time;document.querySelectorAll('input[name="cc-change-day"]').forEach(e=>e.checked=c.weekdays.split(',').includes(e.value));}
function ccLessons(s){return currentLessons.filter(l=>l.student_id===s.id&&l.lesson_date)}
function ccRender(){
 const ctx=ccContext();if(!ctx||!ctx.members.length)return;
 const root=document.getElementById(ctx.group?'tg-body':'tab-content');if(!root)return;
 const d=ccDraft(ctx);
 if(!ctx.group&&!currentLessonsReady){root.innerHTML='<p role="alert">Não foi possível carregar as aulas cadastradas. Atualize antes de editar.</p><button class="btn-ghost" onclick="ccImportCompletions()">Atualizar do servidor</button>';return;}
 if(ctx.group&&ctx.members.length!==ctx.group.members.length){root.innerHTML='<p role="alert">Não foi possível carregar todos os integrantes da turma.</p>';return;}
 if(ccActiveKey!==ctx.key){ccActiveKey=ctx.key;ccDate=d.date;ccSelected=d.selected;}
 const x=ccModel(ctx,d);
 root.innerHTML='<div class="box cc-calendar-toolbar"><h3>'+(ctx.group?'Calendário da turma':'Calendário individual')+'</h3><p class="small-note">Edite várias datas, horários e frequências; salve todas as alterações de uma vez.</p><div class="row"><button id="cc-save-all" class="btn-dark-sm" onclick="ccSaveAll()">Salvar calendário</button><button id="cc-discard" class="btn-ghost" onclick="ccDiscard()">Descartar alterações</button><button class="btn-ghost" onclick="ccImportCompletions()">Atualizar do servidor</button></div><p id="cc-message" class="small-note" role="status" aria-live="polite"></p></div><div class="box"><h3>Horário habitual</h3><div class="row"><label>Plano <select id="cc-plan" onchange="ccStageConfig()"><option value="">Selecionar</option><option value="48">Essencial · 48</option><option value="96">Intensivo · 96</option></select></label><label>Início <input id="cc-start" type="date" value="'+ccEsc(x.start)+'" onchange="ccStageConfig()"></label><label>Horário inicial <input id="cc-base-time" type="time" value="'+ccEsc(x.time)+'" onchange="ccStageConfig()"></label><label>Fim (opcional) <input id="cc-end" type="date" value="'+ccEsc(x.end)+'" onchange="ccStageConfig()"></label></div><p class="small-note">Dias habituais iniciais</p><div class="cc-weekday-group" onchange="ccStageConfig()">'+ccDayInputs(x.weekdays,'cc-base-day')+'</div></div><div class="box"><h3>Alterações de horário habitual</h3><p class="small-note">Escolha a data a partir da qual o novo horário vale. Para encerrar a recorrência, deixe todos os dias desmarcados.</p><div class="row"><label>A partir de <input id="cc-change-date" type="date" value="'+adminToday().date+'"></label><label>Horário <input id="cc-change-time" type="time" value="'+ccEsc(ccSchedule(x,adminToday().date).time)+'"></label></div><div class="cc-weekday-group">'+ccDayInputs(ccSchedule(x,adminToday().date).weekdays,'cc-change-day')+'</div><button class="btn-ghost" onclick="ccChangeAdd()">Adicionar alteração</button>'+x.changes.slice().sort((a,b)=>a.from.localeCompare(b.from)).map(c=>'<div class="resource-row"><div class="resource-info"><div class="name">A partir de '+ccEsc(formatDate(c.from))+'</div><div class="desc">'+ccEsc(c.weekdays.split(',').filter(Boolean).map(day=>['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][Number(day)-1]).join(', ')||'Sem recorrência')+' · '+ccEsc(c.time)+'</div></div><button class="btn-ghost" onclick="ccChangeEdit(&quot;'+ccEsc(c.from)+'&quot;)">Editar</button><button class="btn-ghost" onclick="ccChangeRemove(&quot;'+ccEsc(c.from)+'&quot;)">Excluir</button></div>').join('')+'</div><div class="box" id="cc-annual"></div><div class="box"><div class="row"><button class="btn-ghost" aria-label="Mês anterior" onclick="ccMove(-1)">←</button><h3 id="cc-month"></h3><button class="btn-ghost" aria-label="Próximo mês" onclick="ccMove(1)">→</button></div><div class="cc-month-grid" id="cc-grid"></div><div id="cc-edit"></div></div>';
 root.querySelector('#cc-plan').value=x.plan;
 ccUpdateToolbar(d);ccRefreshGrid();if(ccSelected)ccEditor();
}
function ccRefreshGrid(){
 const ctx=ccContext(),d=ccDraft(ctx),grid=document.getElementById('cc-grid');if(!d||!grid)return;
 const x=ccModel(ctx,d),y=ccDate.getFullYear(),m=ccDate.getMonth(),n=new Date(y,m+1,0).getDate();
 let cells=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day=>'<small>'+day+'</small>').join('')+'<div></div>'.repeat(new Date(y,m,1).getDay());
 for(let day=1;day<=n;day++){
  const date=ccISO(y,m,day),{status,event}=ccDateState(ctx,d,date);
  const label=ccDateLabel(status);
  cells+='<button class="btn-ghost cc-day'+(date===ccSelected?' cc-selected':'')+'" aria-label="'+ccEsc(formatDate(date)+(label?' · '+label:''))+'" onclick="ccSelect(&quot;'+date+'&quot;)"><b>'+day+'</b><small>'+ccEsc(label)+(status?'<br>'+ccEsc(event?.time||ccSchedule(x,date).time||''):'')+(event?.rescheduled_to?'<br>→ '+ccEsc(formatDate(event.rescheduled_to)):event?.rescheduled_from?'<br>De '+ccEsc(formatDate(event.rescheduled_from)):event?.original?'<br>Ref. '+ccEsc(formatDate(event.original)):'')+'</small></button>';
 }
 grid.innerHTML=cells;document.getElementById('cc-month').textContent=ccDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const dates=new Set(ctx.lessons.filter(l=>l.lesson_date?.startsWith(y+'-')&&(!ctx.group||l.group_id===ctx.group.id)).map(l=>l.lesson_date));
 for(const s of ctx.members)for(const [date,event] of Object.entries(d.payloads[s.id].events))if(date.startsWith(y+'-')&&(!ctx.group||event.group_id===ctx.group.id))dates.add(date);
 let completed=0,absent=0,pending=0;const groupVacations={};
 for(const date of dates){const state=ccDateState(ctx,d,date);if(state.rows.some(r=>r.status==='done'))completed++;else if(state.rows.every(r=>r.status==='absent'))absent++;
  if(ctx.group&&state.rows.every(r=>r.status==='vacation'&&r.e?.discounted!==false))groupVacations[date]={status:'vacation'};
  const eligible=ctx.group?state.rows.every(r=>['absent','owed'].includes(r.status)):['owed','teacher'].includes(state.status)||state.status==='absent'&&Object.values(x.events).some(e=>e.original===date);
  if(eligible&&!state.real&&!ctx.members.every(s=>Object.entries(d.payloads[s.id].events).some(([rd,e])=>e.original===date&&(e.status==='done'||ccRegistered(ctx,s.id,rd)))))pending++;
 }
 document.getElementById('cc-annual').innerHTML='<h3>Controle anual · '+y+'</h3><p><b>'+(completed+absent)+' / '+(ccTarget(ctx.group?{...x,events:groupVacations}:x,y)??'—')+'</b> contabilizadas · '+completed+' realizadas · '+absent+' faltas sem reposição · '+pending+' reposições pendentes</p><p class="small-note">Aulas cadastradas são consideradas realizadas automaticamente.</p>';
}
function ccMove(direction){if(ccSaving||!ccFinishInput())return;const d=ccDraft();ccDate=new Date(ccDate.getFullYear(),ccDate.getMonth()+direction,1);ccSelected='';d.date=ccDate;d.selected='';ccRender();}
function ccSelect(date){if(ccSaving||!ccFinishInput())return;const d=ccDraft();ccSelected=date;d.selected=date;ccRefreshGrid();ccEditor();}
function ccReplacementAvailable(x,original,date,lessons,collective=false){
 if(x.events[original]?.group_id&&!collective)return false;
 if(!original||original>=date||!['owed','absent','teacher'].includes(x.events[original]?.status))return false;
 if(lessons.some(l=>l.lesson_date===original))return false;
 return !Object.entries(x.events).some(([rd,r])=>rd!==date&&r.original===original&&!r.skip&&(r.status==='done'||r.status==='planned'||lessons.some(l=>l.lesson_date===rd)));
}
function ccCanEditDate(ctx,d,date){
 if(ctx.members.some(s=>ccRegistered(ctx,s.id,date)))throw Error('Esta data tem aula cadastrada com materiais. Use Aulas e materiais para editar o cadastro; o calendário não exclui esse conteúdo.');
 if(!ctx.group&&(d.payloads[ctx.members[0].id].events[date]?.group_id||ccGroupForDate(ctx.members[0].id,date)))throw Error('Esta aula pertence à turma. Gerencie-a pelo calendário da turma.');
 if(ctx.group&&ctx.members.some(s=>{const e=d.payloads[s.id].events[date],other=ccGroupForDate(s.id,date);return (e&&e.group_id!==ctx.group.id)||(other&&other.id!==ctx.group.id);}))throw Error('Há um registro individual nesta data. Resolva o conflito no calendário individual antes de editar a turma.');
}
function ccDestinationFree(ctx,d,date){
 ccCanEditDate(ctx,d,date);
 const model=ccModel(ctx,d);
 if(ccGlobalStatus(date))throw Error('A nova data está bloqueada por feriado ou recesso.');
 for(const s of ctx.members){
  const x=d.payloads[s.id],e=x.events[date];
  if(e&&!e.skip||!e?.skip&&(((!ctx.group||model.start)&&ccIsHabitual(model,date))||ccIsHabitual(x,date)))throw Error('Já existe uma aula agendada ou um registro nesta data. Escolha outra data.');
  if(!ctx.group&&ccGroupForDate(s.id,date))throw Error('A nova data está reservada para a turma.');
 }
}
function ccReschedule(ctx,d,from,to,time,notes){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(to)||from===to)throw Error('Escolha uma data diferente da original.');
 ccCanEditDate(ctx,d,from);ccDestinationFree(ctx,d,to);
 const state=ccDateState(ctx,d,from);
 if(state.rows.some(r=>r.status!=='planned'))throw Error('Apenas aulas agendadas podem ser reagendadas. Para faltas com reposição, agende uma reposição.');
 const group=ctx.group?{group_id:ctx.group.id}:{};
 for(const s of ctx.members){
  const x=d.payloads[s.id],e=x.events[from]||{},source=e.rescheduled_from||from;
  if(e.original)throw Error('Para alterar uma reposição, exclua o agendamento e escolha a nova data de reposição.');
  if(source!==from&&x.events[source]?.rescheduled_to!==from)throw Error('Vínculo de reagendamento inválido.');
 }
 for(const s of ctx.members){
  const x=d.payloads[s.id],e=x.events[from]||{},source=e.rescheduled_from||from;
  const original=x.events[source]||{};
  if(source!==from){if(ccIsHabitual(x,from))x.events[from]={skip:true,...group};else delete x.events[from];}
  x.events[source]={...original,status:'rescheduled',rescheduled_to:to,time:original.time||e.time||ccSchedule(x,source).time,notes:original.notes||notes||'',...group};
  delete x.events[source].skip;
  x.events[to]={status:'planned',rescheduled_from:source,time:time||e.time||ccSchedule(x,source).time,notes:notes||e.notes||'',...group};
 }
}
function ccDeleteDate(ctx,d,date){
 ccCanEditDate(ctx,d,date);
 const group=ctx.group?{group_id:ctx.group.id}:{};
 // Validate all members and links first; no partially modified group drafts.
 for(const s of ctx.members){
  const x=d.payloads[s.id],e=x.events[date]||{},other=e.rescheduled_to||e.rescheduled_from;
  if(other&&ccRegistered(ctx,s.id,other))throw Error('O reagendamento vinculado já possui aula cadastrada; não é possível excluir pelo calendário.');
  if(other&&x.events[other]?.status==='done')throw Error('O reagendamento vinculado já foi realizado.');
  if(Object.entries(x.events).some(([rd,v])=>rd!==date&&v.original===date&&!v.skip))throw Error('Esta data tem uma reposição vinculada. Exclua primeiro o registro da reposição.');
 }
 for(const s of ctx.members){
  const x=d.payloads[s.id],e=x.events[date]||{};
  if(e.rescheduled_to){const to=e.rescheduled_to;if(ccIsHabitual(x,to))x.events[to]={skip:true,...group};else delete x.events[to];}
  if(e.rescheduled_from){const from=e.rescheduled_from,old=x.events[from]||{};x.events[from]={...old,status:'planned',...group};delete x.events[from].rescheduled_to;}
  if(ccIsHabitual(x,date)||ccIsHabitual(ccModel(ctx,d),date))x.events[date]={skip:true,...group};else delete x.events[date];
 }
}
function ccEditor(){
 const ctx=ccContext(),d=ccDraft(ctx),el=document.getElementById('cc-edit');if(!d||!el||!ccSelected)return;
 const date=ccSelected,state=ccDateState(ctx,d,date),x=ccModel(ctx,d),e=state.event||{};
 const group=!ctx.group&&ccGroupForDate(ctx.members[0].id,date);
 const header='<hr><h3>'+ccEsc(formatDate(date))+'</h3>';
 if(group){el.innerHTML=header+'<p>Esta aula pertence à turma '+ccEsc(group.name)+'.</p><button class="btn-dark-sm" onclick="tgOpenDate(&quot;'+ccEsc(group.id)+'&quot;,&quot;'+date+'&quot;)">Abrir calendário da turma</button>';return;}
 if(state.real){el.innerHTML=header+ctx.lessons.filter(l=>l.lesson_date===date).map(l=>'<p>Aula cadastrada: '+ccEsc(l.title||'Aula realizada')+'</p>').join('')+'<p class="small-note">Aulas cadastradas são protegidas. Edite o cadastro em Aulas e materiais.</p>';return;}
 try{ccCanEditDate(ctx,d,date);}catch(error){el.innerHTML=header+'<p role="alert">'+ccEsc(error.message)+'</p>';return;}
 if(state.status==='rescheduled'){
  el.innerHTML=header+'<p><strong>Reagendado</strong> para '+ccEsc(formatDate(e.rescheduled_to))+'</p><div class="row"><button class="btn-ghost" onclick="ccJump(&quot;'+ccEsc(e.rescheduled_to)+'&quot;)">Ir para nova data</button><button class="btn-ghost" onclick="ccRemove()">Excluir registro e cancelar reagendamento</button></div>';return;}
 const statuses=Object.entries(ccStatus).filter(([k])=>k!=='rescheduled');
 const selected=state.status||'';
 const options=statuses.map(([k,v])=>'<option value="'+k+'">'+ccEsc(v)+'</option>').join('');
 const candidates=Object.entries(d.payloads[ctx.members[0].id].events).filter(([from])=>ctx.members.every(s=>{
  const row=d.payloads[s.id],ls=ctx.lessons.filter(l=>l.student_id===s.id);
  return ctx.group?ctx.members.every(m=>['absent','owed'].includes(d.payloads[m.id].events[from]?.status)&&d.payloads[m.id].events[from]?.group_id===ctx.group.id)&&ccReplacementAvailable(row,from,date,ls,true):ccReplacementAvailable(row,from,date,ls);
 }));
 el.innerHTML=header+(e.rescheduled_from?'<p class="small-note">Reagendado de '+ccEsc(formatDate(e.rescheduled_from))+'</p>':'')+'<label>Status da aula <select id="cc-status" onchange="ccStatusChange()">'+(state.status?'':'<option value="">Selecione o status</option>')+(ctx.group?'<option value="mixed">Frequência individual</option>':'')+options+'<option value="move">Reagendar para...</option></select></label><div id="cc-reschedule" hidden><label>Nova data <input id="cc-reschedule-date" type="date" onchange="ccApplyReschedule()"></label><p class="small-note">A data original será mantida como Reagendado.</p></div>'+(ctx.group?'<div id="cc-attendance"><h4>Frequência individual</h4>'+state.rows.map(r=>'<label>'+ccEsc(ctx.members.find(s=>s.id===r.id).full_name||r.id)+'<select data-cc-member="'+ccEsc(r.id)+'" onchange="ccApplyDay(true)">'+options+'</select></label>').join('')+'</div>':'')+'<label>Reposição referente a <select id="cc-original" onchange="ccApplyDay()"><option value="">Não é reposição</option>'+candidates.map(([from])=>'<option value="'+from+'">'+ccEsc(formatDate(from))+'</option>').join('')+'</select></label><label>Horário <input id="cc-time" type="time" onchange="ccApplyDay()" value="'+ccEsc(e.time||ccSchedule(x,date).time||'')+'"></label><label>Observações <textarea id="cc-notes" onchange="ccApplyDay()">'+ccEsc(e.notes||'')+'</textarea></label><div class="row"><button class="btn-ghost" onclick="ccRemove()">Excluir registro de aula</button></div><p class="small-note">Alterações nesta data ficam no rascunho. '+(ctx.group?'A reposição só é concedida quando todos os integrantes faltam.':'Uma aula habitual excluída não reaparece automaticamente.')+'</p>';
 document.getElementById('cc-status').value=selected;
 document.getElementById('cc-original').value=e.original||'';
 if(ctx.group)document.querySelectorAll('[data-cc-member]').forEach(input=>input.value=state.rows.find(r=>r.id===input.dataset.ccMember)?.status||'planned');
}
function ccStatusChange(){
 const status=document.getElementById('cc-status').value,move=document.getElementById('cc-reschedule');
 move.hidden=status!=='move';
 if(status==='move'){document.getElementById('cc-reschedule-date').focus();return;}
 if(status&&status!=='mixed')document.querySelectorAll('[data-cc-member]').forEach(s=>s.value=status);
 ccApplyDay();
}
function ccApplyReschedule(){
 const ctx=ccContext(),d=ccDraft(ctx),to=document.getElementById('cc-reschedule-date').value;if(!to||ccSaving)return false;
 try{ccReschedule(ctx,d,ccSelected,to,document.getElementById('cc-time').value,document.getElementById('cc-notes').value);ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();return true;}catch(e){alert(e.message);return false;}
}
function ccApplyDay(individual=false){
 const ctx=ccContext(),d=ccDraft(ctx),status=document.getElementById('cc-status')?.value;if(!d||(!status&&!individual)||status==='move'||ccSaving)return false;
 const date=ccSelected,original=document.getElementById('cc-original').value,time=document.getElementById('cc-time').value,notes=document.getElementById('cc-notes').value;
 try{
  ccCanEditDate(ctx,d,date);
  const attendance=ctx.group?tgNormalizeAttendance(ctx.members.map(s=>s.id),Object.fromEntries([...document.querySelectorAll('[data-cc-member]')].map(s=>[s.dataset.ccMember,s.value]))):{[ctx.members[0].id]:status};
  if(original){
   if(!ctx.members.every(s=>d.payloads[s.id].events[date]?.original===original)&&ccIsHabitual(ccModel(ctx,d),date)&&!ctx.members.every(s=>d.payloads[s.id].events[date]?.skip))throw Error('Escolha uma data sem aula habitual para a reposição.');
   if(ctx.group&&!ctx.members.every(s=>['owed','absent'].includes(d.payloads[s.id].events[original]?.status)&&d.payloads[s.id].events[original]?.group_id===ctx.group.id))throw Error('A reposição exige falta de todos os integrantes.');
   if(!ctx.members.every(s=>ccReplacementAvailable(d.payloads[s.id],original,date,ctx.lessons.filter(l=>l.student_id===s.id),!!ctx.group)))throw Error('Esta reposição não está disponível.');
   if(ctx.members.some(s=>d.payloads[s.id].events[date]?.rescheduled_from))throw Error('Uma aula reagendada não pode ser vinculada como reposição.');
  }
  for(const s of ctx.members){
   const x=d.payloads[s.id],old=x.events[date]||{};
   if(Object.entries(x.events).some(([rd,v])=>rd!==date&&v.original===date&&!v.skip)&&!(ctx.group?['owed','absent']:['owed','absent','teacher']).includes(attendance[s.id]))throw Error('Exclua a reposição vinculada antes de alterar a frequência original.');
  }
  for(const s of ctx.members){
   const x=d.payloads[s.id],old=x.events[date]||{};
   x.events[date]={...old,status:attendance[s.id],original,time,notes,...(ctx.group?{group_id:ctx.group.id}:{})};delete x.events[date].skip;
  }
  if(ctx.group){document.querySelectorAll('[data-cc-member]').forEach(input=>input.value=attendance[input.dataset.ccMember]);const statuses=[...new Set(Object.values(attendance))];document.getElementById('cc-status').value=statuses.length===1?statuses[0]:'mixed';}
  ccMarkDirty(ctx,d);ccRefreshGrid();return true;
 }catch(e){alert(e.message);ccEditor();return false;}
}
function ccFinishInput(){if(document.getElementById('cc-status')?.value==='move'){alert('Escolha a nova data ou selecione outro status antes de continuar.');return false;}return !document.getElementById('cc-plan')||ccStageConfig();}
function ccRemove(){const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!confirm('Excluir este registro do calendário? A alteração só será confirmada ao salvar.'))return;try{ccDeleteDate(ctx,d,ccSelected);ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();}catch(e){alert(e.message);}}
function ccJump(date){if(!ccFinishInput())return;const d=ccDraft();ccSelected=date;ccDate=new Date(date+'T12:00:00');d.selected=date;d.date=ccDate;ccRender();}
function ccDiscard(){const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!confirm('Descartar todas as alterações ainda não salvas?'))return;ccDrafts.delete(ctx.key);ccActiveKey='';ccRender();}
async function ccImportCompletions(){
 const ctx=ccContext(),d=ccDraft(ctx);if(!ctx||ccSaving)return;
 if(d?.dirty&&!confirm('Descartar as alterações não salvas e atualizar do servidor?'))return;
 try{await ccLoadCloud();if(ctx.group)await tgLoad();else await loadLessonsFor(ctx.members[0].id);ccDrafts.delete(ctx.key);ccActiveKey='';if(ccContext()?.key===ctx.key)ccRender();}catch(e){alert('Não foi possível atualizar o calendário.');}
}
async function ccSaveAll(){
 const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!ccFinishInput()||!d.dirty)return;
 if([...ccDrafts.values()].some(other=>other.key!==ctx.key&&other.dirty&&ctx.members.some(s=>Object.hasOwn(other.payloads,s.id))))return alert('Há alterações pendentes em outro calendário relacionado. Descarte esse outro rascunho antes de salvar.');
 if(!ctx.members.every(s=>s.is_test_profile||ccCloudReady&&(ccCloud.get(s.id)?.revision||0)===d.revisions[s.id]))return alert('Calendário alterado em outro fluxo. Atualize do servidor antes de salvar.');
 // Preflight the dates touched by the draft against the current published lesson records.
 ccSaving=true;ccUpdateToolbar(d);
 try{
  if(!ctx.members.every(s=>s.is_test_profile)){
   const dates=new Set(ctx.members.flatMap(s=>Object.keys({...d.base[s.id].events,...d.payloads[s.id].events}).filter(date=>JSON.stringify(d.base[s.id].events[date])!==JSON.stringify(d.payloads[s.id].events[date]))));
   const changedDates=[...dates];
   for(let offset=0;offset<changedDates.length;offset+=80){
    const {data,error}=await sb.from('lessons').select('id,student_id,lesson_date').in('student_id',ctx.members.map(s=>s.id)).in('lesson_date',changedDates.slice(offset,offset+80)).limit(1);
    if(error)throw error;if(data?.length)throw Error('Uma aula cadastrada foi encontrada em '+formatDate(data[0].lesson_date)+'. Atualize o calendário antes de salvar.');
   }
  }
  if(ctx.group){
   const x=d.schedule,schedule=JSON.stringify(x)===JSON.stringify(d.baseSchedule)?null:{...ctx.group.schedule,start:x.start,end:x.end,days:x.weekdays,time:x.time,plan:x.plan,changes:x.changes};
   const {error}=await sb.rpc('portal_group_calendar_save',{p_group:ctx.group.id,p_schedule:schedule,p_changes:ctx.members.map(s=>({id:s.id,payload:d.payloads[s.id],revision:d.revisions[s.id]}))});
   if(error)throw error;
  }else{
   const s=ctx.members[0],payload=d.payloads[s.id];
   if(s.is_test_profile)localStorage.setItem('dc-calendar-test:'+s.id,JSON.stringify(payload));
   else{const {data,error}=await sb.rpc('save_admin_calendar',{p_key:s.id,p_payload:payload,p_revision:d.revisions[s.id]});if(error)throw error;ccCloud.set(s.id,{calendar_key:s.id,payload:ccClone(payload),revision:data});}
  }
  // Once the RPC succeeds, the draft has been committed; do not retry on a refresh failure.
  ccDrafts.delete(ctx.key);ccActiveKey='';
  try{if(ctx.group){await ccLoadCloud();await tgLoad();}}catch(e){ccCloudReady=false;alert('Calendário salvo, mas não foi possível atualizar a tela. Recarregue antes de editar novamente.');return;}
  if(ccContext()?.key===ctx.key)ccRender();
 }catch(e){console.error(e);alert('Não foi possível salvar. As alterações permanecem no rascunho. '+(e.message||''));}
 finally{ccSaving=false;const active=ccContext();if(active){const now=ccDraft(active);ccUpdateToolbar(now);}}
}
window.addEventListener('beforeunload',event=>{if([...ccDrafts.values()].some(d=>d.dirty)){event.preventDefault();event.returnValue='';}});
async function ccOverview(){currentView='controle';renderNav();const root=document.getElementById('main-content');root.innerHTML='<div class="topline"><h1>Controle de aulas</h1></div><div class="box"><p>Selecione um aluno para abrir o calendário individual. Metas anuais e registros manuais são armazenados no Supabase.</p>'+students.map(s=>'<p><button class="btn-ghost" onclick="ccOpen(\''+ccEsc(s.id)+'\')">'+ccEsc(s.full_name||s.email)+'</button></p>').join('')+'</div>'}
async function ccOpen(id){await openStudent(id);ccActiveKey='';ccSelected='';switchTab('calendario')}

function ccTarget(x,y){if(!x.plan||!x.start)return null;let total=0;for(let m=0;m<12;m++){let first=ccISO(y,m,1),last=ccISO(y,m,new Date(y,m+1,0).getDate());if(x.start>last||(x.end&&x.end<first))continue;let days=new Date(y,m+1,0).getDate(),a=x.start>first?Number(x.start.slice(-2)):1,b=x.end&&x.end<last?Number(x.end.slice(-2)):days;total+=Math.round(Number(x.plan)/12*(b-a+1)/days)}return Math.max(0,total-Object.entries(x.events).filter(([d,e])=>d.startsWith(y+'-')&&d>=x.start&&(!x.end||d<=x.end)&&e.status==='vacation'&&e.discounted!==false).length)}
function ccPending(x,byDate={}){const entries=Object.entries(x.events);return entries.filter(([d,e])=>(!e.group_id||tgGroupReplacementEligible(e.group_id,d))&&(['owed','teacher'].includes(e.status)||e.status==='absent'&&entries.some(([rd,r])=>r.original===d))&&!byDate[d]&&!entries.some(([rd,r])=>r.original===d&&(r.status==='done'||byDate[rd]?.length))).length}
function ccGlobal(){return JSON.parse(JSON.stringify(ccCloud.get('global')?.payload||[]));}
function ccGlobalStatus(d){return ccGlobal().find(e=>d>=e.start&&d<=e.end)?.status||''}
function ccAgenda(today,completedIds=null,keepRecorded=false){return students.filter(s=>!s.is_test_profile).flatMap(s=>{const x=ccData(s),e=x.events[today.date],habitual=ccHabitual(x,today.date)&&ccSchedule(x,today.date).time,registered=completedIds?.has(s.id),global=ccGlobalStatus(today.date);if(!registered&&(e?.skip||e?.status==='rescheduled'))return [];if(!registered&&!e&&!habitual)return [];if(!keepRecorded&&!registered&&((e&&!['planned','done'].includes(e.status))||(!e&&global)))return [];if(!registered&&!e&&global)return [];return [{...s,lesson_time:e?.time||ccSchedule(x,today.date).time||'',ccType:e?.rescheduled_from?'Reagendamento · '+e.rescheduled_from.split('-').reverse().join('/'):e?.original?'Reposição · '+e.original.split('-').reverse().join('/'):habitual?'Regular':'Adicional',ccDate:today.date,ccStatus:registered?'done':e?.status||'planned',ccRegistered:!!registered}] }).sort((a,b)=>(a.lesson_time||'99').localeCompare(b.lesson_time||'99'))}
function ccQuickStatus(student){const status=student.ccStatus;return '<select class="crm-quick-status" data-status="'+ccEsc(status)+'" aria-label="Status da aula de '+ccEsc(student.full_name||student.email||'Aluno')+'" '+(student.ccRegistered?'disabled title="Aula realizada automaticamente pelo cadastro de materiais"':'onchange="ccQuickSave(this,&quot;'+ccEsc(student.id)+'&quot;,&quot;'+ccEsc(student.ccDate)+'&quot;)"')+'>'+Object.entries(ccStatus).filter(([k])=>k!=='rescheduled').map(([k,v])=>'<option value="'+k+'" '+(k===status?'selected':'')+'>'+ccEsc(v)+'</option>').join('')+'</select>'+(student.ccRegistered?'<small class="crm-muted" style="display:block">Via cadastro</small>':'')}
async function ccQuickSave(select,id,date){const s=students.find(v=>v.id===id),status=select.value,previous=select.dataset.status;if(!s||!Object.hasOwn(ccStatus,status)||status==='rescheduled')return;select.disabled=true;try{const {data,error}=await sb.from('lessons').select('id').eq('student_id',id).eq('lesson_date',date).limit(1);if(error)throw error;if(data?.length){select.value='done';select.dataset.status='done';select.title='Aula realizada automaticamente pelo cadastro de materiais';alert('Esta aula já está cadastrada como realizada.');if(currentView==='home')await renderHome();return;}if(ccHasDirtyForMember(id)){select.value=previous;return alert('Salve as alterações pendentes no calendário individual.');}const x=ccData(s);if(ccGroupForDate(id,date)){select.value=previous;return alert('Registre a frequência da turma pelo módulo Turmas.');}x.events[date]={...(x.events[date]||{}),status};if(!await ccWrite(id,x)){select.value=previous;return;}select.dataset.status=status;const feedback=document.getElementById('crm-agenda-feedback');if(feedback)feedback.textContent='Status salvo no calendário de '+(s.full_name||s.email)+'.';const other=document.getElementById('crm-other-pending');if(other)other.innerHTML=crmOtherPending();const count=document.getElementById('crm-replacement-stat');if(count)count.textContent=students.filter(v=>!v.is_test_profile).reduce((a,v)=>a+ccPending(ccData(v)),0);if(currentView==='home')await renderHome();}catch(error){console.error(error);select.value=previous;alert('Não foi possível salvar o status. Tente novamente.');}finally{if(select.isConnected)select.disabled=false}}
async function ccOpenDate(id,date){const group=ccGroupForDate(id,date);if(group)return tgOpenDate(group.id,date);await openStudent(id);ccDate=new Date(date+'T12:00:00');ccSelected=date;const existing=ccDrafts.get('student:'+id);if(existing){existing.date=ccDate;existing.selected=date;}ccActiveKey='';switchTab('calendario')}
function ccGlobalView(){currentView='agenda';currentStudent=null;renderNav();let root=document.getElementById('main-content');root.innerHTML='<div class="topline"><h1>Agenda</h1></div><div class="box"><h3>Feriados e recessos</h3><div class="row"><label>Início<input type="date" id="cg-start"></label><label>Fim<input type="date" id="cg-end"></label><label>Tipo<select id="cg-type"><option value="holiday">Feriado</option><option value="break">Recesso</option></select></label><button class="btn-dark-sm" onclick="ccGlobalSave()">Adicionar</button></div>'+ccGlobal().map((e,i)=>'<p>'+ccEsc(e.start)+' a '+ccEsc(e.end)+' · '+ccEsc(ccStatus[e.status])+' <button class="btn-ghost" onclick="ccGlobalRemove('+i+')">Excluir</button></p>').join('')+'</div><div class="box"><h3>Agenda de hoje</h3>'+ccAgenda(adminToday()).map(s=>'<p>'+ccEsc(s.lesson_time.slice(0,5)||'Sem horário')+' · '+ccEsc(s.full_name||s.email)+' · '+ccEsc(s.ccType)+' <button class="btn-ghost" onclick="ccOpenDate(&quot;'+s.id+'&quot;,&quot;'+s.ccDate+'&quot;)">Calendário</button></p>').join('')+'</div>'}
async function ccGlobalSave(){let a=document.getElementById('cg-start').value,b=document.getElementById('cg-end').value||a;if(!a||b<a)return alert('Informe um período válido.');if(await ccSaveCloud('global',[...ccGlobal(),{start:a,end:b,status:document.getElementById('cg-type').value}]))ccGlobalView()}
async function ccGlobalRemove(i){let a=ccGlobal();a.splice(i,1);if(await ccSaveCloud('global',a))ccGlobalView()}
function ccRoster(){let root=document.getElementById('main-content');currentStudent=null;currentView='alunos';renderNav();root.innerHTML='<div class="topline"><h1>Alunos</h1></div><div class="box"><div class="row"><input id="crm-search" placeholder="Buscar aluno" oninput="ccRosterRows()"><select id="crm-filter" onchange="ccRosterRows()"><option value="">Todos os planos</option><option value="48">Essencial</option><option value="96">Intensivo</option><option value="pending">Com reposições</option><option value="inbox">Com envios pendentes</option></select></div><div id="crm-roster"></div></div>';ccRosterRows()}
async function ccRosterRows(){let el=document.getElementById('crm-roster');if(!el)return;let q=document.getElementById('crm-search').value.toLowerCase(),f=document.getElementById('crm-filter').value;let list=students.filter(s=>!s.is_test_profile&&String(s.full_name||s.email).toLowerCase().includes(q));el.innerHTML='<p>Carregando...</p>';let {data,error}=await sb.from('lessons').select('id,student_id,lesson_date').gte('lesson_date',adminToday().date.slice(0,4)+'-01-01').lte('lesson_date',adminToday().date.slice(0,4)+'-12-31');if(!el.isConnected)return;let rows=list.map(s=>{let x=ccData(s),l=(data||[]).filter(v=>v.student_id===s.id),by={};l.forEach(v=>by[v.lesson_date]=[v]);return {s,x,l,p:ccPending(x,by)}}).filter(r=>!f||(f==='pending'?r.p>0:f==='inbox'?crmInboxCount(r.s.id)>0:r.x.plan===f));el.innerHTML=(error?'<p>Não foi possível consultar aulas.</p>':'')+'<div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Aluno</th><th>Plano</th><th>Horário</th><th>Aulas cadastradas / meta</th><th>Reposições</th><th>Notificações</th><th>Ações</th></tr></thead><tbody>'+rows.map(({s,x,l,p})=>'<tr><td><button type="button" class="crm-student-name" style="background:none;border:0;padding:0;color:var(--crm-blue);font:inherit;font-weight:600;text-align:left;text-decoration:underline;text-underline-offset:3px;cursor:pointer" onclick="openStudent(&quot;'+ccEsc(s.id)+'&quot;)">'+ccEsc(s.full_name||s.email)+'</button></td><td>'+ (x.plan==='48'?'Essencial':x.plan==='96'?'Intensivo':'Não definido')+'</td><td>'+ccEsc((s.lesson_time||'').slice(0,5))+'</td><td>'+(error?'—':l.length)+' / '+(ccTarget(x,Number(adminToday().date.slice(0,4)))??'—')+'</td><td>'+p+'</td><td><button class="crm-icon-btn" title="Consultar envios e dúvidas" onclick="openStudent(&quot;'+s.id+'&quot;)">'+crmIcon('bell')+'<span data-crm-inbox="'+ccEsc(s.id)+'">'+crmCountBadge(crmInboxCount(s.id),'Envios e dúvidas')+'</span></button></td><td><button class="btn-ghost" onclick="ccOpen(&quot;'+s.id+'&quot;)">Calendário</button></td></tr>').join('')+'</tbody></table></div>'}

function crmIcon(name){const paths={dashboard:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',chart:'<path d="M3 3v18h18M8 16v-4m5 4V8m5 8V5"/>',book:'<path d="M12 7c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V5c-3-1-7-1-10 2v15"/>',message:'<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/>',megaphone:'<path d="M3 10v4h4l4 7h3l-3-7 10 4V6l-14 4Z"/>',graduation:'<path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6"/>',external:'<path d="M13 5h6v6m0-6-9 9M19 13v6H5V5h6"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m12 2 2 4 4-1 1 4 3 3-3 3-1 4-4-1-2 4-2-4-4 1-1-4-3-3 3-3 1-4 4 1Z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',refresh:'<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5m-3 9a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',file:'<path d="M6 2h8l4 4v16H6ZM14 2v5h4M9 12h6m-6 4h6"/>',video:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-4v12l-6-4"/>',plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>'};return '<svg class="crm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.calendar)+'</svg>'}
function crmKpi(label,value,icon,id){return '<div class="crm-kpi"><div><span>'+ccEsc(label)+'</span>'+crmIcon(icon)+'</div><strong '+(id?'id="'+id+'"':'')+'>'+ccEsc(value)+'</strong></div>'}
function crmPlan(x){return x.plan==='48'?'Essencial':x.plan==='96'?'Intensivo':'Plano não definido'}
function crmStudentMetrics(s,lessons){const x=ccData(s),y=Number(adminToday().date.slice(0,4)),prefix=y+'-',by={};lessons.filter(l=>l.lesson_date).forEach(l=>(by[l.lesson_date]??=[]).push(l));const rows=Object.entries(x.events),used=new Set(rows.filter(([d,e])=>e.original&&(e.status==='done'||by[d]?.length)).map(([d,e])=>e.original));const real=lessons.filter(l=>l.lesson_date?.startsWith(prefix)).length+rows.filter(([d,e])=>d.startsWith(prefix)&&e.status==='done'&&!by[d]).length;const absent=rows.filter(([d,e])=>d.startsWith(prefix)&&e.status==='absent'&&!by[d]&&!used.has(d)).length;const missed=rows.filter(([d,e])=>d.startsWith(prefix)&&['owed','absent'].includes(e.status)&&!by[d]).length;return {count:real+absent,target:ccTarget(x,y),pending:ccPending(x,by),frequency:real+missed?Math.round(real/(real+missed)*100)+'%':'—'}}
function crmDismissed(id,key){return !!ccRead(id).dismissedAlerts?.[key];}
async function crmDismissAlert(id,key){
 if(!confirm('Descartar somente este aviso? O registro original será preservado.'))return;
 const payload=ccRead(id);payload.dismissedAlerts={...payload.dismissedAlerts,[key]:true};
 if(await ccWrite(id,payload)&&currentView==='home')await renderHome();
}
function crmDismissButton(id,key){return '<button class="resource-action" onclick="crmDismissAlert(&quot;'+ccEsc(id)+'&quot;,&quot;'+ccEsc(key)+'&quot;)">Descartar pendência</button>';}
function crmOtherPending(){
 const singles=students.filter(s=>!s.is_test_profile).map(s=>{
 const inbox=crmInboxFor(s.id),x=ccData(s),entries=Object.entries(x.events);
 const labels={questions:'Pergunta pendente',materials:'Material do Aluno',texts:'Texto para correção'};
 const tabs={questions:'duvidas',materials:'pedidos',texts:'textos-aluno'};
 const row=(icon,label,key,action)=>'<div class="crm-pending-row">'+crmIcon(icon)+'<div class="crm-pending-text"><strong>'+ccEsc(s.full_name||s.email)+'</strong><small>'+ccEsc(label)+'</small></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn-ghost" onclick="'+ccEsc(action)+'">Abrir</button>'+crmDismissButton(s.id,key)+'</div></div>';
 const messages=Object.entries(labels).flatMap(([kind,label])=>(inbox[kind]||[]).filter(id=>!crmDismissed(s.id,kind+':'+id)).map(id=>row('message',label,kind+':'+id,"crmOpenInbox('"+s.id+"','"+tabs[kind]+"')")));
 const replacements=entries.filter(([d,e])=>!e.group_id&&!crmRegisteredDates.has(s.id+'|'+d)&&(['owed','teacher'].includes(e.status)||e.status==='absent'&&entries.some(([rd,r])=>r.original===d))&&!entries.some(([rd,r])=>r.original===d&&(r.status==='done'||crmRegisteredDates.has(s.id+'|'+rd)))&&!crmDismissed(s.id,'replacement:'+d)).map(([d])=>row('refresh','Reposição pendente · '+formatDate(d),'replacement:'+d,"ccOpenDate('"+s.id+"','"+d+"')"));
 return [...messages,...replacements].join('');
 }).join('');
 return singles+tgGroupReplacementRows().filter(r=>r.visible.length).map(({g,date,visible})=>'<div class="crm-pending-row">'+crmIcon('refresh')+'<div class="crm-pending-text"><strong>'+ccEsc(g.name)+'</strong><small>Reposição coletiva · '+formatDate(date)+'</small>'+visible.map(id=>'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px">'+ccEsc(students.find(s=>s.id===id)?.full_name||'Aluno')+crmDismissButton(id,'replacement:'+date)+'</div>').join('')+'<button class="btn-ghost" onclick="tgOpenReplacement(&quot;'+g.id+'&quot;,&quot;'+date+'&quot;)">Agendar ou concluir reposição</button></div></div>').join('');
}
async function crmOpenInbox(id,tab){await openStudent(id);switchTab(tab);}

function crmStudentSummary(){let x=ccData(currentStudent),by={};currentLessons.filter(l=>l.lesson_date).forEach(l=>(by[l.lesson_date]??=[]).push(l));let history=[...currentLessons.filter(l=>l.lesson_date).map(l=>({date:l.lesson_date,title:l.title,status:'Realizada'})),...Object.entries(x.events).filter(([d,e])=>!by[d]&&e.status&&!e.skip&&e.status!=='planned').map(([date,e])=>({date,title:e.notes||'',status:ccStatus[e.status]}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);document.getElementById('tab-content').innerHTML='<section class="crm-panel"><div class="crm-panel-head"><h3>Caixa de entrada do aluno</h3></div><div class="crm-quick crm-inbox-quick">'+[['file','Material do Aluno','pedidos','materials'],['message','Dúvidas a responder','duvidas','questions'],['file','Textos a corrigir','textos-aluno','texts']].map(([icon,label,tab,kind])=>'<button onclick="switchTab(&quot;'+tab+'&quot;)">'+crmIcon(icon)+label+'<span data-crm-inbox="'+ccEsc(currentStudent.id)+'" data-crm-kind="'+kind+'">'+crmCountBadge(crmInboxFor(currentStudent.id)[kind].length,label)+'</span></button>').join('')+'</div>'+(crmInboxError?'<p class="small-note">Alguns contadores estão indisponíveis.</p>':'')+'</section><section class="crm-panel"><div class="crm-panel-head"><h3>Ações rápidas</h3></div><div class="crm-quick">'+[['plus','Cadastrar aula',"switchTab(\'nova\')"],['calendar','Agendar reposição',"ccOpenDate(currentStudent.id,adminToday().date)"],['calendar','Registrar falta',"ccOpenDate(currentStudent.id,adminToday().date)"],['video','Abrir videochamada','openTodayClassCall(currentStudent.id)']].map(([icon,label,action])=>'<button onclick="'+ccEsc(action)+'">'+crmIcon(icon)+label+'</button>').join('')+'</div></section><section class="crm-panel"><div class="crm-panel-head"><h3>Histórico recente</h3><button class="crm-link" onclick="switchTab(&quot;calendario&quot;)">Ver calendário →</button></div>'+history.map(h=>'<div class="crm-history"><time>'+ccEsc(h.date.split('-').reverse().join('/'))+'</time><i class="'+(h.status==='Realizada'?'is-done':'')+'"></i><div><strong>'+ccEsc(h.status)+'</strong><small>'+ccEsc(h.title)+'</small></div></div>').join('')+(history.length?'':'<p class="crm-empty">Nenhuma aula registrada.</p>')+'</section>'}
