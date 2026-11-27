/* Teacher-only weekly planning. Never creates a lesson or student-visible resource. */
const crmPlanBucket='lesson-planning';
const crmPlanTable='portal_lesson_plans';
function crmPlanShift(date,days){
 const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function crmPlanWindow(today){return {start:today,end:crmPlanShift(today,6)};}
function crmPlanKey(p){return [p.subject_type,p.subject_id,p.lesson_date].join('|');}
function crmPlanDate(date){return date.split('-').reverse().join('/');}
function crmPlanSubject(p){
 if(p.subject_type==='group'){
  const group=tgGroups.find(g=>g.id===p.subject_id);
  return group?.name||group?.members.map(id=>students.find(s=>s.id===id)?.full_name).filter(Boolean).join(' · ')||'Turma não disponível';
 }
 const s=students.find(s=>s.id===p.subject_id);return s?.full_name||s?.email||'Aluno não disponível';
}
function crmPlanEntries(start,lessons,plans){
 const all=new Map(),saved=new Map(plans.map(p=>[crmPlanKey(p),p]));
 for(let i=0;i<7;i++){
  const date=crmPlanShift(start,i),registered=lessons.filter(l=>l.lesson_date===date);
  const ids=new Set(registered.map(l=>l.student_id)),completed=new Set(registered.filter(l=>!l.calendar_status||l.calendar_status==='done').map(l=>l.student_id));
  const rows=crmGroupDailyAgenda(ccAgenda({date},completed,true,ids,registered));
  for(const row of rows){
   // Past completed sessions are available for consultation; absences and cancelled dates are excluded.
   if(!(row.ccMembers||[row]).some(m=>['planned','done'].includes(m.ccStatus)))continue;
   const subject={subject_type:row.ccGroupId?'group':'student',subject_id:row.ccGroupId||row.id,lesson_date:date};
   const key=crmPlanKey(subject);
   all.set(key,{...subject,name:crmPlanSubject(subject),time:row.lesson_time,scheduled:true,registered:row.ccRegistered,plan:saved.get(key)||null});
  }
 }
 // Do not lose the draft if the corresponding class is cancelled or moved.
 for(const plan of plans){
  if(plan.lesson_date<start||plan.lesson_date>crmPlanShift(start,6))continue;
  const key=crmPlanKey(plan);
  if(!all.has(key))all.set(key,{subject_type:plan.subject_type,subject_id:plan.subject_id,lesson_date:plan.lesson_date,name:crmPlanSubject(plan),time:'',scheduled:false,registered:false,plan});
 }
 return [...all.values()].sort((a,b)=>a.lesson_date.localeCompare(b.lesson_date)||(a.time||'99:99').localeCompare(b.time||'99:99')||a.name.localeCompare(b.name,'pt-BR'));
}
async function crmPlanFetchLessons(start){
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await sb.from('lessons').select('id,student_id,lesson_date,group_id,calendar_status').gte('lesson_date',start).lte('lesson_date',crmPlanShift(start,6)).order('id').range(offset,offset+499);
  if(error)throw error;
  rows.push(...(data||[]));if((data||[]).length<500)return rows;
 }
}
function crmPlanDatabase(){
 const table=()=>sb.from(crmPlanTable),bucket=()=>sb.storage.from(crmPlanBucket);
 const queryKey=(q,p)=>q.eq('subject_type',p.subject_type).eq('subject_id',p.subject_id).eq('lesson_date',p.lesson_date);
 const unwrap=({data,error})=>{if(error)throw error;return data;};
 return {
  async list(start){
   const result=[];
   for(let offset=0;;offset+=500){
    const rows=unwrap(await table().select('*').gte('lesson_date',start).lte('lesson_date',crmPlanShift(start,6)).order('lesson_date').order('subject_type').order('subject_id').range(offset,offset+499))||[];
    result.push(...rows);if(rows.length<500)return result;
   }
  },
  async get(p){return unwrap(await queryKey(table().select('*'),p).maybeSingle());},
  async save(p,previous){
   // Compare-and-swap so another tab cannot silently overwrite a prepared week.
   if(previous){const row=unwrap(await queryKey(table().update({...p,revision:previous.revision+1,updated_at:new Date().toISOString()}),previous).eq('revision',previous.revision).select().maybeSingle());if(!row)throw Error('O planejamento mudou em outra sessão. Reabra a semana antes de salvar.');return row;}
   return unwrap(await table().insert({...p,revision:1}).select().single());
  },
  async remove(p){const row=unwrap(await queryKey(table().delete(),p).eq('revision',p.revision).select().maybeSingle());if(!row)throw Error('O planejamento mudou em outra sessão. Reabra a semana.');},
  async upload(path,file){unwrap(await bucket().upload(path,file,{upsert:false}));},
  async download(path){return unwrap(await bucket().download(path));},
  async deleteFiles(paths){if(paths.length)unwrap(await bucket().remove(paths));}
 };
}
function crmPlanFilePath(p){return p.subject_type+'/'+p.subject_id+'/'+p.lesson_date+'/'+crypto.randomUUID();}
function crmPlanFileMeta(p,file){return {path:crmPlanFilePath(p),name:file.name,size:file.size,type:inferQuickResourceType(file.name),mime:file.type||''};}
function crmPlanValidFile(f){return f.size>0&&f.size<=52428800;}
function crmPlanTypes(){return {ppt:'Slides',ex:'Exercícios',rep:'Relatório de desempenho',pdf:'PDF'};}
function crmPlanEscape(value){return escapeHtml(String(value??''));}
function crmPlanState(p){return p?.ready?'Preparada':p?.topic||p?.notes||p?.files?.length?'Em preparação':'A preparar';}
function crmPlanRowsHtml(entries){
 if(!entries.length)return '<p class="crm-empty">Nenhuma aula prevista nesta semana.</p>';
 let last='';
 return entries.map((entry,i)=>{
  const {plan}=entry,day=entry.lesson_date,heading=day!==last?'<div class="crm-plan-day">'+crmPlanEscape(new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')))+'</div>':'';last=day;
  const state=crmPlanState(plan);
  return heading+'<div class="crm-plan-row"><div class="crm-plan-info"><strong>'+crmPlanEscape(entry.time?entry.time+' · ':'')+crmPlanEscape(entry.name)+'</strong><small>'+crmPlanEscape(plan?.topic||'Tema a definir')+(plan?.files?.length?' · '+plan.files.length+' arquivo(s)':'')+'</small>'+(!entry.scheduled?'<small class="crm-plan-warning">Fora da agenda atual — planejamento mantido.</small>':entry.registered?'<small>Aula cadastrada</small>':'')+'</div><span class="crm-plan-state'+(plan?.ready?' is-ready':'')+'">'+state+'</span><button type="button" class="btn-ghost" data-plan-edit="'+i+'">'+(plan?'Editar':'Preparar')+'</button></div>';
 }).join('');
}
function crmPlanDownload(blob,name){
 const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function crmMountWeeklyPlanning(panel,groupsReady=Promise.resolve(),repo=crmPlanDatabase(),fetchLessons=crmPlanFetchLessons,today=adminToday().date,openCalendar=(p)=>p.subject_type==='group'?tgOpenDate(p.subject_id,p.lesson_date):ccOpenDate(p.subject_id,p.lesson_date)){
 if(!panel)return;
 let start=crmPlanWindow(today).start,request=0,entries=[],edit=null,busy=false,dirty=false,loading=false;
 panel.innerHTML='<div class="crm-panel-head"><h3>Planejamento semanal</h3><span class="crm-plan-private">Privado</span></div><p class="crm-muted crm-plan-description">Hoje e os próximos 6 dias. Prepare temas e materiais sem publicar para os alunos.</p><div class="crm-plan-nav"><strong class="crm-plan-range" aria-live="polite"></strong><button type="button" class="crm-link" data-plan-refresh>Atualizar</button></div><div class="crm-plan-progress"></div><div class="crm-plan-feedback crm-muted" role="status"></div><div class="crm-plan-list"></div><div class="crm-plan-editor"></div>';
 const find=s=>panel.querySelector(s),list=find('.crm-plan-list'),editor=find('.crm-plan-editor'),feedback=find('.crm-plan-feedback');
 function notice(message){feedback.textContent=message;}
 function controls(){panel.querySelectorAll('button,input,textarea,select').forEach(el=>{el.disabled=busy;});if(loading)panel.querySelectorAll('[data-plan-edit]').forEach(el=>el.disabled=true);}
 function draw(){
  list.innerHTML=crmPlanRowsHtml(entries);
  const scheduled=entries.filter(p=>p.scheduled&&!p.registered),ready=scheduled.filter(p=>p.plan?.ready).length;
  find('.crm-plan-progress').textContent=ready+' de '+scheduled.length+' aulas preparadas';
  list.querySelectorAll('[data-plan-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(Number(b.dataset.planEdit))));
 }
 function clearEditor(){edit=null;dirty=false;editor.innerHTML='';}
 function canLeave(){return !busy&&(!dirty||confirm('Descartar as alterações ainda não salvas neste planejamento?'));}
 async function load(){
  const token=++request,week=start;loading=true;clearEditor();entries=[];list.innerHTML='';find('.crm-plan-progress').textContent='';
  find('.crm-plan-range').textContent=crmPlanDate(week)+' – '+crmPlanDate(crmPlanShift(week,6));notice('Carregando semana...');
  try{
   await groupsReady;if(!ccCloudReady)throw Error('Calendário indisponível');
   const [lessons,plans]=await Promise.all([fetchLessons(week),repo.list(week)]);
   if(token!==request||!panel.isConnected)return;
   entries=crmPlanEntries(week,lessons,plans);draw();notice('');
  }catch(error){if(token===request&&panel.isConnected){console.error('Planejamento semanal:',error);notice('Não foi possível carregar o planejamento. Tente atualizar a semana.');}}
  finally{if(token===request){loading=false;controls();}}
 }
 function drawFiles(){
  if(!edit)return;
  const target=editor.querySelector('.crm-plan-files');
  target.innerHTML=edit.files.length?edit.files.map((f,i)=>'<div class="crm-plan-file"><div><strong>'+crmPlanEscape(f.name)+'</strong><small>'+crmPlanEscape(f.local?'A salvar':'Arquivo privado')+'</small></div><select aria-label="Tipo de material" data-type="'+i+'">'+Object.entries(crmPlanTypes()).map(([type,label])=>'<option value="'+type+'" '+(type===f.type?'selected':'')+'>'+label+'</option>').join('')+'</select><button type="button" class="resource-action" data-download="'+i+'">Baixar</button><button type="button" class="resource-action cc-danger-action" data-remove="'+i+'">Remover</button></div>').join(''):'<p class="crm-muted">Nenhum arquivo anexado.</p>';
  target.querySelectorAll('[data-type]').forEach(el=>el.addEventListener('change',()=>{if(busy)return;edit.files[Number(el.dataset.type)].type=el.value;dirty=true;}));
  target.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;edit.files.splice(Number(b.dataset.remove),1);dirty=true;drawFiles();}));
  target.querySelectorAll('[data-download]').forEach(b=>b.addEventListener('click',async()=>{const f=edit.files[Number(b.dataset.download)];try{crmPlanDownload(f.local||await repo.download(f.path),f.name);}catch(error){notice('Não foi possível baixar o arquivo.');}}));
 }
 function addFiles(files){
  if(busy||!edit)return;
  let rejected=false;
  for(const file of files||[]){
   if(!crmPlanValidFile(file)||edit.files.length>=30){rejected=true;continue;}
   if(edit.files.some(f=>f.name===file.name&&f.size===file.size))continue;
   edit.files.push({...crmPlanFileMeta(edit.entry,file),local:file});dirty=true;
  }
  drawFiles();notice(rejected?'Alguns arquivos não foram adicionados: máximo de 50 MB por arquivo e 30 por aula.':'');
 }
 function openEditor(index){
  if(loading||!canLeave())return;
  const entry=entries[index];if(!entry)return;
  const p=entry.plan;edit={entry,previous:p,topic:p?.topic||'',notes:p?.notes||'',ready:!!p?.ready,files:(p?.files||[]).map(f=>({...f}))};dirty=false;notice('');
  editor.innerHTML='<form class="crm-plan-form"><div class="crm-panel-head"><h4>'+crmPlanEscape(entry.name)+' · '+crmPlanDate(entry.lesson_date)+'</h4><button type="button" class="crm-link" data-close>Fechar</button></div><label>Tema da aula<input name="topic" maxlength="300" placeholder="Ex.: Managing different personalities"></label><label>Anotações do professor<textarea name="notes" maxlength="4000" rows="2" placeholder="Vocabulário, atividades, links ou objetivos"></textarea></label><div class="cc-material-drop crm-plan-drop"><strong>Arraste os materiais aqui</strong><p class="small-note">Slides, exercícios e outros arquivos ficam privados.</p><input type="file" name="files" multiple hidden><button type="button" class="btn-ghost" data-attach>+ Adicionar arquivos</button></div><div class="crm-plan-files"></div><label class="cc-lesson-number-toggle"><input type="checkbox" name="ready"><span>Marcar como preparada</span></label><div class="crm-plan-actions"><button type="submit" class="btn-dark-sm">Salvar planejamento</button><button type="button" class="btn-ghost" data-calendar>Abrir calendário</button>'+(p?'<button type="button" class="resource-action cc-danger-action" data-delete>Excluir planejamento</button>':'')+'</div></form>';
  const form=editor.querySelector('form'),topic=form.elements.topic,notes=form.elements.notes,ready=form.elements.ready,input=form.elements.files,drop=form.querySelector('.crm-plan-drop');
  topic.value=edit.topic;notes.value=edit.notes;ready.checked=edit.ready;
  form.addEventListener('input',()=>{edit.topic=topic.value;edit.notes=notes.value;edit.ready=ready.checked;dirty=true;});
  form.querySelector('[data-close]').addEventListener('click',()=>{if(canLeave())clearEditor();});
  form.querySelector('[data-calendar]').addEventListener('click',()=>{if(canLeave())openCalendar(entry);});
  form.querySelector('[data-attach]').addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{addFiles(input.files);input.value='';});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('is-dragging');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('is-dragging'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-dragging');addFiles(e.dataTransfer.files);});
  form.addEventListener('submit',e=>{e.preventDefault();save();});
  form.querySelector('[data-delete]')?.addEventListener('click',remove);
  drawFiles();editor.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 async function save(){
  if(busy||!edit)return;
  const current=edit,prev=current.previous;
  if(current.ready&&!current.topic.trim()){notice('Defina o tema antes de marcar a aula como preparada.');return;}
  busy=true;controls();notice('Salvando planejamento...');
  try{
   // Keep successfully uploaded objects for retry if the metadata write fails/has an uncertain outcome.
   for(const f of current.files){if(f.local&&!f.uploaded){await repo.upload(f.path,f.local);f.uploaded=true;}}
   const {subject_type,subject_id,lesson_date}=current.entry;
   const files=current.files.map(({path,name,size,type,mime})=>({path,name,size,type,mime}));
   const saved=await repo.save({subject_type,subject_id,lesson_date,topic:current.topic.trim(),notes:current.notes.trim(),ready:current.ready,files},prev);
   current.entry.plan=saved;const removed=(prev?.files||[]).filter(f=>!files.some(n=>n.path===f.path)).map(f=>f.path);
   clearEditor();draw();notice('Planejamento salvo. Os materiais continuam privados.');
   try{await repo.deleteFiles(removed);}catch(error){console.error('Limpeza de arquivos do planejamento:',error);notice('Planejamento salvo. Não foi possível limpar alguns arquivos privados antigos.');}
  }catch(error){console.error('Salvar planejamento:',error);notice('Não foi possível salvar: '+(error.message||'verifique sua conexão')+'. Os dados preenchidos foram mantidos.');}
  finally{busy=false;controls();}
 }
 async function remove(){
  if(busy||!edit?.previous||!confirm('Excluir este planejamento e seus arquivos privados? A aula e os materiais já publicados não serão alterados.'))return;
  const p=edit.previous,entry=edit.entry;busy=true;controls();notice('Excluindo planejamento...');
  try{
   await repo.remove(p);entry.plan=null;if(!entry.scheduled)entries=entries.filter(e=>e!==entry);
   clearEditor();draw();notice('Planejamento excluído.');
   try{await repo.deleteFiles(p.files.map(f=>f.path));}catch(error){console.error('Limpeza de arquivos do planejamento:',error);notice('Planejamento excluído. Não foi possível limpar alguns arquivos privados.');}
  }catch(error){notice('Não foi possível excluir: '+(error.message||'verifique sua conexão'));}
  finally{busy=false;controls();}
 }
 panel.querySelector('[data-plan-refresh]').addEventListener('click',()=>{if(canLeave()){start=crmPlanWindow(adminToday().date).start;load();}});
 return load();
}

/* Import is explicit, and only fills the existing unsaved lesson draft. */
async function crmImportLessonPlan(button,repo=crmPlanDatabase()){
 if(ccSaving||button.disabled)return;
 const ctx=ccContext();if(!ctx)return;
 const d=ccDraft(ctx),date=ccSelected,topic=document.getElementById('cc-lesson-topic');
 if(!d||!topic)return;
 const key={subject_type:ctx.group?'group':'student',subject_id:ctx.group?.id||ctx.members[0].id,lesson_date:date};
 button.disabled=true;
 const active=()=>!ccSaving&&button.isConnected&&ccSelected===date&&ccContext()?.key===ctx.key&&document.getElementById('cc-lesson-topic')===topic;
 try{
  let plan=await repo.get(key);
  // Rescheduled classes can still use the original date's private preparation.
  const state=ccDateState(ctx,d,date);
  const from=state.event?.rescheduled_from||state.rows?.map(r=>r.e?.rescheduled_from).find(Boolean);
  if(!plan&&from)plan=await repo.get({...key,lesson_date:from});
  if(!active())return;
  if(!plan){alert('Não há planejamento salvo para esta aula.');return;}
  if(plan.topic&&topic.value.trim()&&topic.value.trim()!==plan.topic&&!confirm('Substituir o tema digitado pelo tema do planejamento?'))return;
  const capturedTopic=topic.value;
  const pending=ccLessonMap(ctx).get(date)?.files||[];
  const files=[];
  for(const f of plan.files||[]){
   if(pending.some(r=>r.planningPath===f.path||(r.file.name===f.name&&r.file.size===f.size)))continue;
   const blob=await repo.download(f.path);
   files.push({file:new File([blob],f.name,{type:f.mime||blob.type}),type:Object.hasOwn(crmPlanTypes(),f.type)?f.type:inferQuickResourceType(f.name),student:null,planningPath:f.path});
  }
  if(!active())return;
  if(plan.topic&&topic.value!==capturedTopic&&topic.value.trim()!==plan.topic&&!confirm('O tema mudou durante o carregamento. Substituir pelo planejamento?'))return;
  if(plan.topic)topic.value=plan.topic;
  ccCaptureLesson();
  const draft=ccLessonMap(ctx).get(date);
  if(!draft)return;
  for(const f of files)if(!draft.files.some(r=>r.planningPath===f.planningPath||(r.file.name===f.file.name&&r.file.size===f.file.size)))draft.files.push(f);
  ccRenderLessonFiles();
  alert('Planejamento adicionado ao rascunho. Revise os materiais e salve o calendário quando desejar publicar a aula.');
 }catch(error){console.error('Importar planejamento:',error);if(active())alert('Não foi possível aproveitar o planejamento. Tente novamente; a aula não foi publicada.');}
 finally{if(button.isConnected)button.disabled=false;}
}
