/* Calendar lesson drafts are scoped to the calendar and selected date. */
const ccLessonDrafts=new Map();
function inferQuickResourceType(fileName){
  const normalizedName = (fileName || '').trim();
  // Prioriza os padrões de nome, independentemente da extensão.
  if (/report\s*-\s*class/i.test(normalizedName)) return 'rep';
  if (/^\d+/.test(normalizedName)) return 'ppt';
  const extension = (normalizedName.split('.').pop() || '').toLowerCase();
  if (['ppt', 'pptx', 'odp'].includes(extension)) return 'ppt';
  if (['doc', 'docx', 'odt', 'xls', 'xlsx'].includes(extension)) return 'ex';
  return 'pdf';
}
const ccMaterialLabels={ppt:"Slides",ex:"Exercícios",rep:"Relatório de desempenho",pdf:"PDF"};
function ccLessonAttr(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function ccLessonMap(ctx){if(!ccLessonDrafts.has(ctx.key))ccLessonDrafts.set(ctx.key,new Map());return ccLessonDrafts.get(ctx.key);}
function ccCollectiveRows(ctx){
 if(!ctx.group)return ctx.lessons;
 const ids=ctx.members.map(s=>s.id), legacy=new Map();
 for(const l of ctx.lessons.filter(l=>!l.group_id&&l.lesson_date)){
  const key=JSON.stringify([l.lesson_date,l.title,l.topic||'']);(legacy.get(key)||legacy.set(key,[]).get(key)).push(l);
 }
 return [...ctx.lessons.filter(l=>l.group_id===ctx.group.id),...[...legacy.values()].filter(rows=>ids.every(id=>rows.some(l=>l.student_id===id))).flat()];
}
function ccLessonNumber(ctx,date){
 const map=ccLessonMap(ctx),rows=ccCollectiveRows(ctx).filter(l=>!map.get(l.lesson_date)?.deleteIds),dates=ctx.group?[...new Set(rows.map(l=>l.lesson_date).filter(Boolean))]:rows.map(l=>l.lesson_date||l.created_at?.slice(0,10)).filter(Boolean);
 const staged=[...map.keys()].filter(v=>v<date&&!dates.includes(v)&&!map.get(v)?.deleteIds);
 return 'Class #'+(dates.filter(v=>v<date).length+staged.length+1);
}
function ccNextLessonDate(ctx,d,today=adminToday().date){
 const model=ccModel(ctx,d),rows=ccCollectiveRows(ctx),registered=new Set(rows.map(l=>l.lesson_date));
 const pending=Object.keys(ctx.group?d.schedule.events:model.events).filter(date=>date<=today&&!registered.has(date)&&ccDateState(ctx,d,date).status==='done').sort();
 if(pending.length)return pending[0];
 const last=rows.map(l=>l.lesson_date).filter(Boolean).sort().at(-1);
 let date=last?ccNextDate(last):model.start||today;
 if(model.start&&date<model.start)date=model.start;
 for(let i=0;i<730&&(!model.end||date<=model.end);i++,date=ccNextDate(date)){
  const state=ccDateState(ctx,d,date);
  if(!registered.has(date)&&['planned','done'].includes(state.status)&& (ctx.group||!ccGroupForDate(ctx.members[0].id,date)))return date;
 }
 return today;
}
function ccSelectLessonDate(input){const value=input.value;if(/^\d{4}-\d{2}-\d{2}$/.test(value))ccJump(value);}
function ccOpenSuggested(){
 const ctx=ccContext(),d=ccDraft(ctx);if(!d)return;
 ccJump(ccNextLessonDate(ctx,d));
}
function ccLessonRows(ctx,date){
 const rows=ctx.lessons.filter(l=>l.lesson_date===date);
 if(!ctx.group)return rows.filter(l=>!l.group_id);
 const explicit=rows.filter(l=>l.group_id===ctx.group.id);
 if(explicit.length)return explicit;
 // Legacy collective records may be edited only if there is exactly one matching record per member.
 const legacy=rows.filter(l=>!l.group_id&&ctx.members.some(m=>m.id===l.student_id));
 return legacy.length===ctx.members.length&&ctx.members.every(m=>legacy.filter(l=>l.student_id===m.id).length===1)&&new Set(legacy.map(l=>JSON.stringify([l.title,l.topic||'']))).size===1?legacy:[];
}
function ccLessonCanManage(ctx,date){
 const rows=ccLessonRows(ctx,date);
 return rows.length>0&&new Set(rows.map(l=>l.student_id)).size===rows.length&&rows.every(l=>l.id);
}
function ccEditRegisteredLesson(){
 const el=document.getElementById('cc-lesson-title');if(!el)return;
 el.focus();el.scrollIntoView({block:'nearest'});
}
function ccLessonDeletionEntries(ctx){return [...ccLessonMap(ctx).values()].filter(e=>e.deleteIds);}
function ccPendingLessonDeletion(ctx,date){return Boolean(ccLessonMap(ctx).get(date)?.deleteIds);}
// Use the same link/conflict checks as calendar deletion, but ignore only the explicitly selected lesson IDs.
// Work on a copy: undo and failed saves leave unrelated calendar changes intact.
function ccProjectLessonDeletions(ctx,d){
 const entries=ccLessonDeletionEntries(ctx);
 if(!entries.length)return d;
 const gone=new Set(entries.flatMap(e=>e.deleteIds)),remaining={...ctx,lessons:ctx.lessons.filter(l=>!gone.has(l.id))};
 const next={...d,payloads:ccClone(d.payloads),schedule:d.schedule?ccClone(d.schedule):null};
 for(const entry of entries){
  ccDeleteDate(remaining,next,entry.date);
  for(const member of ctx.members)next.payloads[member.id].events[entry.date]={skip:true,...(ctx.group?{group_id:ctx.group.id}:{})};
  if(ctx.group)next.schedule.events[entry.date]={skip:true};
 }
 return next;
}
function ccStageLessonDelete(){
 if(ccSaving)return;
 const ctx=ccContext(),d=ccDraft(ctx),date=ccSelected;
 if(!d||!ccLessonCanManage(ctx,date))return;
 const rows=ccLessonRows(ctx,date),map=ccLessonMap(ctx);
 if(!confirm('Marcar esta aula e seus materiais para exclusão'+(ctx.group?' de todos os integrantes cadastrados':'')+'? A exclusão só será efetivada ao salvar o calendário. O evento também será removido do calendário.'))return;
 const previous=map.get(date);
 map.set(date,{date,deleteIds:rows.map(l=>l.id).sort(),previous});
 try{ccProjectLessonDeletions(ctx,d);}catch(error){if(previous)map.set(date,previous);else map.delete(date);alert(error.message);return;}
 ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();
}
function ccUndoLessonDelete(){
 if(ccSaving)return;
 const ctx=ccContext(),d=ccDraft(ctx),map=ccLessonMap(ctx),entry=map.get(ccSelected);
 if(!entry?.deleteIds)return;
 if(entry.previous)map.set(ccSelected,entry.previous);else map.delete(ccSelected);
 ccMarkDirty(ctx,d);ccRefreshGrid();ccEditor();
}
function ccLessonForm(ctx,d,date,state){
 const existing=ccLessonRows(ctx,date);
 if(!ctx.group){
  const group=ccGroupForDate(ctx.members[0].id,date);
  if(group&&(!existing.length||ccLessonRows({group,members:group.members.map(id=>({id})),lessons:group.calendarLessons||[]},date).some(l=>existing.some(r=>r.id===l.id))))return '';
 }
 if(ctx.group&&!existing.length&&state.real)return '<p class="small-note">Registro histórico individual. Abra o perfil do integrante para consultar os materiais.</p>';
 if(!existing.length&&!(state.status==='done'||(ctx.group&&state.rows.some(r=>r.status==='done'))))return '';
 if(existing.length&&!ccLessonCanManage(ctx,date))return '<p class="small-note">Há registros ambíguos nesta data. A edição em lote foi bloqueada para proteger os materiais.</p>';
 const deletion=ccLessonMap(ctx).get(date);
 if(deletion?.deleteIds)return '<section class="box cc-lesson-form"><h3>Exclusão de aula pendente</h3><p>Esta aula, seus materiais e o evento serão removidos ao salvar o calendário.</p><button type="button" class="btn-ghost" onclick="ccUndoLessonDelete()">Desfazer exclusão</button></section>';
 const draft=ccLessonMap(ctx).get(date),first=existing[0],automatic=draft?.automatic??(first?first.title_automatic??/^(Class|Aula)\s*#?\s*\d+$/i.test(first.title):true);
 const value=draft?.title??(automatic?ccLessonNumber(ctx,date):first?.title||'');
 const topic=draft?.topic??first?.topic??'';
 const targets=existing.length?existing.map(l=>l.student_id):state.rows.filter(r=>r.status==='done').map(r=>r.id);
 const resourceHtml=existing.map(l=>'<div class="box"><strong>'+ccEsc(ctx.group?(ctx.members.find(s=>s.id===l.student_id)?.full_name||'Aluno'):'Materiais cadastrados')+'</strong>'+(l.resources||[]).map(r=>typeof resourceRowWithEditHtml==='function'&&!ctx.group?resourceRowWithEditHtml(l,r):'<p>'+ccEsc(r.name)+' '+(r.file_path?'<button type="button" class="btn-ghost" onclick="previewFile(&quot;'+ccEsc(r.file_path)+'&quot;)">Visualizar</button>':'')+'</p>').join('')+'</div>').join('');
 return '<section class="box cc-lesson-form" id="cc-lesson-form"><h3>'+(existing.length?'Aula e materiais cadastrados':'Cadastrar aula e materiais')+'</h3>'+ (existing.length?'<div class="cc-lesson-actions"><button type="button" class="btn-ghost" onclick="ccEditRegisteredLesson()">Editar aula</button><button type="button" class="resource-action" onclick="ccStageLessonDelete()">Excluir aula</button></div>':'') +'<p class="small-note">A numeração acompanha a ordem das datas. Materiais são opcionais; salve todas as alterações pelo botão Salvar calendário.</p><label>Título da aula<input id="cc-lesson-title" value="'+ccLessonAttr(value)+'" oninput="ccLessonTitleEdit()"></label><label class="cc-lesson-number-toggle"><input type="checkbox" id="cc-lesson-auto" '+(automatic?'checked':'')+' onchange="ccLessonAuto()"><span>Numeração automática</span></label><label>Tópico da aula<input id="cc-lesson-topic" value="'+ccLessonAttr(topic)+'" oninput="ccCaptureLesson()"></label><p>Data da aula: <strong>'+ccEsc(formatDate(date))+'</strong> · Para cadastrar em outra data, use o seletor acima ou clique no calendário.</p>'+resourceHtml+
 '<div class="cc-material-drop" id="cc-material-drop" ondragover="ccFileDrag(event,true)" ondragleave="ccFileDrag(event,false)" ondrop="ccFileDrop(event)"><strong>Arraste e solte os materiais aqui</strong><p class="small-note">Identificamos automaticamente o tipo pelo nome e pela extensão, seguindo a regra atual.</p><input type="file" id="cc-lesson-upload" multiple hidden onchange="ccCaptureFiles(this)"><button type="button" class="btn-ghost" onclick="document.getElementById(&quot;cc-lesson-upload&quot;).click()">+ Adicionar arquivos</button></div>'+
 (ctx.group?'<p class="small-note">Slides compartilhados e exercícios são enviados aos presentes. Para cada relatório de desempenho, escolha o integrante: <strong>'+targets.map(id=>ccEsc(ctx.members.find(s=>s.id===id)?.full_name||id)).join(' · ')+'</strong>.</p>':'')+
 '<div id="cc-lesson-files">'+ccLessonFilesHtml(draft,ctx,targets)+'</div><p class="small-note">Os arquivos e os dados da aula entram automaticamente no rascunho. Você pode trocar de data e salvar tudo de uma vez em <strong>Salvar calendário</strong>.</p></section>';
}
function ccLessonTargets(ctx,d,date){
 const existing=ccLessonRows(ctx,date);
 return existing.length?existing.map(l=>l.student_id):ccDateState(ctx,d,date).rows.filter(r=>r.status==='done').map(r=>r.id);
}
function ccLessonFilesHtml(entry,ctx,targets){
 const files=entry?.files||[];
 if(!files.length)return '<p class="small-note">Nenhum arquivo selecionado.</p>';
 return files.map((r,i)=>'<div class="cc-material-row"><strong class="cc-material-name">'+ccEsc(r.file.name)+'</strong><label>Tipo do material<select aria-label="Tipo do arquivo '+ccLessonAttr(r.file.name)+'" onchange="ccChangeLessonFileType('+i+',this.value)">'+Object.entries(ccMaterialLabels).map(([type,label])=>'<option value="'+type+'" '+(r.type===type?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
 (ctx.group&&r.type==='rep'?'<label>Relatório exclusivo de<select aria-label="Destinatário do relatório '+ccLessonAttr(r.file.name)+'" onchange="ccChangeLessonRecipient('+i+',this.value)"><option value="">Selecione o aluno</option>'+targets.map(id=>'<option value="'+ccLessonAttr(id)+'" '+(r.student===id?'selected':'')+'>'+ccEsc(ctx.members.find(s=>s.id===id)?.full_name||id)+'</option>').join('')+'</select></label>':'')+
 '<button type="button" class="resource-action" onclick="ccRemoveLessonFile('+i+')">Remover</button></div>').join('');
}
function ccRenderLessonFiles(){
 const ctx=ccContext(),d=ccDraft(ctx),box=document.getElementById('cc-lesson-files');
 if(box&&d)box.innerHTML=ccLessonFilesHtml(ccLessonMap(ctx).get(ccSelected),ctx,ccLessonTargets(ctx,d,ccSelected));
}
function ccFileDrag(event,active){event.preventDefault();event.currentTarget.classList.toggle('is-dragging',active);}
function ccFileDrop(event){ccFileDrag(event,false);ccAddLessonFiles(event.dataTransfer?.files);}
function ccAddLessonFiles(files){
 if(!files?.length||ccSaving)return;
 ccCaptureLesson();const entry=ccLessonMap(ccContext()).get(ccSelected);if(!entry)return;
 for(const file of files)entry.files.push({file,type:inferQuickResourceType(file.name),student:null});
 ccRenderLessonFiles();
}
function ccCaptureFiles(input){ccAddLessonFiles(input.files);input.value='';}
function ccChangeLessonFileType(index,type){
 if(ccSaving||!Object.hasOwn(ccMaterialLabels,type))return;
 const r=ccLessonMap(ccContext()).get(ccSelected)?.files[index];if(!r)return;
 if(r.type!==type){r.type=type;r.student=null;delete r.path;}
 ccRenderLessonFiles();
}
function ccChangeLessonRecipient(index,id){
 if(ccSaving)return;
 const ctx=ccContext(),d=ccDraft(ctx),r=ccLessonMap(ctx).get(ccSelected)?.files[index];
 if(!r||r.type!=='rep'||!ctx.group)return;
 if(r.student!==id){r.student=ccLessonTargets(ctx,d,ccSelected).includes(id)?id:null;delete r.path;}
 ccRenderLessonFiles();
}

function ccCaptureLesson(){
 if(ccSaving)return;
 const ctx=ccContext(),d=ccDraft(ctx),title=document.getElementById('cc-lesson-title');if(!d||!title)return;
 const map=ccLessonMap(ctx),old=map.get(ccSelected)||{files:[]};
 map.set(ccSelected,{...old,date:ccSelected,automatic:document.getElementById('cc-lesson-auto').checked,title:title.value.trim(),topic:document.getElementById('cc-lesson-topic').value.trim()});
 ccMarkDirty(ctx,d);
}
function ccLessonTitleEdit(){document.getElementById('cc-lesson-auto').checked=false;ccCaptureLesson();}
function ccLessonAuto(){if(document.getElementById('cc-lesson-auto').checked)document.getElementById('cc-lesson-title').value=ccLessonNumber(ccContext(),ccSelected);ccCaptureLesson();}
function ccRemoveLessonFile(index){if(ccSaving)return;const entry=ccLessonMap(ccContext()).get(ccSelected);entry?.files.splice(index,1);ccRenderLessonFiles();}
function ccValidateLessonDrafts(ctx,d){
 ccProjectLessonDeletions(ctx,d);
 for(const entry of ccLessonMap(ctx).values()){
  const existing=ccLessonRows(ctx,entry.date),state=ccDateState(ctx,d,entry.date);
  if(entry.deleteIds){if(!ccLessonCanManage(ctx,entry.date)||JSON.stringify(existing.map(l=>l.id).sort())!==JSON.stringify(entry.deleteIds))throw Error('A aula mudou; recarregue o calendário.');continue;}
  if(!entry.automatic&&!entry.title)throw Error('Informe o título da aula de '+formatDate(entry.date));
  if(!existing.length&&!state.rows.some(r=>r.status==='done'))throw Error('Marque '+formatDate(entry.date)+' como Realizada ou descarte seu rascunho de materiais.');
  if(!existing.length&&ctx.group&&state.real)throw Error('Já há cadastro individual nesta data.');
  if(ctx.group&&entry.files.some(r=>r.type==='rep'&&!ccLessonTargets(ctx,d,entry.date).includes(r.student)))throw Error('Escolha um integrante presente para cada relatório em '+formatDate(entry.date)+'.');
 }
}
async function ccCheckLessonSchema(ctx){
 if(!ccLessonMap(ctx).size||typeof demoStates!=='undefined')return;
 const {error}=await sb.from('lessons').select('title_automatic').limit(1);
 if(error)throw Error('A migração da numeração ainda não está ativa. Use a página de teste isolado calendar-preview.html nesta prévia.');
}
async function ccFlushLessons(ctx,d){
 const map=ccLessonMap(ctx);if(!map.size)return;
 for(const [date,entry] of [...map].sort(([a],[b])=>a.localeCompare(b))){
  if(entry.deleteIds)throw Error('A exclusão deve ser confirmada junto com o calendário.');
  const existing=ccLessonRows(ctx,date),state=ccDateState(ctx,d,date),targets=existing.length?existing.map(l=>l.student_id):state.rows.filter(r=>r.status==='done').map(r=>r.id);
  const materials=[];
  for(const r of entry.files){
   if(ctx.group&&r.type==='rep'&&!targets.includes(r.student))throw Error('Relatório sem destinatário válido.');
   const owner=ctx.group?(r.student||'turmas'):ctx.members[0].id;
   const path=r.path||owner+'/'+(ctx.group?.id||'calendar')+'/'+crypto.randomUUID()+'-'+r.file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
   if(!r.path){const {error}=await sb.storage.from('materiais').upload(path,r.file);if(error)throw error;r.path=path;}
   materials.push({path,type:r.type,name:r.file.name,student:ctx.group?r.student:null});
  }
  const {error}=await sb.rpc('portal_calendar_lesson_save',{p_group:ctx.group?.id||null,p_student:ctx.group?null:ctx.members[0].id,p_date:date,p_title:entry.automatic?null:entry.title,p_topic:entry.topic,p_members:targets,p_materials:materials,p_edit:!!existing.length});
  if(error)throw error;
  map.delete(date);
 }
}
function ccLessonHistory(){
 const ctx=ccContext();if(!ctx)return;
 const rows=ccCollectiveRows(ctx).filter(l=>!ccPendingLessonDeletion(ctx,l.lesson_date)),dates=[...new Set(rows.map(l=>l.lesson_date).filter(Boolean))].sort().reverse();
 const box=document.getElementById('cc-history');if(!box)return;
 box.hidden=!box.hidden;if(box.hidden)return;
 box.innerHTML='<h3>Histórico de aulas</h3>'+(!ctx.group&&!ctx.members[0].is_test_profile&&typeof notifyStudentAboutLesson==='function'?'<button class="btn-ghost" onclick="notifyStudentAboutLesson()">Enviar e-mail ao aluno</button>':'')+dates.map(date=>'<div class="resource-row"><div class="resource-info">'+ccPublishedDetails(ctx,date)+'<small>'+ccEsc(formatDate(date))+'</small></div><button class="btn-ghost" onclick="ccJump(&quot;'+date+'&quot;)">Abrir aula</button></div>').join('');
}
