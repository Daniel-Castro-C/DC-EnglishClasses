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
function ccData(s){const x=ccRead(s.id);return {plan:x.plan||'',start:x.start||'',weekdays:x.weekdays??String(s.lesson_weekday||''),time:x.time??String(s.lesson_time||'').slice(0,5),changes:Array.isArray(x.changes)?x.changes:[],end:x.end||'',events:ccEffectiveEvents(s.id,x.events||{}),dismissedAlerts:x.dismissedAlerts||{}}}
function ccSchedule(x,date){const changes=x.changes.filter(c=>c.from<=date).sort((a,b)=>a.from.localeCompare(b.from));return changes.at(-1)||{weekdays:x.weekdays,time:x.time};}
function ccHabitual(x,date){return (!x.start||date>=x.start)&&(!x.end||date<=x.end)&&ccSchedule(x,date).weekdays.split(',').includes(String(new Date(date+'T12:00:00').getDay()||7));}
function ccDayInputs(days,prefix){return ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((label,i)=>'<label class="cc-weekday-chip"><input type="checkbox" name="'+prefix+'" value="'+(i+1)+'" '+(days.split(',').includes(String(i+1))?'checked':'')+'> '+label+'</label>').join('');}
function ccPickedDays(name){return [...document.querySelectorAll('input[name="'+name+'"]:checked')].map(e=>e.value).join(',');}
// Drafts are isolated from the committed calendar and kept per student/group while navigating.
const ccDrafts=new Map();
const ccClone=v=>JSON.parse(JSON.stringify(v));
let ccActiveKey='';
function ccGroupSchedule(g){return {plan:g.plan||'',start:g.start||'',end:g.end||'',weekdays:g.days||'',time:g.time||'',changes:Array.isArray(g.changes)?ccClone(g.changes):[],events:ccClone(g.calendar_events||{})};}
function ccAbsent(status){return ['absent','owed'].includes(status);}
function ccAttendanceStatus(base,override){return override&&['planned','done','absent','owed'].includes(base)?override:base;}
function ccEffectiveEvents(id,events){
 const result=ccClone(events);
 for(const g of tgGroups.filter(g=>g.members.includes(id))){
  for(const [date,base] of Object.entries(g.calendar_events||{})){
   const row=result[date];
   if(row&&row.group_id&&row.group_id!==g.id)continue;
   const override=row?.group_id===g.id?row.attendance_override:undefined;
   result[date]={...base,group_id:g.id,group_status:base.status,status:ccAttendanceStatus(base.status,override),...(override?{attendance_override:override}:{})};
  }
  for(const [date,e] of Object.entries(result)){
   if(e.group_id!==g.id||!ccAbsent(e.status))continue;
   const noReplacement=(g.calendar_events?.[date]?.status||e.group_status)==='absent';
   const allAbsent=!noReplacement&&g.members.every(member=>{
    const row=member===id?e:ccRead(member).events?.[date],base=g.calendar_events?.[date];
    return !g.calendarLessons?.some(l=>l.student_id===member&&l.lesson_date===date&&l.group_id===g.id&&!ccAbsent(l.calendar_status))&&(base||row?.group_id===g.id)&&ccAbsent(ccAttendanceStatus(base?.status||row.status,row?.attendance_override));
   });
   e.status=allAbsent?'owed':'absent';
  }
 }
 return result;
}
// Older individual deletions stored only {skip:true}, even on an otherwise
// habitual group date. They contain no separate appointment or attendance.
// Never reinterpret a linked reschedule/replacement, another group or a registered lesson.
function ccLegacyGroupSkip(event,schedule,date,events,lessons,id){
 return !!event?.skip&&event.skip===true&&Object.keys(event).every(k=>k==='skip')&&ccIsHabitual(schedule,date)&&
  !lessons.some(l=>l.student_id===id&&l.lesson_date===date)&&
  !Object.entries(events).some(([day,row])=>day!==date&&row&&(row.original===date||row.rescheduled_from===date||row.rescheduled_to===date));
}
function ccGroupForDate(id,date){
 const events=ccRead(id).events||{},event=events[date];
 return tgGroups.find(g=>g.members.includes(id)&&(event?.group_id===g.id||(!event?.group_id&&(
  Object.hasOwn(g.calendar_events||{},date)||g.calendarLessons?.some(l=>l.student_id===id&&l.lesson_date===date&&l.group_id===g.id)||g.start&&ccHabitual(ccGroupSchedule(g),date)&&(!event||ccLegacyGroupSkip(event,ccGroupSchedule(g),date,events,g.calendarLessons||[],id)||!event.skip&&!event.original&&!event.rescheduled_from&&!event.rescheduled_to&&(!event.time||event.time===ccSchedule(ccGroupSchedule(g),date).time))
 ))))||null;
}
function ccGroupBase(ctx,d,date){
 const explicit=d.schedule.events[date];if(explicit)return ctx.lessons.some(l=>l.group_id===ctx.group.id&&l.lesson_date===date&&!l.calendar_status)&&!d.registeredStatuses?.[date]?{...explicit,status:'done'}:explicit;
 const rows=ctx.members.map(s=>d.payloads[s.id].events[date]).filter(e=>e?.group_id===ctx.group.id);
 const registered=ctx.lessons.some(l=>l.group_id===ctx.group.id&&l.lesson_date===date)||typeof ccLessonRows==='function'&&ccLessonRows(ctx,date).length>0;
 if(rows.length&&rows.every(e=>e.skip))return {skip:true};
 const first=rows.find(e=>!e.skip)||{};
 const statuses=rows.map(e=>e.group_status||e.status).filter(Boolean);
 const status=registered?'done':statuses.includes('done')?'done':statuses.includes('planned')?'planned':statuses.length===ctx.members.length&&statuses.every(ccAbsent)?(rows.some(e=>e.group_status==='absent')?'absent':'owed'):statuses.find(v=>!ccAbsent(v))||ccGlobalStatus(date)||(d.schedule.start&&ccIsHabitual(d.schedule,date)?'planned':'');
 const {time,notes,original,rescheduled_from,rescheduled_to}=first;
 return {status,time:time||ccSchedule(d.schedule,date).time,notes:notes||'',...(original?{original}:{}),...(rescheduled_from?{rescheduled_from}:{}),...(rescheduled_to?{rescheduled_to}:{})};
}
function ccLegacyGroupRow(ctx,d,id,date){
 const e=d.payloads[id].events[date];
 if(!e||e.group_id===ctx.group.id)return e;
 if(ccLegacyGroupSkip(e,d.schedule,date,d.payloads[id].events,ctx.lessons,id))return e;
 // Only adopt an earlier attendance entry at the habitual group time, never a separate linked appointment.
 if(!e.group_id&&!e.skip&&!e.original&&!e.rescheduled_from&&!e.rescheduled_to&&ccIsHabitual(d.schedule,date)&&(!e.time||e.time===ccSchedule(d.schedule,date).time))return e;
 return null;
}
function ccLegacySkipMembers(ctx,d,date){
 if(!ctx.group)return [];
 return ctx.members.filter(s=>ccLegacyGroupSkip(d.payloads[s.id].events[date],d.schedule,date,d.payloads[s.id].events,ctx.lessons,s.id));
}
function ccGroupOverride(row,base){
 if(row?.attendance_override)return row.attendance_override;
 if(row?.group_status)return undefined;
 if(!row||row.skip||!row.status||row.status===base.status)return undefined;
 // Existing individual attendance must not be erased on migration to a shared source.
 if(ccAbsent(row.status)&&!ccAbsent(base.status))return 'absent';
 if(row.status==='done'&&base.status==='planned')return 'done';
 return undefined;
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
 const deps=[...new Set(ctx.members.flatMap(s=>[s.id,...tgGroups.filter(g=>g.members.includes(s.id)).flatMap(g=>g.members)]))];
 const signature=JSON.stringify(deps.map(id=>[id,ccCloud.get(id)?.revision||0]));
 if(existing&&!existing.dirty&&existing.signature!==signature)ccDrafts.delete(ctx.key);
 if(!ccDrafts.has(ctx.key)){
  const payloads=Object.fromEntries(ctx.members.map(s=>[s.id,ccData(s)]));
  ccDrafts.set(ctx.key,{key:ctx.key,signature,payloads,base:ccClone(payloads),revisions:Object.fromEntries(ctx.members.map(s=>[s.id,ccCloud.get(s.id)?.revision||0])),schedule:ctx.group?ccGroupSchedule(ctx.group):null,baseSchedule:ctx.group?ccGroupSchedule(ctx.group):null,dirty:false,date:new Date(ccDate),selected:ccSelected});
 }
 return ccDrafts.get(ctx.key);
}
function ccModel(ctx,d){return ctx.group?d.schedule:d.payloads[ctx.members[0].id];}
function ccRegistered(ctx,id,date){return ctx.lessons.some(l=>l.student_id===id&&l.lesson_date===date);}
function ccIsHabitual(x,date){return !!ccSchedule(x,date).time&&ccHabitual(x,date);}
function ccEvent(ctx,d,id,date){const e=d.payloads[id].events[date];return ctx.group&&e?.group_id!==ctx.group.id?undefined:e;}
function ccDateState(ctx,d,date){
 if(typeof ccPendingLessonDeletion==='function'&&ccPendingLessonDeletion(ctx,date))return {rows:ctx.members.map(s=>({id:s.id,status:'',real:false,e:{skip:true},time:''})),status:'',base:ctx.group?{skip:true}:null,event:{skip:true},real:false,mixed:false};
 const x=ccModel(ctx,d),base=ctx.group?ccGroupBase(ctx,d,date):null;
 const individualGroup=!ctx.group?ccGroupForDate(ctx.members[0].id,date):null;
 const rows=ctx.members.map(s=>{
  const own=ccEvent(ctx,d,s.id,date),e=ctx.group?ccLegacyGroupRow(ctx,d,s.id,date):own;
  const registered=ctx.lessons.find(l=>l.student_id===s.id&&l.lesson_date===date&&(!ctx.group||l.group_id===ctx.group.id||typeof ccLessonRows==='function'&&ccLessonRows(ctx,date).includes(l)));
  const real=!!registered;
  const shared=individualGroup?.calendar_events?.[date];
  const fallback=individualGroup?ccSchedule(ccGroupSchedule(individualGroup),date):ccSchedule(x,date);
  const event=ctx.group?{...base,...e,time:base.time||e?.time,group_id:ctx.group.id}:shared?{...shared,...own,time:shared.time||own?.time}:e;
  let status=real?(d.registeredStatuses?.[date]?event?.status||'done':registered.calendar_status||'done'):ctx.group?(base.skip?'':ccAttendanceStatus(base.status,ccGroupOverride(e,base))):event?.skip?'':event?.status||ccGlobalStatus(date)||((individualGroup?ccIsHabitual(ccGroupSchedule(individualGroup),date):ccIsHabitual(x,date))?'planned':'');
  if(ctx.group&&ccAbsent(status))status='absent';
  if(individualGroup&&ccAbsent(status)){const all=(shared?.status||own?.group_status)!=='absent'&&individualGroup.members.every(id=>id===s.id||(!individualGroup.calendarLessons?.some(l=>l.student_id===id&&l.lesson_date===date&&l.group_id===individualGroup.id&&!ccAbsent(l.calendar_status))&&ccAbsent(ccData(students.find(v=>v.id===id)).events[date]?.status)));status=all?'owed':'absent';}
  return {id:s.id,e:event,status,real,override:ctx.group?ccGroupOverride(e,base):own?.attendance_override,time:fallback.time};
 });
 const allAbsent=ctx.group&&rows.every(r=>ccAbsent(r.status));
 const collectiveAbsence=base?.status==='absent'?'absent':'owed';
 if(allAbsent)rows.forEach(r=>r.status=collectiveAbsence);
 const status=ctx.group?(base.skip?'':allAbsent?collectiveAbsence:base.status||''):rows[0].status;
 return {rows,status,base,event:ctx.group?base:rows[0].e||{time:rows[0].time},real:ctx.members.some(s=>ccRegistered(ctx,s.id,date)),mixed:ctx.group&&new Set(rows.map(r=>r.status)).size>1};
}
function ccDateLabel(status,event){if(status==='done'&&event?.original)return 'Reposição realizada';if(status==='planned'&&event?.original)return 'Reposição agendada';return status==='mixed'?'Frequência mista':ccStatus[status]||'';}
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
 ccMarkDirty(ctx,d);ccRefreshGrid();const summary=document.getElementById('cc-schedule-label');if(summary)summary.textContent=ccScheduleLabel(next);return true;
}
function ccMessage(msg){const el=document.getElementById('cc-message');if(el)el.textContent=msg;}
function ccMarkDirty(ctx,d){d.dirty=true;ccUpdateToolbar(d);}
function ccUpdateToolbar(d){const btn=document.getElementById('cc-save-all'),discard=document.getElementById('cc-discard');if(btn)btn.disabled=ccSaving||!d.dirty;if(discard)discard.disabled=ccSaving||!d.dirty;ccMessage(d.dirty?'Alterações e arquivos no rascunho. Clique em Salvar calendário para confirmar.':'Calendário salvo.');}
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
function ccScheduleLabel(x){
 const current=ccSchedule(x,adminToday().date),days=current.weekdays.split(',').filter(Boolean).map(day=>['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][Number(day)-1]).filter(Boolean);
 return days.length&&current.time?days.join(' · ')+' às '+current.time:'Sem horário habitual';
}
function ccScheduleToggle(el){const d=ccDraft();if(d&&el.isConnected)d.scheduleOpen=el.open;}
function ccRender(){
 const ctx=ccContext();if(!ctx||!ctx.members.length)return;
 const root=document.getElementById(ctx.group?'tg-body':'tab-content');if(!root)return;
 const d=ccDraft(ctx);
 if(!ctx.group&&!currentLessonsReady){root.innerHTML='<p role="alert">Não foi possível carregar as aulas cadastradas. Atualize antes de editar.</p><button class="btn-ghost" onclick="ccImportCompletions()" title="Busca os dados mais recentes já salvos no sistema.">Recarregar dados</button>';return;}
 if(ctx.group&&ctx.members.length!==ctx.group.members.length){root.innerHTML='<p role="alert">Não foi possível carregar todos os integrantes da turma.</p>';return;}
 if(ccActiveKey!==ctx.key){ccActiveKey=ctx.key;ccDate=d.date;ccSelected=d.selected;}
 const x=ccModel(ctx,d);
 root.innerHTML='<div class="box cc-calendar-toolbar"><h3>'+(ctx.group?'Calendário da turma':'Calendário individual')+'</h3><p class="small-note">'+(ctx.group?'Este calendário é a origem das aulas coletivas: status, horários e observações são espelhados nos calendários dos integrantes.':'Nas aulas de turma, registre apenas a frequência individual; as demais informações vêm do calendário da turma.')+' Salve todas as alterações de uma vez.</p><div class="row"><button id="cc-save-all" class="btn-dark-sm" onclick="ccSaveAll()">Salvar calendário</button><button id="cc-discard" class="btn-ghost" onclick="ccDiscard()" title="Cancela somente as alterações ainda não salvas e os anexos selecionados.">Cancelar alterações não salvas</button><button class="btn-ghost" onclick="ccImportCompletions()" title="Busca os dados mais recentes já salvos no sistema.">Recarregar dados</button></div><p id="cc-message" class="small-note" role="status" aria-live="polite"></p></div><details class="cc-schedule-settings" id="cc-schedule-settings" '+(d.scheduleOpen?'open':'')+' ontoggle="ccScheduleToggle(this)"><summary><span><strong>Configurar horário habitual</strong><small id="cc-schedule-label">'+ccEsc(ccScheduleLabel(x))+'</small></span><span class="cc-settings-count">'+x.changes.length+' alteração(ões)</span></summary><div class="cc-schedule-grid"><section class="box cc-schedule-card cc-schedule-base"><h3>Horário habitual</h3><div class="row cc-schedule-fields"><label>Plano <select id="cc-plan" onchange="ccStageConfig()"><option value="">Selecionar</option><option value="48">Essencial · 48</option><option value="96">Intensivo · 96</option></select></label><label>Início <input id="cc-start" type="date" value="'+ccEsc(x.start)+'" onchange="ccStageConfig()"></label><label>Horário inicial <input id="cc-base-time" type="time" value="'+ccEsc(x.time)+'" onchange="ccStageConfig()"></label><label>Fim (opcional) <input id="cc-end" type="date" value="'+ccEsc(x.end)+'" onchange="ccStageConfig()"></label></div><p class="small-note">Dias habituais iniciais</p><div class="cc-weekday-group" onchange="ccStageConfig()">'+ccDayInputs(x.weekdays,'cc-base-day')+'</div></section><section class="box cc-schedule-card cc-schedule-changes"><h3>Alterações de horário habitual</h3><p class="small-note">Escolha a data a partir da qual o novo horário vale. Para encerrar a recorrência, deixe todos os dias desmarcados.</p><div class="row cc-schedule-fields"><label>A partir de <input id="cc-change-date" type="date" value="'+adminToday().date+'"></label><label>Horário <input id="cc-change-time" type="time" value="'+ccEsc(ccSchedule(x,adminToday().date).time)+'"></label></div><div class="cc-weekday-group">'+ccDayInputs(ccSchedule(x,adminToday().date).weekdays,'cc-change-day')+'</div><button class="btn-ghost" onclick="ccChangeAdd()">Adicionar alteração</button>'+x.changes.slice().sort((a,b)=>a.from.localeCompare(b.from)).map(c=>'<div class="resource-row"><div class="resource-info"><div class="name">A partir de '+ccEsc(formatDate(c.from))+'</div><div class="desc">'+ccEsc(c.weekdays.split(',').filter(Boolean).map(day=>['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][Number(day)-1]).join(', ')||'Sem recorrência')+' · '+ccEsc(c.time)+'</div></div><button class="btn-ghost" onclick="ccChangeEdit(&quot;'+ccEsc(c.from)+'&quot;)">Editar</button><button class="btn-ghost" onclick="ccChangeRemove(&quot;'+ccEsc(c.from)+'&quot;)">Excluir</button></div>').join('')+'</section></div></details><div class="box" id="cc-annual"></div><div class="cc-calendar-workspace"><div class="cc-calendar-columns"><div class="box cc-month-panel">'+(typeof ccLessonHistory==='function'?'<div class="row"><button class="btn-ghost" onclick="ccOpenSuggested()">Próxima aula</button><button class="btn-ghost" onclick="ccLessonHistory()">Histórico de aulas</button></div><label>Ir para data<input type="date" aria-label="Ir para data" onchange="ccSelectLessonDate(this)"></label><div id="cc-history" hidden></div>':'')+'<div class="cc-month-navigation"><button class="btn-ghost" aria-label="Mês anterior" onclick="ccMove(-1)">←</button><h3 id="cc-month"></h3><button class="btn-ghost" aria-label="Próximo mês" onclick="ccMove(1)">→</button></div><div class="cc-month-grid" id="cc-grid"></div></div><section class="box cc-day-panel" aria-label="Informações da aula"><h3 class="cc-day-panel-label">Informações da aula</h3><p class="cc-day-placeholder small-note">Selecione uma data no calendário para consultar ou gerenciar a aula.</p><div id="cc-edit"></div></section></div></div>';
 root.querySelector('#cc-plan').value=x.plan;
 ccUpdateToolbar(d);ccRefreshGrid();if(ccSelected)ccEditor();
}
function ccRefreshGrid(){
 const ctx=ccContext(),d=ccDraft(ctx),grid=document.getElementById('cc-grid');if(!d||!grid)return;
 const x=ccModel(ctx,d),y=ccDate.getFullYear(),m=ccDate.getMonth(),n=new Date(y,m+1,0).getDate();
 const offset=new Date(y,m,1).getDay(),emptyCell='<div class="cc-empty-day" aria-hidden="true"></div>';
 let cells=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day=>'<small>'+day+'</small>').join('')+emptyCell.repeat(offset);
 for(let day=1;day<=n;day++){
  const date=ccISO(y,m,day),{status,event,mixed}=ccDateState(ctx,d,date);
  const moveLabel=typeof ccPendingMoveLabel==='function'?ccPendingMoveLabel(ctx,date):'',unavailable=ccUnavailable(date,status),label=ccDateLabel(status,event),holidayLabel=unavailable&&unavailable!==label?unavailable:'';
  cells+='<button class="btn-ghost cc-day'+(date===ccSelected?' cc-selected':'')+(unavailable?' cc-unavailable':'')+'" aria-label="'+ccEsc(formatDate(date)+(label?' · '+label:'')+(holidayLabel?' · '+holidayLabel:'')+(moveLabel?' · '+moveLabel:''))+'" onclick="ccSelect(&quot;'+date+'&quot;)"><b>'+day+'</b><small>'+ccEsc(label)+(moveLabel?'<br>'+ccEsc(moveLabel):'')+(holidayLabel?'<br><span class="cc-unavailable-label">'+ccEsc(holidayLabel)+'</span>':'')+(mixed?'<br>Frequência mista':'')+(status&&!['holiday','break'].includes(status)?'<br>'+ccEsc(event?.time||ccSchedule(x,date).time||''):'')+(event?.rescheduled_to?'<br>→ '+ccEsc(formatDate(event.rescheduled_to)):event?.rescheduled_from?'<br>De '+ccEsc(formatDate(event.rescheduled_from)):event?.original?'<br>Ref. '+ccEsc(formatDate(event.original)):'')+'</small></button>';
 }
 // Reserve six complete weeks so the calendar height never depends on the month length.
 grid.innerHTML=cells+emptyCell.repeat(42-offset-n);document.getElementById('cc-month').textContent=ccDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const dates=new Set(ctx.lessons.filter(l=>l.lesson_date?.startsWith(y+'-')&&(!ctx.group||l.group_id===ctx.group.id)).map(l=>l.lesson_date));
 for(const s of ctx.members)for(const [date,event] of Object.entries(d.payloads[s.id].events))if(date.startsWith(y+'-')&&(!ctx.group||event.group_id===ctx.group.id))dates.add(date);
 let completed=0,absent=0,pending=0;const groupVacations={};
 for(const date of dates){const state=ccDateState(ctx,d,date);if(state.rows.some(r=>r.status==='done'))completed++;else if(state.rows.every(r=>r.status==='absent'))absent++;
  if(ctx.group&&state.rows.every(r=>r.status==='vacation'&&r.e?.discounted!==false))groupVacations[date]={status:'vacation'};
  const eligible=ctx.group?state.status==='owed'&&state.rows.every(r=>ccAbsent(r.status)):ccReplacementDebt(x,date);
  if(eligible&&!state.rows.some(r=>r.status==='done')&&!ctx.members.every(s=>ccReplacementSettled(d.payloads[s.id],date,rd=>ccRegisteredClosed(ccDraftReplacementLessons(ctx,d,s.id),rd))))pending++;
 }
 document.getElementById('cc-annual').innerHTML='<h3>Controle anual · '+y+'</h3><p><b>'+(completed+absent)+' / '+(ccTarget(ctx.group?{...x,events:groupVacations}:x,y)??'—')+'</b> contabilizadas · '+completed+' realizadas · '+absent+' faltas sem reposição · '+pending+' reposições pendentes</p><p class="small-note">Aulas cadastradas são consideradas realizadas automaticamente.</p>';
}
function ccMove(direction){
 if(ccSaving||!ccFinishInput())return;
 const d=ccDraft();if(!d)return;
 ccDate=new Date(ccDate.getFullYear(),ccDate.getMonth()+direction,1);
 ccSelected='';d.date=ccDate;d.selected='';
 // Keep the navigation buttons mounted and focused. Only the month contents change.
 const editor=document.getElementById('cc-edit');if(editor)editor.innerHTML='';
 ccRefreshGrid();
}
function ccSelect(date){if(ccSaving||!ccFinishInput())return;const d=ccDraft();if(ccSelected!==date)d.editLessonDate='';ccSelected=date;d.selected=date;ccRefreshGrid();ccEditor();}
// A linked make-up that was completed OR missed without another make-up
// consumes the original entitlement. Keep the link for historical accuracy.
function ccReplacementLinks(x,original,except=''){
 return Object.entries(x.events||{}).filter(([date,event])=>date!==except&&event?.original===original&&!event.skip);
}
function ccReplacementSettled(x,original,registeredClosed=()=>false){
 return ccReplacementLinks(x,original).some(([date,event])=>['done','absent'].includes(event.status)||registeredClosed(date));
}
function ccReplacementDebt(x,date){
 const event=x.events[date];
 return !!event&&!event.skip&&(['owed','teacher'].includes(event.status)||event.status==='absent'&&ccReplacementLinks(x,date).length>0);
}
function ccRegisteredClosed(lessons,date){
 return lessons.some(l=>l.lesson_date===date&&['done','absent'].includes(l.calendar_status||'done'));
}
function ccDraftReplacementLessons(ctx,d,id){
 return ctx.lessons.filter(l=>l.student_id===id).map(l=>d.registeredStatuses?.[l.lesson_date]?{...l,calendar_status:d.payloads[id].events[l.lesson_date]?.status}:l);
}
function ccReplacementAvailable(x,original,date,lessons,collective=false){
 if(x.events[original]?.group_id&&(!collective||x.events[original].group_status==='absent'))return false;
 if(!original||original>=date||!ccReplacementDebt(x,original))return false;
 if(lessons.some(l=>l.lesson_date===original&&!['owed','absent','teacher'].includes(l.calendar_status)))return false;
 // Exclude the same date so a mistaken absence can be corrected in place.
 return !ccReplacementLinks(x,original,date).some(([rd,r])=>['done','planned','absent'].includes(r.status)||lessons.some(l=>l.lesson_date===rd&&['done','planned','absent'].includes(l.calendar_status||'done')));
}
function ccCanEditDate(ctx,d,date){
 if(ctx.members.some(s=>ccRegistered(ctx,s.id,date)))throw Error('Esta data tem aula cadastrada com materiais. Use Aulas e materiais para editar o cadastro; o calendário não exclui esse conteúdo.');
 if(!ctx.group&&(d.payloads[ctx.members[0].id].events[date]?.group_id||ccGroupForDate(ctx.members[0].id,date)))throw Error('Esta aula pertence à turma. Gerencie-a pelo calendário da turma.');
 if(ctx.group&&ctx.members.some(s=>{const e=d.payloads[s.id].events[date],other=ccGroupForDate(s.id,date);return (e&&e.group_id!==ctx.group.id&&!ccLegacyGroupRow(ctx,d,s.id,date))||(other&&other.id!==ctx.group.id);}))throw Error('Há um registro individual nesta data. Resolva o conflito no calendário individual antes de editar a turma.');
}
function ccDestinationFree(ctx,d,date){
 ccCanEditDate(ctx,d,date);
 const model=ccModel(ctx,d);
 // Feriados e recessos indicam indisponibilidade habitual, mas permitem exceções manuais.
 for(const s of ctx.members){
  const x=d.payloads[s.id],e=x.events[date];
  if(e&&!e.skip||!e?.skip&&!ccGlobalStatus(date)&&(((!ctx.group||model.start)&&ccIsHabitual(model,date))||ccIsHabitual(x,date)))throw Error('Já existe uma aula agendada ou um registro nesta data. Escolha outra data.');
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
 } if(ctx.group){const source=state.base?.rescheduled_from||from,first=d.payloads[ctx.members[0].id].events; if(source!==from)delete d.schedule.events[from];d.schedule.events[source]=ccSharedFields(first[source]);d.schedule.events[to]=ccSharedFields(first[to]);}
}
function ccDeleteDate(ctx,d,date){
 ccCanEditDate(ctx,d,date);
 const group=ctx.group?{group_id:ctx.group.id}:{};
 const prior=ctx.group?ccGroupBase(ctx,d,date):null;
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
 } if(ctx.group){
  const first=d.payloads[ctx.members[0].id].events;
  if(prior.rescheduled_to)delete d.schedule.events[prior.rescheduled_to];
  if(prior.rescheduled_from&&first[prior.rescheduled_from])d.schedule.events[prior.rescheduled_from]=ccSharedFields(first[prior.rescheduled_from]);
  if(first[date]?.skip)d.schedule.events[date]={skip:true};else delete d.schedule.events[date];
 }
}
function ccSharedFields(row){
 const {status,time,notes,original,rescheduled_from,rescheduled_to,skip}=row||{};
 return JSON.parse(JSON.stringify({status,time,notes,original,rescheduled_from,rescheduled_to,skip}));
}
function ccIndividualAttendance(ctx,d,date,group,value){
 const id=ctx.members[0].id,x=d.payloads[id],old=x.events[date]||{};
 const registered=ctx.lessons.filter(l=>l.student_id===id&&l.lesson_date===date);
 if(registered.length&&(registered.length!==1||!registered[0].id||registered[0].group_id!==group.id))throw Error('Registro com materiais cadastrados ambíguo. Ajuste pelo calendário da turma.');
 if(!['inherit','done','absent'].includes(value))throw Error('Frequência inválida.');
 if(!old.group_id&&(old.original||old.rescheduled_from||old.rescheduled_to||old.skip||old.time&&old.time!==ccSchedule(ccGroupSchedule(group),date).time))throw Error('Já existe um registro individual independente nesta data.');
 if(old.group_id&&old.group_id!==group.id)throw Error('Esta data pertence a outra turma.');
 const published=group.calendarLessons?.some(l=>l.group_id===group.id&&l.lesson_date===date);
 const otherRows=group.members.map(mid=>ccRead(mid).events?.[date]).filter(e=>e?.group_id===group.id);
 const base=group.calendar_events?.[date]||{status:published?'done':old.group_status||otherRows.find(e=>e.group_status)?.group_status||otherRows.find(e=>e.status==='done')?.status||(otherRows.length===group.members.length&&otherRows.every(e=>ccAbsent(e.status))?'owed':'planned'),time:old.time||ccSchedule(ccGroupSchedule(group),date).time,notes:old.notes||'',...(old.original?{original:old.original}:{}),...(old.rescheduled_from?{rescheduled_from:old.rescheduled_from}:{})};
 if(base.skip||!['planned','done','absent','owed'].includes(base.status))throw Error('A aula não está disponível para registrar frequência. Altere o calendário da turma.');
 // Prevent breaking a collective make-up already linked to this absence.
 if(value!=='absent'&&Object.entries(x.events).some(([rd,r])=>rd!==date&&r.original===date&&!r.skip))throw Error('Exclua a reposição coletiva vinculada antes de corrigir esta falta.');
 const override=value==='inherit'?undefined:value;
 const status=ccAttendanceStatus(base.status,override);
 x.events[date]={...ccSharedFields(base),group_id:group.id,group_status:base.status,status:ccAbsent(status)?'absent':status,...(override?{attendance_override:override}:{})};
 if(registered.length)(d.registeredStatuses??={})[date]={date,ids:registered.map(l=>l.id),attendance:true};
}
function ccChangeIndividualAttendance(){
 const ctx=ccContext(),d=ccDraft(ctx),group=ccGroupForDate(ctx.members[0].id,ccSelected);
 if(!group||ccSaving)return;
 try{ccIndividualAttendance(ctx,d,ccSelected,group,document.getElementById('cc-own-attendance').value);ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();}catch(e){alert(e.message);ccEditor();}
}
// A registered lesson already carries its topic in both calendar contexts.
function ccPublishedDetails(ctx,date){
 const seen=new Set();
 return ctx.lessons.filter(l=>l.lesson_date===date).map(l=>{
  const title=String(l.title||'Aula realizada').trim(),topic=String(l.topic||'').trim();
  // Group details show one copy of each title/topic for the selected day.
  // Older shared lessons were registered separately per student, without a group_id.
  if(ctx.group){
   const key=JSON.stringify([title,topic]);
   if(seen.has(key))return '';
   seen.add(key);
  }
  return '<p>Aula cadastrada: '+ccEsc(title)+'</p><p><strong>Tema:</strong> '+ccEsc(topic||'Não cadastrado')+'</p>';
 }).join('');
}
function ccDayHeading(date,state,time){
 const label=ccDateLabel(state.status,state.event)||'Sem aula',unavailable=ccUnavailable(date,state.status);
 return '<div class="cc-day-heading"><div><h3>'+ccEsc(formatDate(date))+(state.status&&!['holiday','break'].includes(state.status)&&time?' · '+ccEsc(time):'')+'</h3></div><span class="cc-day-status" data-status="'+ccEsc(state.status||'empty')+'">'+ccEsc(label)+(state.mixed?' · frequência mista':'')+'</span></div>'+(state.event?.original?'<p class="small-note">Reposição referente a '+ccEsc(formatDate(state.event.original))+'</p>':'')+(state.event?.original&&state.status==='absent'?'<p class="small-note">A falta sem reposição nesta aula encerra o direito à reposição da aula original.</p>':'')+(unavailable?'<p class="cc-unavailable-note">'+ccEsc(unavailable)+' · Dia normalmente indisponível. É possível registrar uma aula excepcional.</p>':'');
}
function ccQuickDayActions(ctx,state){
 const status=state.status;
 if(state.real)return '';
 const real='<button type="button" class="btn-dark-sm" onclick="ccQuickDayStatus(&quot;done&quot;)">✓ Realizar aula</button>';
 const schedule='<button type="button" class="btn-ghost" onclick="ccQuickDayStatus(&quot;planned&quot;)">Agendar aula</button>';
 const absence='<details class="cc-absence-menu"><summary class="btn-ghost">Registrar falta</summary><div class="cc-absence-options">'+(ctx.group?'<button type="button" class="btn-ghost" onclick="ccQuickDayStatus(&quot;absent&quot;)">Falta sem reposição</button><button type="button" class="btn-ghost" onclick="ccQuickDayStatus(&quot;owed&quot;)">Falta de todos os integrantes (com reposição)</button><button type="button" class="btn-ghost" onclick="ccOpenDayDetails()">Frequência individual</button>':'<button type="button" class="btn-ghost" onclick="ccQuickDayStatus(&quot;absent&quot;)">Falta sem reposição</button><button type="button" class="btn-ghost" onclick="ccQuickDayStatus(&quot;owed&quot;)">Falta com reposição</button>')+'</div></details>';
 const move='<button type="button" class="btn-ghost" onclick="ccQuickDayStatus(&quot;move&quot;)">Reagendar</button>';
 const remove='<button type="button" class="resource-action cc-danger-action" onclick="ccRemove()">Excluir registro</button>';
 return '<div class="cc-day-actions">'+(!status?schedule+real:status==='planned'?real+absence+move+remove:status==='done'?remove:real+schedule+remove)+'</div>';
}
function ccOpenDayDetails(){
 const details=document.getElementById('cc-day-options');if(details)details.open=true;
 const attendance=document.getElementById('cc-attendance');if(attendance)attendance.scrollIntoView({block:'nearest'});
}
function ccQuickDayStatus(status){
 const el=document.getElementById('cc-status');if(!el||el.disabled||ccSaving)return;
 if(status==='move')ccOpenDayDetails();
 el.value=status;ccStatusChange();
}
function ccEditor(){
 const ctx=ccContext(),d=ccDraft(ctx),el=document.getElementById('cc-edit');if(!d||!el||!ccSelected)return;
 const date=ccSelected,state=ccDateState(ctx,d,date),x=ccModel(ctx,d),e=state.event||{};
 const group=!ctx.group&&ccGroupForDate(ctx.members[0].id,date);
 const header=ccDayHeading(date,state,e.time||ccSchedule(x,date).time);
 if(typeof ccPendingLessonDeletion==='function'&&ccPendingLessonDeletion(ctx,date)){el.innerHTML=header+ccLessonForm(ctx,d,date,state);return;}
 if(group){
  const base=group.calendar_events?.[date],own=d.payloads[ctx.members[0].id].events[date]||{};
  const legacySkip=ccLegacyGroupSkip(own,ccGroupSchedule(group),date,d.payloads[ctx.members[0].id].events,group.calendarLessons||[],ctx.members[0].id);
  const permitted=!base?.skip&&!own.skip&&['planned','done','absent','owed'].includes(base?.status||own.status||state.status);
  const ownForm=state.real&&typeof ccLessonForm==='function'?ccLessonForm(ctx,d,date,state):'';
  el.innerHTML=header+(ownForm?'':state.real&&typeof ccLessonConsultation==='function'?ccLessonConsultation(ctx,date,ctx.lessons.filter(l=>l.lesson_date===date),false):ccPublishedDetails(ctx,date))+'<p>Esta aula pertence à turma '+ccEsc(group.name)+'. Alterações coletivas são feitas no calendário da turma.</p>'+(legacySkip?'<p class="cc-unavailable-note">Há uma exclusão individual antiga nesta data. Abra o calendário da turma para restaurar ou excluir a aula para todos os integrantes.</p>':'')+(permitted?'<label>Frequência deste aluno <select id="cc-own-attendance" onchange="ccChangeIndividualAttendance()"><option value="inherit">Herdar status da turma</option><option value="done">Presente / Realizada</option><option value="absent">Falta</option></select></label><p class="small-note">A falta não altera os demais alunos. Só há reposição quando todos faltarem.</p>':'')+'<button class="btn-dark-sm" onclick="tgOpenDate(&quot;'+ccEsc(group.id)+'&quot;,&quot;'+date+'&quot;)">Abrir calendário da turma</button>';
  if(ownForm)el.insertAdjacentHTML('beforeend',ownForm);
  if(permitted)document.getElementById('cc-own-attendance').value=ccGroupOverride(own,base||{status:own.group_status||'planned'})||'inherit';
  return;
 }
 if(state.real&&(!ctx.group||typeof ccLessonCanManage==='function'&&ccLessonCanManage(ctx,date))){const lesson=typeof ccLessonForm==='function'?ccLessonForm(ctx,d,date,state):'';el.innerHTML=header+(lesson||ccPublishedDetails(ctx,date)+'<p class="small-note">Aulas cadastradas são protegidas.</p>');return;}
 try{if(!ctx.group||!state.real)ccCanEditDate(ctx,d,date);}catch(error){el.innerHTML=header+'<p role="alert">'+ccEsc(error.message)+'</p>';return;}
 if(state.status==='rescheduled'){
  el.innerHTML=header+'<p><strong>Reagendado</strong> para '+ccEsc(formatDate(e.rescheduled_to))+'</p><div class="row"><button class="btn-ghost" onclick="ccJump(&quot;'+ccEsc(e.rescheduled_to)+'&quot;)">Ir para nova data</button><button class="btn-ghost" onclick="ccRemove()">Excluir registro e cancelar reagendamento</button></div>';return;}
 const legacySkips=ccLegacySkipMembers(ctx,d,date);
 const legacyNotice=legacySkips.length?'<div class="box"><h4>Registro individual antigo</h4><p>'+ccEsc(legacySkips.map(s=>s.full_name||s.email||'Aluno').join(', '))+' possui uma exclusão individual nesta data. Altere ou exclua a aula pela turma para sincronizar os calendários. Nada será alterado até salvar.</p>'+(!state.real&&['planned','done','owed','absent','teacher','holiday','break','vacation'].includes(state.base?.status)?'<button type="button" class="btn-ghost" onclick="ccRepairLegacySkip()">Sincronizar com a turma</button>':'')+'</div>':'';
 const statuses=Object.entries(ccStatus).filter(([k])=>k!=='rescheduled');
 const selected=(ctx.group?state.base.status:state.status)||'';
 const options=statuses.map(([k,v])=>'<option value="'+k+'">'+ccEsc(v)+'</option>').join('');
 const candidates=Object.entries(d.payloads[ctx.members[0].id].events).filter(([from])=>ctx.members.every(s=>{
  const row=d.payloads[s.id],ls=ccDraftReplacementLessons(ctx,d,s.id);
  return ctx.group?ccGroupBase(ctx,d,from).status!=='absent'&&ctx.members.every(m=>['absent','owed'].includes(d.payloads[m.id].events[from]?.status)&&d.payloads[m.id].events[from]?.group_id===ctx.group.id)&&ccReplacementAvailable(row,from,date,ls,true):ccReplacementAvailable(row,from,date,ls);
 }));
 const lesson=typeof ccLessonForm==='function'?ccLessonForm(ctx,d,date,state):'';
 el.innerHTML=header+legacyNotice+(ctx.group&&state.real?(lesson||ccPublishedDetails(ctx,date)+'<p class="small-note">Aulas cadastradas são protegidas; a frequência dos integrantes sem cadastro ainda pode ser ajustada.</p>'):'')+ccQuickDayActions(ctx,state)+(e.rescheduled_from?'<p class="small-note">Reagendado de '+ccEsc(formatDate(e.rescheduled_from))+'</p>':'')+'<details id="cc-day-options" class="cc-day-options"><summary>'+(ctx.group&&state.real?'Ajustar frequência individual':'Mais opções da aula')+'</summary><label>Status da aula <select id="cc-status" onchange="ccStatusChange()" '+(ctx.group&&state.real?'disabled':'')+'>'+(state.status?'':'<option value="">Selecione o status</option>')+options+'<option value="move">Reagendar para...</option></select></label><div id="cc-reschedule" hidden><label>Nova data <input id="cc-reschedule-date" type="date" min="1900-01-01" max="9999-12-31" required onkeydown="if(event.key===&quot;Enter&quot;){event.preventDefault();ccApplyReschedule();}"></label><p class="small-note">Digite a data completa ou selecione-a no calendário. A data original será mantida como Reagendado.</p><div class="row"><button type="button" class="btn-dark-sm" onclick="ccApplyReschedule()">Confirmar reagendamento</button><button type="button" class="btn-ghost" onclick="ccEditor()">Cancelar reagendamento</button></div></div>'+(ctx.group?'<div id="cc-attendance"><h4>Frequência individual</h4>'+state.rows.map(r=>'<label>'+ccEsc(ctx.members.find(s=>s.id===r.id).full_name||r.id)+' · '+ccEsc(ccDateLabel(r.status)||'Sem aula')+'<select data-cc-member="'+ccEsc(r.id)+'" onchange="ccApplyDay(true)" '+(r.real||!['planned','done','absent','owed'].includes(state.base.status)?'disabled':'')+'><option value="inherit">Herdar status da turma</option><option value="done">Presente / Realizada</option><option value="absent">Falta</option>'+'</select></label>').join('')+'</div>':'')+'<label>Reposição referente a <select id="cc-original" onchange="ccApplyDay()" '+(ctx.group&&state.real?'disabled':'')+'><option value="">Não é reposição</option>'+candidates.map(([from])=>'<option value="'+from+'">'+ccEsc(formatDate(from))+'</option>').join('')+'</select></label><label>Horário <input id="cc-time" type="time" onchange="ccApplyDay()" '+(ctx.group&&state.real?'disabled':'')+' value="'+ccEsc(e.time||ccSchedule(x,date).time||'')+'"></label><label>Observações <textarea id="cc-notes" onchange="ccApplyDay()" '+(ctx.group&&state.real?'disabled':'')+'>'+ccEsc(e.notes||'')+'</textarea></label><div class="row"><button class="btn-ghost" onclick="ccRemove()" '+(ctx.group&&state.real?'disabled':'')+'>Excluir registro de aula</button></div><p class="small-note">Alterações nesta data ficam no rascunho. '+(ctx.group?'Uma reposição exige falta de todos os integrantes e não é gerada quando o status coletivo é Falta sem reposição.':'Uma aula habitual excluída não reaparece automaticamente.')+'</p></details>';
 document.getElementById('cc-status').value=selected;
 document.getElementById('cc-original').value=e.original||'';
 if(ctx.group)document.querySelectorAll('[data-cc-member]').forEach(input=>input.value=state.rows.find(r=>r.id===input.dataset.ccMember)?.override||'inherit');
 if(lesson&&!(ctx.group&&state.real))el.insertAdjacentHTML('beforeend',lesson);
}
function ccRepairLegacySkip(){
 const ctx=ccContext(),d=ccDraft(ctx),date=ccSelected;
 if(!ctx?.group||!d||ccSaving||!ccLegacySkipMembers(ctx,d,date).length)return;
 const base=ccGroupBase(ctx,d,date);
 if(!Object.hasOwn(ccStatus,base.status)||base.status==='rescheduled'||base.skip)return;
 try{
  ccStageGroupDate(ctx,d,date,base.status,{},base.time||ccSchedule(d.schedule,date).time,base.notes||'',base.original||'');
  ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();
 }catch(error){alert(error.message);}
}
function ccStatusChange(){
 const status=document.getElementById('cc-status').value,move=document.getElementById('cc-reschedule');
 move.hidden=status!=='move';
 if(status==='move'){document.getElementById('cc-reschedule-date').focus();return;}

 if(ccApplyDay())ccEditor();
}
function ccApplyReschedule(){
 const ctx=ccContext(),d=ccDraft(ctx),input=document.getElementById('cc-reschedule-date'),to=input?.value;if(!d||ccSaving||!input)return false;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(to)||to<'1900-01-01'||!input.validity.valid){input.reportValidity();input.focus();return false;}
 try{ccReschedule(ctx,d,ccSelected,to,document.getElementById('cc-time').value,document.getElementById('cc-notes').value);ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();return true;}catch(e){alert(e.message);return false;}
}
function ccStageGroupDate(ctx,d,date,status,attendance,time,notes,original,individual=false){
 const previous=ccGroupBase(ctx,d,date),published=ctx.members.some(s=>ccRegistered(ctx,s.id,date));
 if(published&&ctx.lessons.some(l=>l.lesson_date===date&&l.group_id!==ctx.group.id))throw Error('Esta data contém aula individual cadastrada; não altere o registro pela turma.');
 if(published&&!individual)throw Error('A aula cadastrada está protegida. Ajuste apenas a frequência dos integrantes sem cadastro.');
 if(!published)ccCanEditDate(ctx,d,date);
 else if(ctx.members.some(s=>!ccRegistered(ctx,s.id,date)&&d.payloads[s.id].events[date]&&!ccLegacyGroupRow(ctx,d,s.id,date)))throw Error('Há um registro individual independente nesta data.');
 if(!Object.hasOwn(ccStatus,status)||status==='rescheduled')throw Error('Status coletivo inválido.');
 if(individual&&!['planned','done','absent','owed'].includes(previous.status))throw Error('Altere primeiro o status coletivo da aula.');
 if(status==='absent'&&previous.original)original=previous.original;
 const base=individual?{...previous}:{...previous,status,time,notes,original};delete base.skip;
 if(original){
  if(ccGroupBase(ctx,d,original).status==='absent'||!ctx.members.every(s=>d.payloads[s.id].events[original]?.group_id===ctx.group.id&&ccAbsent(d.payloads[s.id].events[original]?.status)&&ccReplacementAvailable(d.payloads[s.id],original,date,ccDraftReplacementLessons(ctx,d,s.id),true)))throw Error('A reposição exige falta de todos os integrantes e uma data disponível.');
  if(!ctx.members.every(s=>d.payloads[s.id].events[date]?.original===original)&&ccIsHabitual(d.schedule,date)&&!ctx.members.every(s=>d.payloads[s.id].events[date]?.skip))throw Error('Escolha uma data sem aula habitual para a reposição.');
 }
 const overrides={},effective={};
 for(const s of ctx.members){
  const old=ccLegacyGroupRow(ctx,d,s.id,date)||{},prior=ccGroupOverride(old,previous);
  const wanted=individual?(['done','absent','owed'].includes(attendance[s.id])?attendance[s.id]:undefined):(['planned','done'].includes(base.status)&&['planned','done'].includes(previous.status)?prior:undefined);
  overrides[s.id]=['planned','done','absent','owed'].includes(base.status)&&wanted?(ccAbsent(wanted)?'absent':wanted):undefined;
  effective[s.id]=ccRegistered(ctx,s.id,date)?'done':ccAttendanceStatus(base.status,overrides[s.id]);
  if(Object.entries(d.payloads[s.id].events).some(([rd,v])=>rd!==date&&v.original===date&&!v.skip)&&(base.status==='absent'||!ccAbsent(effective[s.id])))throw Error('Exclua a reposição vinculada antes de alterar a frequência original.');
 }
 const normalized=tgNormalizeAttendance(ctx.members.map(s=>s.id),effective,base.status!=='absent');
 if(original&&ctx.members.some(s=>d.payloads[s.id].events[date]?.rescheduled_from))throw Error('Uma aula reagendada não pode ser vinculada como reposição.');
 d.schedule.events[date]=ccSharedFields(base);
 for(const s of ctx.members){
  if(ccRegistered(ctx,s.id,date))continue;
  d.payloads[s.id].events[date]={...ccSharedFields(base),status:normalized[s.id],group_id:ctx.group.id,group_status:base.status,...(overrides[s.id]?{attendance_override:overrides[s.id]}:{})};
 }
}
function ccApplyDay(individual=false){
 const ctx=ccContext(),d=ccDraft(ctx),status=document.getElementById('cc-status')?.value;if(!d||(!status&&!individual)||status==='move'||ccSaving)return false;
 const date=ccSelected,time=document.getElementById('cc-time').value,notes=document.getElementById('cc-notes').value;
 let original=document.getElementById('cc-original').value;
 try{
  if(ctx.group){
   const attendance=Object.fromEntries([...document.querySelectorAll('[data-cc-member]')].map(input=>[input.dataset.ccMember,input.value]));
   ccStageGroupDate(ctx,d,date,status,attendance,time,notes,original,individual);
   ccMarkDirty(ctx,d);ccRefreshGrid();if(individual)ccEditor();return true;
  }
  ccCanEditDate(ctx,d,date);
  const id=ctx.members[0].id,x=d.payloads[id],old=x.events[date]||{};
  if(status==='absent'&&old.original)original=old.original;
  if(original){
   if(old.original!==original&&ccIsHabitual(x,date)&&!old.skip)throw Error('Escolha uma data sem aula habitual para a reposição.');
   if(!ccReplacementAvailable(x,original,date,ccDraftReplacementLessons(ctx,d,id)))throw Error('Esta reposição não está disponível.');
   if(old.rescheduled_from)throw Error('Uma aula reagendada não pode ser vinculada como reposição.');
  }
  if(Object.entries(x.events).some(([rd,v])=>rd!==date&&v.original===date&&!v.skip)&&!['owed','absent','teacher'].includes(status))throw Error('Exclua a reposição vinculada antes de alterar a frequência original.');
  x.events[date]={...old,status,original,time,notes};delete x.events[date].skip;
  ccMarkDirty(ctx,d);ccRefreshGrid();return true;
 }catch(e){alert(e.message);ccEditor();return false;}
}
function ccFinishInput(){if(document.getElementById('cc-status')?.value==='move'){alert('Confirme o reagendamento ou cancele antes de continuar.');return false;}return !document.getElementById('cc-plan')||ccStageConfig();}
function ccRemove(){const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!confirm('Excluir este registro do calendário? A alteração só será confirmada ao salvar.'))return;try{ccDeleteDate(ctx,d,ccSelected);ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();}catch(e){alert(e.message);}}
function ccJump(date){if(!ccFinishInput())return;const d=ccDraft();if(ccSelected!==date)d.editLessonDate='';ccSelected=date;ccDate=new Date(date+'T12:00:00');d.selected=date;d.date=ccDate;ccRender();}
function ccDiscard(){const ctx=ccContext(),d=ccDraft(ctx);if(!d||ccSaving||!confirm('Descartar todas as alterações ainda não salvas?'))return;if(typeof ccLessonMap==='function')ccLessonMap(ctx).clear();ccDrafts.delete(ctx.key);ccActiveKey='';ccRender();}
async function ccImportCompletions(){
 const ctx=ccContext(),d=ccDraft(ctx);if(!ctx||ccSaving)return;
 if(d?.dirty&&!confirm('Cancelar as alterações não salvas e recarregar os dados já salvos?'))return;
 try{await ccLoadCloud();await tgLoad();if(typeof ccLessonMap==='function')ccLessonMap(ctx).clear();if(!ctx.group)await loadLessonsFor(ctx.members[0].id);ccDrafts.delete(ctx.key);ccActiveKey='';if(ccContext()?.key===ctx.key)ccRender();}catch(e){alert('Não foi possível atualizar o calendário.');}
}
async function ccSaveAll(){
 const ctx=ccContext();let d=ccDraft(ctx);if(!d||ccSaving||!ccFinishInput()||!d.dirty)return;
 if([...ccDrafts.values()].some(other=>other.key!==ctx.key&&other.dirty&&ctx.members.some(s=>Object.hasOwn(other.payloads,s.id))))return alert('Há alterações pendentes em outro calendário relacionado. Descarte esse outro rascunho antes de salvar.');
 if(!ctx.members.every(s=>s.is_test_profile||ccCloudReady&&(ccCloud.get(s.id)?.revision||0)===d.revisions[s.id]))return alert('Calendário alterado em outro fluxo. Atualize do servidor antes de salvar.');
 // Preflight the dates touched by the draft against the current published lesson records.
 ccSaving=true;ccUpdateToolbar(d);
 try{
  if(typeof ccValidateLessonDrafts==='function'){ccValidateLessonDrafts(ctx,d);await ccCheckLessonSchema(ctx);}
  const deletions=typeof ccLessonDeletionEntries==='function'?ccLessonDeletionEntries(ctx):[];
  const moves=typeof ccLessonMoveEntries==='function'?ccLessonMoveEntries(ctx):[];
  const metadata=Object.values(d.registeredStatuses||{}).filter(e=>!deletions.some(x=>x.date===e.date));
  const removedDates=new Set([...deletions,...moves,...metadata].map(e=>e.date));
  if(moves.some(m=>metadata.some(e=>e.date===m.date)))throw Error('Salve a alteração de status antes de alterar a data desta mesma aula.');
  if(deletions.length)d=ccProjectLessonDeletions(ctx,d);
  if(moves.length)d=ccProjectLessonMoves(ctx,d);
  if(!ctx.members.every(s=>s.is_test_profile)){
   for(const member of ctx.members){
    const dates=Object.keys({...d.base[member.id].events,...d.payloads[member.id].events}).filter(date=>!removedDates.has(date)&&JSON.stringify(d.base[member.id].events[date])!==JSON.stringify(d.payloads[member.id].events[date]));
    for(let offset=0;offset<dates.length;offset+=80){
     const {data,error}=await sb.from('lessons').select('id,student_id,lesson_date').in('student_id',[member.id]).in('lesson_date',dates.slice(offset,offset+80)).limit(1);
     if(error)throw error;if(data?.length)throw Error('Uma aula cadastrada foi encontrada em '+formatDate(data[0].lesson_date)+'. Atualize o calendário antes de salvar.');
    }
   }
  }
  if(metadata.length){
   const x=d.schedule,schedule=ctx.group?{...ctx.group.schedule,start:x.start,end:x.end,days:x.weekdays,time:x.time,plan:x.plan,changes:x.changes,calendar_events:x.events}:null;
   const requests=[];
   for(const entry of moves){
    const rows=ccLessonRows(ctx,entry.date),targets=rows.map(l=>l.student_id);
    requests.push({date:entry.date,to:entry.newDate,ids:rows.map(l=>l.id),title:entry.automatic?null:entry.title,topic:entry.topic,materials:await ccPrepareLessonMaterials(ctx,entry,targets)});
   }
   const {data,error}=await sb.rpc('portal_calendar_save_registered_statuses',{p_group:ctx.group?.id||null,p_student:ctx.group?null:ctx.members[0].id,p_schedule:schedule,p_changes:ctx.members.map(s=>({id:s.id,payload:d.payloads[s.id],revision:d.revisions[s.id]})),p_metadata:metadata,p_moves:requests,p_deletions:deletions.map(e=>({date:e.date,ids:e.deleteIds}))});
   if(error)throw error;
   for(const entry of [...moves,...deletions])ccLessonMap(ctx).delete(entry.date);
   const moved=moves.find(e=>e.date===d.selected);if(moved){d.selected=moved.newDate;d.date=new Date(moved.newDate+'T12:00:00');}
   if(!ctx.group){const id=ctx.members[0].id;ccCloud.set(id,{calendar_key:id,payload:ccClone(d.payloads[id]),revision:data});}
  }else if(moves.length){
   const x=d.schedule,schedule=ctx.group?{...ctx.group.schedule,start:x.start,end:x.end,days:x.weekdays,time:x.time,plan:x.plan,changes:x.changes,calendar_events:x.events}:null;
   const requests=[];
   for(const entry of moves){
    const rows=ccLessonRows(ctx,entry.date),targets=rows.map(l=>l.student_id);
    requests.push({date:entry.date,to:entry.newDate,ids:rows.map(l=>l.id),title:entry.automatic?null:entry.title,topic:entry.topic,materials:await ccPrepareLessonMaterials(ctx,entry,targets)});
   }
   const {data,error}=await sb.rpc('portal_calendar_save_with_moves',{p_group:ctx.group?.id||null,p_student:ctx.group?null:ctx.members[0].id,p_schedule:schedule,p_changes:ctx.members.map(s=>({id:s.id,payload:d.payloads[s.id],revision:d.revisions[s.id]})),p_moves:requests,p_deletions:deletions.map(e=>({date:e.date,ids:e.deleteIds}))});
   if(error)throw error;
   for(const entry of [...moves,...deletions])ccLessonMap(ctx).delete(entry.date);
   const moved=moves.find(e=>e.date===d.selected);if(moved){d.selected=moved.newDate;d.date=new Date(moved.newDate+'T12:00:00');}
   if(!ctx.group){const id=ctx.members[0].id;ccCloud.set(id,{calendar_key:id,payload:ccClone(d.payloads[id]),revision:data});}
  }else if(deletions.length){
   const x=d.schedule,schedule=ctx.group?{...ctx.group.schedule,start:x.start,end:x.end,days:x.weekdays,time:x.time,plan:x.plan,changes:x.changes,calendar_events:x.events}:null;
   const {data,error}=await sb.rpc('portal_calendar_save_with_deletions',{p_group:ctx.group?.id||null,p_student:ctx.group?null:ctx.members[0].id,p_schedule:schedule,p_changes:ctx.members.map(s=>({id:s.id,payload:d.payloads[s.id],revision:d.revisions[s.id]})),p_deletions:deletions.map(e=>({date:e.date,ids:e.deleteIds}))});
   if(error)throw error;
   for(const entry of deletions)ccLessonMap(ctx).delete(entry.date);
   if(!ctx.group){const id=ctx.members[0].id;ccCloud.set(id,{calendar_key:id,payload:ccClone(d.payloads[id]),revision:data});}
  }else if(ctx.group){
   const x=d.schedule,schedule=JSON.stringify(x)===JSON.stringify(d.baseSchedule)?null:{...ctx.group.schedule,start:x.start,end:x.end,days:x.weekdays,time:x.time,plan:x.plan,changes:x.changes,calendar_events:x.events};
   const {error}=await sb.rpc('portal_group_calendar_save',{p_group:ctx.group.id,p_schedule:schedule,p_changes:ctx.members.map(s=>({id:s.id,payload:d.payloads[s.id],revision:d.revisions[s.id]}))});
   if(error)throw error;
  }else{
   const s=ctx.members[0],payload=d.payloads[s.id];
   if(s.is_test_profile)localStorage.setItem('dc-calendar-test:'+s.id,JSON.stringify(payload));
   else{const {data,error}=await sb.rpc('save_admin_calendar',{p_key:s.id,p_payload:payload,p_revision:d.revisions[s.id]});if(error)throw error;ccCloud.set(s.id,{calendar_key:s.id,payload:ccClone(payload),revision:data});}
  }
  // Once the RPC succeeds, the draft has been committed; do not retry on a refresh failure.
  ccDrafts.delete(ctx.key);ccActiveKey='';
  let lessonError=null;
  try{if(typeof ccFlushLessons==='function')await ccFlushLessons(ctx,d);}catch(e){lessonError=e;console.error(e);}
  try{if(ctx.group){await ccLoadCloud();await tgLoad();}else if(typeof ccFlushLessons==='function')await loadLessonsFor(ctx.members[0].id);}catch(e){ccCloudReady=false;alert('Calendário salvo, mas não foi possível atualizar a tela. Recarregue antes de editar novamente.');return;}
  if(ccContext()?.key===ctx.key){const fresh=ccDraft(ccContext());fresh.date=d.date;fresh.selected=d.selected;if(lessonError)fresh.dirty=true;ccRender();}
  if(lessonError)alert('Calendário salvo. Ainda há materiais/aulas no rascunho: '+lessonError.message+' Confira antes de tentar novamente.');
 }catch(e){console.error(e);alert('Não foi possível salvar. As alterações permanecem no rascunho. '+(e.message||''));}
 finally{ccSaving=false;const active=ccContext();if(active){const now=ccDraft(active);ccUpdateToolbar(now);}}
}
window.addEventListener('beforeunload',event=>{if([...ccDrafts.values()].some(d=>d.dirty)){event.preventDefault();event.returnValue='';}});
async function ccOpen(id){await openStudent(id);ccActiveKey='';ccSelected='';switchTab('calendario')}

function ccTarget(x,y){if(!x.plan||!x.start)return null;let total=0;for(let m=0;m<12;m++){let first=ccISO(y,m,1),last=ccISO(y,m,new Date(y,m+1,0).getDate());if(x.start>last||(x.end&&x.end<first))continue;let days=new Date(y,m+1,0).getDate(),a=x.start>first?Number(x.start.slice(-2)):1,b=x.end&&x.end<last?Number(x.end.slice(-2)):days;total+=Math.round(Number(x.plan)/12*(b-a+1)/days)}return Math.max(0,total-Object.entries(x.events).filter(([d,e])=>d.startsWith(y+'-')&&d>=x.start&&(!x.end||d<=x.end)&&e.status==='vacation'&&e.discounted!==false).length)}
function ccPending(x,byDate={}){return Object.entries(x.events).filter(([date,event])=>
 (!event.group_id||tgGroupReplacementEligible(event.group_id,date))&&ccReplacementDebt(x,date)&&
 !byDate[date]?.some(l=>!l.calendar_status||l.calendar_status==='done')&&
 !ccReplacementSettled(x,date,rd=>ccRegisteredClosed(byDate[rd]||[],rd))).length}
// Previsão nacional de 2027. Carnaval e Corpus Christi não são feriados nacionais.
const ccNationalHolidays2027=Object.freeze([
 ['2027-01-01','Confraternização Universal'],['2027-03-26','Sexta-feira Santa'],
 ['2027-04-21','Tiradentes'],['2027-05-01','Dia do Trabalho'],
 ['2027-09-07','Independência do Brasil'],['2027-10-12','Nossa Senhora Aparecida'],
 ['2027-11-02','Finados'],['2027-11-15','Proclamação da República'],
 ['2027-11-20','Consciência Negra'],['2027-12-25','Natal']
].map(([date,name])=>({start:date,end:date,status:'holiday',name,preset:true})));
function ccGlobalRaw(){return ccClone(ccCloud.get('global')?.payload||[]);}
function ccGlobal(){
 const raw=ccGlobalRaw(),active=raw.filter(e=>!e.disabled);
 return [...active,...ccNationalHolidays2027.filter(p=>!raw.some(e=>e.start<=p.start&&e.end>=p.start&&(e.disabled||e.status==='holiday')))].sort((a,b)=>a.start.localeCompare(b.start));
}
function ccGlobalEntry(d){const entries=ccGlobal().filter(e=>d>=e.start&&d<=e.end);return entries.find(e=>e.status==='holiday')||entries[0];}
function ccGlobalStatus(d){return ccGlobalEntry(d)?.status||'';}
function ccUnavailable(date,status){const entry=ccGlobalEntry(date);return entry?(entry.name||ccStatus[entry.status]):['holiday','break'].includes(status)?ccStatus[status]:'';}
function ccAgenda(today,completedIds=null,keepRecorded=false,registeredIds=completedIds,registeredLessons=[]){
 const date=today.date,global=ccGlobalStatus(date);
 return students.filter(s=>!s.is_test_profile).flatMap(s=>{
  const x=ccData(s),e=x.events[date];
  const registration=registeredLessons.find(l=>l.student_id===s.id&&l.lesson_date===date);
  const group=tgGroups.find(g=>g.id===(registration?.group_id||e?.group_id))||ccGroupForDate(s.id,date);
  const model=group?ccGroupSchedule(group):x,scheduled=ccSchedule(model,date);
  const habitual=ccIsHabitual(model,date),registered=completedIds?.has(s.id);
  const status=registration?registration.calendar_status||'done':registered?'done':e?.status||'planned';
  if(!registered&&(e?.skip||status==='rescheduled'))return [];
  if(!registration&&!registered&&!e&&!habitual)return [];
  if(!keepRecorded&&!['planned','done'].includes(status))return [];
  if(!registration&&!registered&&!e&&global)return [];
  return [{...s,lesson_time:(group?.calendar_events?.[date]?.time||e?.time||scheduled.time||ccSchedule(x,date).time||'').slice(0,5),ccType:e?.rescheduled_from?'Reagendamento · '+e.rescheduled_from.split('-').reverse().join('/'):e?.original?'Reposição · '+e.original.split('-').reverse().join('/'):habitual?'Regular':'Adicional',ccDate:date,ccStatus:status,ccRegistered:!!registeredIds?.has(s.id),ccGroupId:group?.id||null}];
 }).sort((a,b)=>(a.lesson_time||'99').localeCompare(b.lesson_time||'99'));
}
function crmGroupDailyAgenda(rows){
 const grouped=new Map();
 for(const row of rows){
  const key=row.ccGroupId?'group:'+row.ccGroupId+'|'+row.ccDate:'student:'+row.id+'|'+row.ccDate;
  if(!grouped.has(key))grouped.set(key,{...row,ccMembers:[row]});
  else grouped.get(key).ccMembers.push(row);
 }
 return [...grouped.values()].map(row=>{
  if(!row.ccGroupId)return row;
  const group=tgGroups.find(g=>g.id===row.ccGroupId),statuses=new Set(row.ccMembers.map(s=>s.ccStatus));
  return {...row,full_name:row.ccMembers.map(s=>s.full_name||s.email||'Aluno sem nome').join(' · '),lesson_time:(group?.calendar_events?.[row.ccDate]?.time||row.ccMembers.find(s=>s.lesson_time)?.lesson_time||'').slice(0,5),ccStatus:statuses.size>1?'mixed':row.ccStatus,ccRegistered:row.ccMembers.some(s=>s.ccRegistered)};
 }).sort((a,b)=>(a.lesson_time||'99').localeCompare(b.lesson_time||'99'));
}
function crmTodayStatus(row){return ccQuickStatus(row);}
function crmTodayActions(row){
 const members=row.ccMembers||[row],links=new Map();
 for(const member of members){const link=(member.permanent_lesson_link||'').trim();if(link&&!links.has(link))links.set(link,member);}
 const calls=links.size?[...links.values()]:[members[0]];
 return '<div class="crm-row-actions">'+calls.map(member=>'<button class="crm-icon-btn" title="'+ccEsc(calls.length>1?'Videochamada de '+(member.full_name||member.email||'Aluno'):'Videochamada')+'" onclick="openTodayClassCall(&quot;'+ccEsc(member.id)+'&quot;)">'+crmIcon('video')+'</button>').join('')+'<button class="crm-icon-btn" title="Calendário" onclick="'+(row.ccGroupId?'tgOpenDate':'ccOpenDate')+'(&quot;'+ccEsc(row.ccGroupId||row.id)+'&quot;,&quot;'+ccEsc(row.ccDate)+'&quot;)">'+crmIcon('calendar')+'</button></div>';
}

function crmStudentProfileLinks(row){
 const members=row.ccMembers||[row];
 return members.map(member=>'<a class="crm-student-link" href="?student='+encodeURIComponent(member.id)+'" data-student-id="'+ccEsc(member.id)+'" onclick="if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return true;openStudent(this.dataset.studentId);return false;">'+ccEsc(member.full_name||member.email||'Aluno sem nome')+'</a>').join(' · ');
}
function crmTodayRowsHtml(classes){
 return classes.map(row=>`<tr><td class="crm-time">${ccEsc(row.lesson_time.slice(0,5)||'—')}</td><td>${crmStudentProfileLinks(row)}</td><td><span class="crm-kind ${row.ccType.startsWith('Reposição')?'is-replacement':''}">${ccEsc(row.ccType)}</span></td><td>${crmTodayStatus(row)}</td><td>${crmTodayActions(row)}</td></tr>`).join('');
}
function ccQuickStatus(student){
 const status=student.ccStatus,group=student.ccGroupId;
 const options=Object.entries(ccStatus).filter(([k])=>k!=='rescheduled');
 if(status==='mixed')options.unshift(['mixed','Frequência mista']);
 const handler=group?'ccQuickGroupSave':'ccQuickSave';
 return '<select class="crm-quick-status" data-status="'+ccEsc(status)+'" aria-label="Status da aula de '+ccEsc(student.full_name||student.email||'Aluno')+'" '+(student.ccRegistered?'disabled title="Aula cadastrada: altere o status pelo calendário"':'onchange="'+handler+'(this,&quot;'+ccEsc(group||student.id)+'&quot;,&quot;'+ccEsc(student.ccDate)+'&quot;)"')+'>'+options.map(([k,v])=>'<option value="'+k+'" '+(k===status?'selected':'')+(k==='mixed'?' disabled':'')+'>'+ccEsc(group&&k==='owed'?'Falta de todos (com reposição)':v)+'</option>').join('')+'</select>'+(student.ccRegistered?'<small class="crm-muted" style="display:block">Via cadastro</small>':'');
}
async function ccQuickGroupSave(select,id,date){
 const status=select.value,previous=select.dataset.status;
 if(ccSaving||!Object.hasOwn(ccStatus,status)||status==='rescheduled'){select.value=previous;return;}
 if(!ccCloudReady){select.value=previous;return alert('Calendário indisponível. Recarregue a página antes de editar.');}
 const group=tgGroups.find(g=>g.id===id),members=group?.members.map(mid=>students.find(s=>s.id===mid&&!s.is_test_profile))||[];
 if(!group||!members.length||members.some(s=>!s)){select.value=previous;return alert('A turma foi alterada. Reabra a Home antes de tentar novamente.');}
 if(members.some(s=>ccHasDirtyForMember(s.id))){select.value=previous;return alert('Salve ou descarte as alterações pendentes nos calendários da turma antes de alterar o status.');}
 ccSaving=true;select.disabled=true;
 let committed=false,refreshFailed=false;
 try{
  // Use a fresh isolated draft and the same staging rules as the collective calendar.
  const ctx={key:'group:'+id,group,members,lessons:group.calendarLessons||[]};
  const d={payloads:Object.fromEntries(members.map(s=>[s.id,ccData(s)])),schedule:ccGroupSchedule(group),revisions:Object.fromEntries(members.map(s=>[s.id,ccCloud.get(s.id)?.revision||0]))};
  const {data,error}=await sb.from('lessons').select('id').in('student_id',group.members).eq('lesson_date',date).limit(1);
  if(error)throw error;
  if(data?.length)throw Error('Esta aula já tem cadastro. Altere o status pelo calendário da turma.');
  const base=ccGroupBase(ctx,d,date);
  if(base.skip||base.status==='rescheduled')throw Error('A aula foi excluída ou reagendada. Atualize a agenda.');
  ccStageGroupDate(ctx,d,date,status,{},base.time||ccSchedule(d.schedule,date).time,base.notes||'',base.original||'');
  const x=d.schedule,p_schedule={...group.schedule,start:x.start,end:x.end,days:x.weekdays,time:x.time,plan:x.plan,changes:x.changes,calendar_events:x.events};
  const result=await sb.rpc('portal_group_calendar_save',{p_group:id,p_schedule,p_changes:members.map(s=>({id:s.id,payload:d.payloads[s.id],revision:d.revisions[s.id]}))});
  if(result.error)throw result.error;
  committed=true;
  // Invalidate old clean drafts; reload only after the atomic save succeeds.
  ccDrafts.delete(ctx.key);
  try{await ccLoadCloud();await tgLoad();}catch(error){console.error(error);ccCloudReady=false;refreshFailed=true;}
 }catch(error){console.error(error);select.value=previous;alert('Não foi possível salvar o status coletivo. '+(error.message||'Tente novamente.'));}
 finally{ccSaving=false;if(select.isConnected){select.disabled=refreshFailed;if(!committed)select.value=previous;}}
 if(committed&&refreshFailed){alert('Status coletivo salvo. Recarregue a página para consultar o calendário atualizado.');return;}
 if(committed&&currentView==='home')await renderHome();
}
async function ccQuickSave(select,id,date){const s=students.find(v=>v.id===id),status=select.value,previous=select.dataset.status;if(!s||!Object.hasOwn(ccStatus,status)||status==='rescheduled')return;select.disabled=true;try{const {data,error}=await sb.from('lessons').select('id').eq('student_id',id).eq('lesson_date',date).limit(1);if(error)throw error;if(data?.length){select.value=previous;select.dataset.status=previous;select.title='Aula cadastrada: altere o status pelo calendário';alert('Altere o status desta aula cadastrada pelo calendário.');if(currentView==='home')await renderHome();return;}if(ccHasDirtyForMember(id)){select.value=previous;return alert('Salve as alterações pendentes no calendário individual.');}const x=ccData(s);if(ccGroupForDate(id,date)){select.value=previous;return alert('Registre a frequência da turma pelo módulo Turmas.');}x.events[date]={...(x.events[date]||{}),status};if(!await ccWrite(id,x)){select.value=previous;return;}select.dataset.status=status;const feedback=document.getElementById('crm-agenda-feedback');if(feedback)feedback.textContent='Status salvo no calendário de '+(s.full_name||s.email)+'.';const other=document.getElementById('crm-other-pending');if(other)other.innerHTML=crmOtherPending();const count=document.getElementById('crm-replacement-stat');if(count)count.textContent=students.filter(v=>!v.is_test_profile).reduce((a,v)=>a+ccPending(ccData(v)),0);if(currentView==='home')await renderHome();}catch(error){console.error(error);select.value=previous;alert('Não foi possível salvar o status. Tente novamente.');}finally{if(select.isConnected)select.disabled=false}}
async function ccOpenDate(id,date){await openStudent(id);ccDate=new Date(date+'T12:00:00');ccSelected=date;const existing=ccDrafts.get('student:'+id);if(existing){existing.date=ccDate;existing.selected=date;}ccActiveKey='';switchTab('calendario')}
function ccGlobalView(){currentView='agenda';currentStudent=null;renderNav();let root=document.getElementById('main-content');root.innerHTML='<div class="topline"><h1>Agenda</h1></div><div class="box"><h3>Feriados e recessos</h3><div class="row"><label>Início<input type="date" id="cg-start"></label><label>Fim<input type="date" id="cg-end"></label><label>Tipo<select id="cg-type"><option value="holiday">Feriado</option><option value="break">Recesso</option></select></label><button class="btn-dark-sm" onclick="ccGlobalSave()">Adicionar</button></div>'+ccGlobal().map((e,i)=>'<p>'+ccEsc(e.start)+' a '+ccEsc(e.end)+' · '+ccEsc(ccStatus[e.status])+(e.name?' · '+ccEsc(e.name):'')+' <button class="btn-ghost" onclick="ccGlobalRemove('+i+')">Excluir</button></p>').join('')+'</div><div class="box"><h3>Agenda de hoje</h3>'+crmGroupDailyAgenda(ccAgenda(adminToday())).map(s=>'<p>'+ccEsc(s.lesson_time.slice(0,5)||'Sem horário')+' · '+crmStudentProfileLinks(s)+' · '+ccEsc(s.ccType)+' <button class="btn-ghost" onclick="'+(s.ccGroupId?'tgOpenDate':'ccOpenDate')+'(&quot;'+ccEsc(s.ccGroupId||s.id)+'&quot;,&quot;'+s.ccDate+'&quot;)">Calendário</button></p>').join('')+'</div>'}
async function ccGlobalSave(){let a=document.getElementById('cg-start').value,b=document.getElementById('cg-end').value||a;if(!a||b<a)return alert('Informe um período válido.');if(await ccSaveCloud('global',[...ccGlobalRaw(),{start:a,end:b,status:document.getElementById('cg-type').value}]))ccGlobalView()}
async function ccGlobalRemove(i){const selected=ccGlobal()[i];if(!selected)return;let a=ccGlobalRaw();if(selected.preset)a.push({...selected,disabled:true});else {const index=a.findIndex(e=>JSON.stringify(e)===JSON.stringify(selected));if(index>=0)a.splice(index,1);}if(await ccSaveCloud('global',a))ccGlobalView()}
function ccRoster(){let root=document.getElementById('main-content');currentStudent=null;currentView='alunos';renderNav();root.innerHTML='<div class="topline"><h1>Alunos</h1></div><div class="box"><div class="row"><input id="crm-search" placeholder="Buscar aluno" oninput="ccRosterRows()"><select id="crm-filter" onchange="ccRosterRows()"><option value="">Todos os planos</option><option value="48">Essencial</option><option value="96">Intensivo</option><option value="pending">Com reposições</option><option value="inbox">Com envios pendentes</option></select></div><div id="crm-roster"></div></div>';ccRosterRows()}
async function ccRosterRows(){let el=document.getElementById('crm-roster');if(!el)return;let q=document.getElementById('crm-search').value.toLowerCase(),f=document.getElementById('crm-filter').value;let list=students.filter(s=>!s.is_test_profile&&String(s.full_name||s.email).toLowerCase().includes(q));el.innerHTML='<p>Carregando...</p>';let {data,error}=await sb.from('lessons').select('id,student_id,lesson_date').gte('lesson_date',adminToday().date.slice(0,4)+'-01-01').lte('lesson_date',adminToday().date.slice(0,4)+'-12-31');if(!el.isConnected)return;let rows=list.map(s=>{let x=ccData(s),l=(data||[]).filter(v=>v.student_id===s.id),by={};l.forEach(v=>by[v.lesson_date]=[v]);return {s,x,l,p:ccPending(x,by)}}).filter(r=>!f||(f==='pending'?r.p>0:f==='inbox'?crmInboxCount(r.s.id)>0:r.x.plan===f));el.innerHTML=(error?'<p>Não foi possível consultar aulas.</p>':'')+'<div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Aluno</th><th>Plano</th><th>Horário</th><th>Aulas cadastradas / meta</th><th>Reposições</th><th>Notificações</th><th>Ações</th></tr></thead><tbody>'+rows.map(({s,x,l,p})=>'<tr><td><button type="button" class="crm-student-name" style="background:none;border:0;padding:0;color:var(--crm-blue);font:inherit;font-weight:600;text-align:left;text-decoration:underline;text-underline-offset:3px;cursor:pointer" onclick="openStudent(&quot;'+ccEsc(s.id)+'&quot;)">'+ccEsc(s.full_name||s.email)+'</button></td><td>'+ (x.plan==='48'?'Essencial':x.plan==='96'?'Intensivo':'Não definido')+'</td><td>'+ccEsc((s.lesson_time||'').slice(0,5))+'</td><td>'+(error?'—':l.length)+' / '+(ccTarget(x,Number(adminToday().date.slice(0,4)))??'—')+'</td><td>'+p+'</td><td><button class="crm-icon-btn" title="Consultar envios e dúvidas" onclick="openStudent(&quot;'+s.id+'&quot;)">'+crmIcon('bell')+'<span data-crm-inbox="'+ccEsc(s.id)+'">'+crmCountBadge(crmInboxCount(s.id),'Envios e dúvidas')+'</span></button></td><td><button class="btn-ghost" onclick="ccOpen(&quot;'+s.id+'&quot;)">Calendário</button></td></tr>').join('')+'</tbody></table></div>'}

function crmIcon(name){const paths={dashboard:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',chart:'<path d="M3 3v18h18M8 16v-4m5 4V8m5 8V5"/>',book:'<path d="M12 7c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V5c-3-1-7-1-10 2v15"/>',message:'<path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z"/>',megaphone:'<path d="M3 10v4h4l4 7h3l-3-7 10 4V6l-14 4Z"/>',graduation:'<path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6"/>',external:'<path d="M13 5h6v6m0-6-9 9M19 13v6H5V5h6"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m12 2 2 4 4-1 1 4 3 3-3 3-1 4-4-1-2 4-2-4-4 1-1-4-3-3 3-3 1-4 4 1Z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',refresh:'<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5m-3 9a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',file:'<path d="M6 2h8l4 4v16H6ZM14 2v5h4M9 12h6m-6 4h6"/>',video:'<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-4v12l-6-4"/>',plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>'};return '<svg class="crm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.calendar)+'</svg>'}
function crmKpi(label,value,icon,id){return '<div class="crm-kpi"><div><span>'+ccEsc(label)+'</span>'+crmIcon(icon)+'</div><strong '+(id?'id="'+id+'"':'')+'>'+ccEsc(value)+'</strong></div>'}
function crmPlan(x){return x.plan==='48'?'Essencial':x.plan==='96'?'Intensivo':'Plano não definido'}
function crmStudentMetrics(s,lessons){const x=ccData(s),y=Number(adminToday().date.slice(0,4)),prefix=y+'-',by={};lessons.filter(l=>l.lesson_date).forEach(l=>(by[l.lesson_date]??=[]).push(l));const rows=Object.entries(x.events),used=new Set(rows.filter(([d,e])=>e.original&&!e.skip&&(['done','absent'].includes(e.status)||ccRegisteredClosed(by[d]||[],d))).map(([d,e])=>e.original));const real=lessons.filter(l=>l.lesson_date?.startsWith(prefix)&&(!l.calendar_status||l.calendar_status==='done')).length+rows.filter(([d,e])=>d.startsWith(prefix)&&e.status==='done'&&!by[d]).length;const absent=rows.filter(([d,e])=>d.startsWith(prefix)&&e.status==='absent'&&!by[d]?.some(l=>!l.calendar_status||l.calendar_status==='done')&&!used.has(d)).length;const missed=rows.filter(([d,e])=>d.startsWith(prefix)&&['owed','absent'].includes(e.status)&&!by[d]?.some(l=>!l.calendar_status||l.calendar_status==='done')).length;return {count:real+absent,target:ccTarget(x,y),pending:ccPending(x,by),frequency:real+missed?Math.round(real/(real+missed)*100)+'%':'—'}}
function crmDismissed(id,key){return !!ccRead(id).dismissedAlerts?.[key];}
async function crmDismissAlert(id,key){
 if(!confirm('Descartar somente este aviso? O registro original será preservado.'))return;
 const payload=ccRead(id);payload.dismissedAlerts={...payload.dismissedAlerts,[key]:true};
 if(await ccWrite(id,payload)&&currentView==='home')await renderHome();
}
function crmDismissButton(id,key){return '<button class="resource-action" onclick="crmDismissAlert(&quot;'+ccEsc(id)+'&quot;,&quot;'+ccEsc(key)+'&quot;)">Descartar pendência</button>';}
function crmPendingActions(primary,dismiss){
 return '<div class="crm-pending-actions">'+(primary||'<span aria-hidden="true"></span>')+dismiss+'</div>';
}
function crmPendingMember(name,primary,dismiss){
 return '<div class="crm-pending-member"><span class="crm-pending-member-name">'+ccEsc(name)+'</span>'+crmPendingActions(primary,dismiss)+'</div>';
}
function crmPendingRow(icon,title,detail,actions='',members=''){
 return '<div class="crm-pending-row">'+crmIcon(icon)+'<div class="crm-pending-text"><div class="crm-pending-header"><div class="crm-pending-label"><strong>'+ccEsc(title)+'</strong><small>'+ccEsc(detail)+'</small></div>'+actions+'</div>'+members+'</div></div>';
}
function crmOtherPending(){
 const singles=students.filter(s=>!s.is_test_profile).map(s=>{
 const inbox=crmInboxFor(s.id),x=ccData(s),entries=Object.entries(x.events);
 const labels={questions:'Pergunta pendente',materials:'Material do Aluno',texts:'Texto para correção'};
 const tabs={questions:'duvidas',materials:'pedidos',texts:'textos-aluno'};
 const row=(icon,label,key,action)=>crmPendingRow(icon,s.full_name||s.email,label,crmPendingActions('<button class="btn-ghost" onclick="'+ccEsc(action)+'">Abrir</button>',crmDismissButton(s.id,key)));
 const messages=Object.entries(labels).flatMap(([kind,label])=>(inbox[kind]||[]).filter(id=>!crmDismissed(s.id,kind+':'+id)).map(id=>row('message',label,kind+':'+id,"crmOpenInbox('"+s.id+"','"+tabs[kind]+"')")));
 const replacements=entries.filter(([d,e])=>!e.group_id&&!crmRegisteredDates.has(s.id+'|'+d)&&ccReplacementDebt(x,d)&&!ccReplacementSettled(x,d,rd=>crmRegisteredDates.has(s.id+'|'+rd))&&!crmDismissed(s.id,'replacement:'+d)).map(([d])=>row('refresh','Reposição pendente · '+formatDate(d),'replacement:'+d,"ccOpenDate('"+s.id+"','"+d+"')"));
 return [...messages,...replacements].join('');
 }).join('');
 return singles+tgGroupReplacementRows().filter(r=>r.visible.length).map(({g,date,visible})=>crmPendingRow('refresh',g.name,'Reposição coletiva · '+formatDate(date),'',visible.map(id=>crmPendingMember(students.find(s=>s.id===id)?.full_name||'Aluno','',crmDismissButton(id,'replacement:'+date))).join('')+'<div class="crm-pending-group-action"><button class="btn-ghost" onclick="tgOpenReplacement(&quot;'+ccEsc(g.id)+'&quot;,&quot;'+ccEsc(date)+'&quot;)">Agendar ou concluir reposição</button></div>')).join('');
}
async function crmOpenInbox(id,tab){await openStudent(id);switchTab(tab);}

function crmStudentHistory(student,lessons){let x=ccData(student),by={};lessons.filter(l=>l.lesson_date).forEach(l=>(by[l.lesson_date]??=[]).push(l));return [...lessons.filter(l=>l.lesson_date).map(l=>({date:l.lesson_date,title:l.title,status:ccStatus[l.calendar_status]||'Realizada'})),...Object.entries(x.events).filter(([d,e])=>!by[d]&&e.status&&!e.skip&&e.status!=='planned').map(([date,e])=>({date,title:e.notes||'',status:ccStatus[e.status]}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);}
function crmStudentSummary(){const history=crmStudentHistory(currentStudent,currentLessons);document.getElementById('tab-content').innerHTML='<section class="crm-panel"><div class="crm-panel-head"><h3>Caixa de entrada do aluno</h3></div><div class="crm-quick crm-inbox-quick">'+[['file','Material do Aluno','pedidos','materials'],['message','Dúvidas a responder','duvidas','questions'],['file','Textos a corrigir','textos-aluno','texts']].map(([icon,label,tab,kind])=>'<button onclick="switchTab(&quot;'+tab+'&quot;)">'+crmIcon(icon)+label+'<span data-crm-inbox="'+ccEsc(currentStudent.id)+'" data-crm-kind="'+kind+'">'+crmCountBadge(crmInboxFor(currentStudent.id)[kind].length,label)+'</span></button>').join('')+'</div>'+(crmInboxError?'<p class="small-note">Alguns contadores estão indisponíveis.</p>':'')+'</section><section class="crm-panel"><div class="crm-panel-head"><h3>Ações rápidas</h3></div><div class="crm-quick">'+[['plus','Cadastrar aula',"switchTab(\'nova\')"],['calendar','Agendar reposição',"ccOpenDate(currentStudent.id,adminToday().date)"],['calendar','Registrar falta',"ccOpenDate(currentStudent.id,adminToday().date)"],['video','Abrir videochamada','openTodayClassCall(currentStudent.id)']].map(([icon,label,action])=>'<button onclick="'+ccEsc(action)+'">'+crmIcon(icon)+label+'</button>').join('')+'</div></section><section class="crm-panel"><div class="crm-panel-head"><h3>Histórico recente</h3><button class="crm-link" onclick="switchTab(&quot;calendario&quot;)">Ver calendário →</button></div>'+history.map(h=>'<div class="crm-history"><time>'+ccEsc(h.date.split('-').reverse().join('/'))+'</time><i class="'+(h.status==='Realizada'?'is-done':'')+'"></i><div><strong>'+ccEsc(h.status)+'</strong><small>'+ccEsc(h.title)+'</small></div></div>').join('')+(history.length?'':'<p class="crm-empty">Nenhuma aula registrada.</p>')+'</section>'}
