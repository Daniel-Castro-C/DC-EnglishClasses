/* Calendar lesson drafts are scoped to the calendar and selected date. */
const ccLessonDrafts=new Map();
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
 const rows=ccCollectiveRows(ctx),dates=ctx.group?[...new Set(rows.map(l=>l.lesson_date).filter(Boolean))]:rows.map(l=>l.lesson_date||l.created_at?.slice(0,10)).filter(Boolean);
 const staged=[...ccLessonMap(ctx).keys()].filter(v=>v<date&&!dates.includes(v));
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
function ccLessonRows(ctx,date){return ctx.lessons.filter(l=>l.lesson_date===date&&(!ctx.group||l.group_id===ctx.group.id));}
function ccLessonForm(ctx,d,date,state){
 const existing=ccLessonRows(ctx,date);
 if(!ctx.group&&ccGroupForDate(ctx.members[0].id,date)&&(!existing.length||existing.some(l=>l.group_id)))return '';
 if(ctx.group&&!existing.length&&state.real)return '<p class="small-note">Registro histórico individual. Abra o perfil do integrante para consultar os materiais.</p>';
 if(!existing.length&&!(state.status==='done'||(ctx.group&&state.rows.some(r=>r.status==='done'))))return '';
 if(!ctx.group&&existing.length>1)return '<p class="small-note">Há mais de uma aula nesta data. Consulte o histórico para editar cada registro.</p>';
 const draft=ccLessonMap(ctx).get(date),first=existing[0],automatic=draft?.automatic??(first?first.title_automatic??/^(Class|Aula)\s*#?\s*\d+$/i.test(first.title):true);
 const value=draft?.title??(automatic?ccLessonNumber(ctx,date):first?.title||'');
 const topic=draft?.topic??first?.topic??'';
 const targets=existing.length?existing.map(l=>l.student_id):state.rows.filter(r=>r.status==='done').map(r=>r.id);
 const resourceHtml=existing.map(l=>'<div class="box"><strong>'+ccEsc(ctx.group?(ctx.members.find(s=>s.id===l.student_id)?.full_name||'Aluno'):'Materiais cadastrados')+'</strong>'+(l.resources||[]).map(r=>typeof resourceRowWithEditHtml==='function'&&!ctx.group?resourceRowWithEditHtml(l,r):'<p>'+ccEsc(r.name)+' '+(r.file_path?'<button type="button" class="btn-ghost" onclick="previewFile(&quot;'+ccEsc(r.file_path)+'&quot;)">Visualizar</button>':'')+'</p>').join('')+'</div>').join('');
 return '<section class="box cc-lesson-form" id="cc-lesson-form"><h3>'+(existing.length?'Aula e materiais cadastrados':'Cadastrar aula e materiais')+'</h3><p class="small-note">A numeração acompanha a ordem das datas. Materiais são opcionais; salve todas as alterações pelo botão Salvar calendário.</p><label><input type="checkbox" id="cc-lesson-auto" '+(automatic?'checked':'')+' onchange="ccLessonAuto()"> Numeração automática</label><label>Título da aula<input id="cc-lesson-title" value="'+ccLessonAttr(value)+'" oninput="ccLessonTitleEdit()"></label><label>Tópico da aula<input id="cc-lesson-topic" value="'+ccLessonAttr(topic)+'" oninput="ccCaptureLesson()"></label><p>Data da aula: <strong>'+ccEsc(formatDate(date))+'</strong> · Para cadastrar em outra data, use o seletor acima ou clique no calendário.</p>'+resourceHtml+
 (ctx.group?'<label>Slides compartilhados<input type="file" multiple data-cc-file="ppt" onchange="ccCaptureFiles(this)"></label><label>Exercícios compartilhados<input type="file" multiple data-cc-file="ex" onchange="ccCaptureFiles(this)"></label>'+targets.map(id=>'<label>Relatório de desempenho — '+ccEsc(ctx.members.find(s=>s.id===id)?.full_name||id)+'<input type="file" multiple data-cc-file="rep" data-cc-student="'+ccEsc(id)+'" onchange="ccCaptureFiles(this)"></label>').join(''):['ppt','ex','rep','pdf'].map(type=>'<label>'+({ppt:'Slides',ex:'Exercícios',rep:'Relatório de desempenho',pdf:'PDF'}[type])+'<input type="file" multiple data-cc-file="'+type+'" onchange="ccCaptureFiles(this)"></label>').join(''))+
 '<div id="cc-lesson-files">'+ccLessonFilesHtml(draft)+'</div><button type="button" class="btn-ghost" onclick="ccCaptureLesson()">Adicionar ao próximo salvamento</button><p class="small-note">Você pode selecionar outra data; os arquivos escolhidos ficam no rascunho até salvar.</p></section>';
}
function ccLessonFilesHtml(entry){return (entry?.files||[]).map((r,i)=>'<p>'+ccEsc(r.file.name)+' <button type="button" class="resource-action" onclick="ccRemoveLessonFile('+i+')">Remover</button></p>').join('');}
function ccCaptureLesson(){
 const ctx=ccContext(),d=ccDraft(ctx),title=document.getElementById('cc-lesson-title');if(!d||!title)return;
 const map=ccLessonMap(ctx),old=map.get(ccSelected)||{files:[]};
 map.set(ccSelected,{...old,date:ccSelected,automatic:document.getElementById('cc-lesson-auto').checked,title:title.value.trim(),topic:document.getElementById('cc-lesson-topic').value.trim()});
 ccMarkDirty(ctx,d);
}
function ccLessonTitleEdit(){document.getElementById('cc-lesson-auto').checked=false;ccCaptureLesson();}
function ccLessonAuto(){if(document.getElementById('cc-lesson-auto').checked)document.getElementById('cc-lesson-title').value=ccLessonNumber(ccContext(),ccSelected);ccCaptureLesson();}
function ccCaptureFiles(input){ccCaptureLesson();const entry=ccLessonMap(ccContext()).get(ccSelected);for(const file of input.files)entry.files.push({file,type:input.dataset.ccFile,student:input.dataset.ccStudent||null});input.value='';document.getElementById('cc-lesson-files').innerHTML=ccLessonFilesHtml(entry);}
function ccRemoveLessonFile(index){const entry=ccLessonMap(ccContext()).get(ccSelected);entry.files.splice(index,1);document.getElementById('cc-lesson-files').innerHTML=ccLessonFilesHtml(entry);}
function ccValidateLessonDrafts(ctx,d){
 for(const entry of ccLessonMap(ctx).values()){
  const existing=ccLessonRows(ctx,entry.date),state=ccDateState(ctx,d,entry.date);
  if(!entry.automatic&&!entry.title)throw Error('Informe o título da aula de '+formatDate(entry.date));
  if(!existing.length&&!state.rows.some(r=>r.status==='done'))throw Error('Marque '+formatDate(entry.date)+' como Realizada ou descarte seu rascunho de materiais.');
  if(!existing.length&&ctx.group&&state.real)throw Error('Já há cadastro individual nesta data.');
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
  const existing=ccLessonRows(ctx,date),state=ccDateState(ctx,d,date),targets=existing.length?existing.map(l=>l.student_id):state.rows.filter(r=>r.status==='done').map(r=>r.id);
  const materials=[];
  for(const r of entry.files){
   if(ctx.group&&r.type==='rep'&&!targets.includes(r.student))continue;
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
 const rows=ccCollectiveRows(ctx),dates=[...new Set(rows.map(l=>l.lesson_date).filter(Boolean))].sort().reverse();
 const box=document.getElementById('cc-history');if(!box)return;
 box.hidden=!box.hidden;if(box.hidden)return;
 box.innerHTML='<h3>Histórico de aulas</h3>'+(!ctx.group&&!ctx.members[0].is_test_profile&&typeof notifyStudentAboutLesson==='function'?'<button class="btn-ghost" onclick="notifyStudentAboutLesson()">Enviar e-mail ao aluno</button>':'')+dates.map(date=>'<div class="resource-row"><div class="resource-info">'+ccPublishedDetails(ctx,date)+'<small>'+ccEsc(formatDate(date))+'</small></div><button class="btn-ghost" onclick="ccJump(&quot;'+date+'&quot;)">Abrir aula</button></div>').join('');
}
