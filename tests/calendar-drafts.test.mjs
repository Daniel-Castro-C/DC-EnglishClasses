import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const code=readFileSync('js/admin-calendar-test.js','utf8')+'\n'+readFileSync('js/admin-turmas-preview.js','utf8');
function setup({group=false}={}){
 const c=vm.createContext({console,window:{addEventListener(){}},document:{getElementById(){return null}},escapeHtml:v=>String(v),alert(){},confirm:()=>true,formatDate:d=>d,students:[{id:'s1',full_name:'One',lesson_weekday:1,lesson_time:'18:00'},{id:'s2',full_name:'Two',lesson_weekday:1,lesson_time:'18:00'}],currentLessons:[],currentLessonsReady:true,currentView:group?'turmas':'student',currentTab:'calendario',localStorage:{getItem(){return null},setItem(){}},currentStudent:null,crmRegisteredDates:new Set(),adminToday:()=>({date:'2026-11-23'})});
 vm.runInContext(code,c);
 vm.runInContext(`
 currentStudent=students[0];
 ccCloudReady=true;
 for(const s of students) ccCloud.set(s.id,{revision:2,payload:{start:'2026-11-01',weekdays:'1',time:'18:00',events:{}}});
 if(currentView==='turmas'){tgSelected={id:'g1',name:'Dupla',members:['s1','s2'],start:'2026-11-01',days:'1',time:'18:00',calendarLessons:[]};tgGroups=[tgSelected];}
 var ctx=ccContext(),draft=ccDraft(ctx);
 `,c);
 return {run:s=>vm.runInContext(s,c),ctx:c};
}
for(const group of [false,true]){
 const title=group?'group':'individual';
 test(title+': recurring deletion is persistent in the draft and never deletes another date',()=>{
  const {run}=setup({group});
  run("ccDeleteDate(ctx,draft,'2026-11-23')");
  assert.equal(run("ccDateState(ctx,draft,'2026-11-23').status"),'');
  assert.equal(run("ccDateState(ctx,draft,'2026-11-30').status"),'planned');
  assert.equal(run("Boolean(ccRead('s1').events['2026-11-23'])"),false);
  assert.equal(run("draft.payloads.s1.events['2026-11-23'].skip"),true);
  if(group)assert.equal(run("draft.payloads.s2.events['2026-11-23'].group_id"),'g1');
 });
 test(title+': rescheduling keeps original and target linked, supports moving the new date',()=>{
  const {run}=setup({group});
  run("ccReschedule(ctx,draft,'2026-11-23','2026-11-24','18:00','Obs')");
  assert.equal(run("ccDateState(ctx,draft,'2026-11-23').status"),'rescheduled');
  assert.equal(run("draft.payloads.s1.events['2026-11-23'].rescheduled_to"),'2026-11-24');
  assert.equal(run("draft.payloads.s1.events['2026-11-24'].rescheduled_from"),'2026-11-23');
  assert.equal(run("draft.payloads.s1.events['2026-11-24'].original"),undefined);
  run("ccReschedule(ctx,draft,'2026-11-24','2026-11-25','19:00','Obs')");
  assert.equal(run("draft.payloads.s1.events['2026-11-23'].rescheduled_to"),'2026-11-25');
  assert.equal(run("draft.payloads.s1.events['2026-11-24']"),undefined);
  assert.equal(run("ccDateState(ctx,draft,'2026-11-25').status"),'planned');
  if(group)assert.equal(run("draft.payloads.s2.events['2026-11-25'].rescheduled_from"),'2026-11-23');
  run("ccDeleteDate(ctx,draft,'2026-11-25')");
  assert.equal(run("ccDateState(ctx,draft,'2026-11-23').status"),'planned');
  assert.equal(run("draft.payloads.s1.events['2026-11-25']"),undefined);
 });
 test(title+': destination collision and published lesson protection are atomic',()=>{
  const {run}=setup({group});
  assert.throws(()=>run("ccReschedule(ctx,draft,'2026-11-23','2026-11-30','18:00','')"),/Já existe/);
  run("ctx.lessons.push({student_id:'s1',lesson_date:'2026-11-24',group_id:'g1'})");
  assert.throws(()=>run("ccReschedule(ctx,draft,'2026-11-23','2026-11-24','18:00','')"),/aula cadastrada/);
  assert.throws(()=>run("ccDeleteDate(ctx,draft,'2026-11-24')"),/aula cadastrada/);
  assert.equal(run("Object.keys(draft.payloads.s1.events).length"),0);
  if(group)assert.equal(run("Object.keys(draft.payloads.s2.events).length"),0);
 });
}
test('group attendance preserves the collective absence rule',()=>{
 const {run}=setup({group:true});
 assert.equal(run("tgNormalizeAttendance(['s1','s2'],{s1:'owed',s2:'done'}).s1"),'absent');
 assert.equal(run("tgNormalizeAttendance(['s1','s2'],{s1:'absent',s2:'absent'}).s1"),'owed');
 run("draft.payloads.s1.events['2026-11-23']={group_id:'g1',status:'absent'};draft.payloads.s2.events['2026-11-23']={group_id:'g1',status:'done'}");
 assert.throws(()=>run("ccReschedule(ctx,draft,'2026-11-23','2026-11-24','18:00','')"),/Apenas aulas agendadas/);
});
test('group schedule changes project to members while preserving prior dates',()=>{
 const {run}=setup({group:true});
 run("ccGroupProjection(draft,{...draft.schedule,changes:[{from:'2026-12-01',weekdays:'3',time:'19:00'}]})");
 assert.equal(run("ccSchedule(draft.payloads.s1,'2026-11-23').weekdays"),'1');
 assert.equal(run("ccSchedule(draft.payloads.s2,'2026-12-02').weekdays"),'3');
 run("ccGroupProjection(draft,{...draft.schedule,changes:[]})");
 assert.equal(run("ccSchedule(draft.payloads.s1,'2026-12-02').weekdays"),'1');
});
test('group dates are protected against the individual editor',()=>{
 const {run}=setup();
 run("tgGroups=[{id:'g1',members:['s1','s2'],start:'2026-11-01',days:'1',time:'18:00'}]");
 assert.throws(()=>run("ccDeleteDate(ctx,draft,'2026-11-23')"),/calendário da turma/);
});
test('agenda omits original rescheduled date and shows new date only after confirmation',()=>{
 const {run}=setup();
 run("ccReschedule(ctx,draft,'2026-11-23','2026-11-24','18:00','');");
 assert.equal(run("ccAgenda({date:'2026-11-23'}).some(s=>s.id==='s1')"),true);
 run("ccCloud.set('s1',{revision:3,payload:draft.payloads.s1})");
 assert.equal(run("ccAgenda({date:'2026-11-23'}).some(s=>s.id==='s1')"),false);
 assert.match(run("ccAgenda({date:'2026-11-24'}).find(s=>s.id==='s1').ccType"),/Reagendamento/);
});
test('saving individual updates all edited dates in one RPC and respects revision',async()=>{
 const {run,ctx}=setup();
 ctx.calls=[];ctx.sb={from:()=>({select(){return this},in(){return this},async limit(){return {data:[]}}}),async rpc(name,args){ctx.calls.push({name,args});return {data:3}}};
 run("ccReschedule(ctx,draft,'2026-11-23','2026-11-24','18:00','');ccDeleteDate(ctx,draft,'2026-11-30');ccMarkDirty(ctx,draft);ccRender=()=>{}");
 await run("ccSaveAll()");
 assert.equal(ctx.calls.length,1);
 assert.equal(ctx.calls[0].name,'save_admin_calendar');
 assert.equal(ctx.calls[0].args.p_revision,2);
 assert.equal(ctx.calls[0].args.p_payload.events['2026-11-30'].skip,true);
 assert.equal(ctx.calls[0].args.p_payload.events['2026-11-23'].status,'rescheduled');
});
test('saving group sends all dates and both revisions in a single transactional RPC',async()=>{
 const {run,ctx}=setup({group:true});
 ctx.calls=[];ctx.sb={from:()=>({select(){return this},in(){return this},async limit(){return {data:[]}}}),async rpc(name,args){ctx.calls.push({name,args});return {}}};
 run("ccReschedule(ctx,draft,'2026-11-23','2026-11-24','18:00','');ccDeleteDate(ctx,draft,'2026-11-30');ccMarkDirty(ctx,draft);ccRender=()=>{};ccLoadCloud=async()=>{};tgLoad=async()=>{}");
 await run("ccSaveAll()");
 assert.equal(ctx.calls.length,1);
 assert.equal(ctx.calls[0].name,'portal_group_calendar_save');
 assert.equal(ctx.calls[0].args.p_schedule.calendar_events['2026-11-23'].status,'rescheduled');
 assert.equal(ctx.calls[0].args.p_schedule.calendar_events['2026-11-30'].skip,true);
 for(const change of ctx.calls[0].args.p_changes){
  assert.equal(change.revision,2);
  assert.equal(change.payload.events['2026-11-30'].skip,true);
  assert.equal(change.payload.events['2026-11-24'].group_id,'g1');
 }
});
test('failed save retains drafts and denies stale revisions',async()=>{
 const {run,ctx}=setup();
 let attempts=0;
 ctx.sb={from:()=>({select(){return this},in(){return this},async limit(){return {data:[]}}}),async rpc(){attempts++;return {error:new Error('conflict')}}};
 run("ccDeleteDate(ctx,draft,'2026-11-23');ccMarkDirty(ctx,draft)");
 await run("ccSaveAll()");
 assert.equal(attempts,1);
 assert.equal(run("ccDrafts.get(ctx.key).dirty"),true);
 run("ccCloud.set('s1',{revision:99,payload:{events:{}}})");
 await run("ccSaveAll()");
 assert.equal(attempts,1);
});

test('both calendars render the same monthly grid and date editor',()=>{
 for(const group of [false,true]){
  const {run,ctx}=setup({group});
  const elements=new Map();
  const elem=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',querySelector:q=>elem(q.slice(1))});return elements.get(id)};
  ctx.document={getElementById:elem,querySelectorAll:()=>[]};
  run("ccDate=new Date('2026-11-01T12:00:00');draft.date=ccDate;draft.selected='2026-11-23';ccActiveKey='';"+(group?"tgCalendar()":"ccRender()"));
  assert.match(elem(group?'tg-body':'tab-content').innerHTML,/Salvar calendário/);
  assert.match(elem('cc-grid').innerHTML,/Agendada/);
  assert.match(elem('cc-edit').innerHTML,/Reagendar para\.\.\./);
  assert.match(elem('cc-edit').innerHTML,/Excluir registro de aula/);
  if(group)assert.match(elem('cc-edit').innerHTML,/Frequência individual/);
 }
});
test('deleting manual and habitual records does not change other dates',()=>{
 const {run}=setup();
 run("draft.payloads.s1.events['2026-11-24']={status:'done'};ccDeleteDate(ctx,draft,'2026-11-24')");
 assert.equal(run("draft.payloads.s1.events['2026-11-24']"),undefined);
 assert.equal(run("ccDateState(ctx,draft,'2026-11-23').status"),'planned');
});
test('saving refuses dates published since draft was created',async()=>{
 const {run,ctx}=setup({group:true});let writes=0;
 ctx.sb={from:()=>({select(){return this},in(){return this},async limit(){return {data:[{student_id:'s2',lesson_date:'2026-11-23'}]}}}),async rpc(){writes++;return {}}};
 run("ccDeleteDate(ctx,draft,'2026-11-23');ccMarkDirty(ctx,draft)");
 await run("ccSaveAll()");
 assert.equal(writes,0);
 assert.equal(run("ccDrafts.get(ctx.key).dirty"),true);
});

test('published lesson details include number and topic in both calendars',()=>{
 for(const group of [false,true]){
  const {run,ctx}=setup({group});const el={innerHTML:''};
  ctx.document={getElementById:()=>el,querySelectorAll:()=>[]};
  const lesson={student_id:'s1',lesson_date:'2026-11-24',title:'Class #23',topic:'Managing different personalities'};
  ctx.fixture=group?[{...lesson,group_id:'g1'},{...lesson,student_id:'s2',group_id:'g1'}]:[lesson];
  run((group?'tgSelected.calendarLessons=fixture;':'currentLessons=fixture;')+"ccSelected='2026-11-24';ccEditor()");
  assert.match(el.innerHTML,/Aula cadastrada: Class #23/);
  assert.match(el.innerHTML,/<strong>Tema:<\/strong> Managing different personalities/);
  assert.equal((el.innerHTML.match(/Class #23/g)||[]).length,1);
  assert.match(el.innerHTML,/Aulas cadastradas são protegidas/);
 }
});
test('individual calendar shows registered topic even when the lesson belongs to a group',()=>{
 const {run,ctx}=setup();const el={innerHTML:''};ctx.document={getElementById:()=>el,querySelectorAll:()=>[]};
 run("tgGroups=[{id:'g1',name:'Turma',members:['s1','s2'],start:'2026-11-01',days:'1',time:'18:00'}];currentLessons=[{student_id:'s1',group_id:'g1',lesson_date:'2026-11-23',title:'Class #23',topic:'Teamwork'}];ccSelected='2026-11-23';ccEditor()");
 assert.match(el.innerHTML,/<strong>Tema:<\/strong> Teamwork/);
 assert.match(el.innerHTML,/Abrir calendário da turma/);
});
test('published topics are escaped and missing topic is clearly indicated',()=>{
 const {run,ctx}=setup();
 ctx.escapeHtml=v=>String(v).replace(/</g,'&lt;').replace(/>/g,'&gt;');
 run("ctx.lessons.push({student_id:'s1',lesson_date:'2026-11-24',title:'Class #23',topic:'<script>'},{student_id:'s1',lesson_date:'2026-11-24',title:'Class #24',topic:null})");
 const html=run("ccPublishedDetails(ctx,'2026-11-24')");
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/Não cadastrado/);
});
test('group is the source for shared dates, individual absence never changes a colleague',()=>{
 const {run}=setup({group:true});
 run("ccStageGroupDate(ctx,draft,'2026-11-23','done',{},'19:30','Conversation','');tgSelected.calendar_events=draft.schedule.events;for(const id of tgSelected.members)ccCloud.set(id,{revision:3,payload:draft.payloads[id]})");
 assert.equal(run("tgSelected.calendar_events['2026-11-23'].status"),'done');
 assert.equal(run("ccData(students[1]).events['2026-11-23'].time"),'19:30');
 assert.equal(run("ccData(students[1]).events['2026-11-23'].notes"),'Conversation');
 run("currentView='student';currentStudent=students[0];ctx=ccContext();draft=ccDraft(ctx);ccIndividualAttendance(ctx,draft,'2026-11-23',tgSelected,'absent');ccCloud.set('s1',{revision:4,payload:draft.payloads.s1})");
 assert.equal(run("ccData(students[0]).events['2026-11-23'].status"),'absent');
 assert.equal(run("ccData(students[1]).events['2026-11-23'].status"),'done');
 assert.equal(run("tgGroupReplacementEligible('g1','2026-11-23')"),false);
 run("currentStudent=students[1];ctx=ccContext();draft=ccDraft(ctx);ccIndividualAttendance(ctx,draft,'2026-11-23',tgSelected,'absent');ccCloud.set('s2',{revision:4,payload:draft.payloads.s2})");
 assert.equal(run("tgGroupReplacementEligible('g1','2026-11-23')"),true);
 assert.equal(run("ccData(students[0]).events['2026-11-23'].status"),'owed');
 assert.equal(run("ccData(students[1]).events['2026-11-23'].status"),'owed');
 run("ccIndividualAttendance(ctx,draft,'2026-11-23',tgSelected,'inherit');ccCloud.set('s2',{revision:5,payload:draft.payloads.s2})");
 assert.equal(run("ccData(students[0]).events['2026-11-23'].status"),'absent');
 assert.equal(run("ccData(students[1]).events['2026-11-23'].status"),'done');
 assert.equal(run("tgGroupReplacementEligible('g1','2026-11-23')"),false);
});
test('shared edits retain attendance exceptions and cancellation supersedes them',()=>{
 const {run}=setup({group:true});
 run("ccStageGroupDate(ctx,draft,'2026-11-23','done',{},'18:00','','');ccStageGroupDate(ctx,draft,'2026-11-23','done',{s1:'absent',s2:'inherit'},'18:00','','',true);ccStageGroupDate(ctx,draft,'2026-11-23','done',{},'20:00','Updated','')");
 assert.equal(run("draft.schedule.events['2026-11-23'].time"),'20:00');
 assert.equal(run("draft.payloads.s1.events['2026-11-23'].status"),'absent');
 assert.equal(run("draft.payloads.s2.events['2026-11-23'].status"),'done');
 run("ccStageGroupDate(ctx,draft,'2026-11-23','holiday',{},'20:00','','')");
 assert.equal(run("draft.payloads.s1.events['2026-11-23'].status"),'holiday');
 assert.equal(run("draft.payloads.s1.events['2026-11-23'].attendance_override"),undefined);
 assert.equal(run("draft.payloads.s2.events['2026-11-23'].status"),'holiday');
});
test('an individual absence on a habitual class is editable and does not infer collective absence',()=>{
 const {run,ctx}=setup({group:true});const elements=new Map();
 ctx.document={getElementById:id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:''});return elements.get(id);},querySelectorAll:()=>[]};
 run("currentView='student';ctx=ccContext();draft=ccDraft(ctx);ccSelected='2026-11-23';ccEditor()");
 assert.match(elements.get('cc-edit').innerHTML,/Frequência deste aluno/);
 run("ccIndividualAttendance(ctx,draft,'2026-11-23',tgSelected,'absent');ccCloud.set('s1',{revision:3,payload:draft.payloads.s1});currentView='turmas';ctx=ccContext();draft=ccDraft(ctx)");
 assert.equal(run("ccDateState(ctx,draft,'2026-11-23').status"),'planned');
 assert.equal(run("ccDateState(ctx,draft,'2026-11-23').rows[0].status"),'absent');
 assert.equal(run("ccDateState(ctx,draft,'2026-11-23').rows[1].status"),'planned');
});
test('published colleague does not block recording individual absence; published own lesson remains protected',()=>{
 const {run}=setup({group:true});
 run("tgSelected.calendarLessons=[{group_id:'g1',student_id:'s2',lesson_date:'2026-11-23'}];currentView='student';ctx=ccContext();draft=ccDraft(ctx);ccIndividualAttendance(ctx,draft,'2026-11-23',tgSelected,'absent');ccCloud.set('s1',{revision:3,payload:draft.payloads.s1})");
 assert.equal(run("tgGroupReplacementEligible('g1','2026-11-23')"),false);
 run("currentStudent=students[1];currentLessons=tgSelected.calendarLessons;ctx=ccContext();draft=ccDraft(ctx)");
 assert.throws(()=>run("ccIndividualAttendance(ctx,draft,'2026-11-23',tgSelected,'absent')"),/materiais cadastrados/);
});

test('group details deduplicate legacy per-student lessons without group_id while preserving distinct lessons',()=>{
 const {run}=setup({group:true});
 run(`ctx.lessons.push(
  {student_id:'s1',lesson_date:'2026-11-05',title:'Class #39',topic:'Movie Critics'},
  {student_id:'s2',lesson_date:'2026-11-05',group_id:null,title:' Class #39 ',topic:'Movie Critics '},
  {student_id:'s2',lesson_date:'2026-11-05',group_id:'g1',title:'Class #39',topic:'Movie Critics'},
  {student_id:'s2',lesson_date:'2026-11-05',title:'Class #40',topic:'Teamwork'},
  {student_id:'s2',lesson_date:'2026-11-12',title:'Class #41',topic:'Food'}
 )`);
 const html=run("ccPublishedDetails(ctx,'2026-11-05')");
 assert.equal((html.match(/Class #39/g)||[]).length,1);
 assert.equal((html.match(/Movie Critics/g)||[]).length,1);
 assert.match(html,/Class #40/);
 assert.match(html,/Teamwork/);
 assert.doesNotMatch(html,/Class #41/);
});
test('individual details are not grouped or deduplicated',()=>{
 const {run}=setup();
 run(`ctx.lessons.push({student_id:'s1',lesson_date:'2026-11-05',title:'Class #39',topic:'Movie Critics'},{student_id:'s1',lesson_date:'2026-11-05',title:'Class #39',topic:'Movie Critics'})`);
 assert.equal((run("ccPublishedDetails(ctx,'2026-11-05')").match(/Class #39/g)||[]).length,2);
});
test('month navigation updates only grid, reserves six weeks and preserves draft in both calendars',()=>{
 for(const group of [false,true]){
  const {run,ctx}=setup({group});
  const nodes=new Map();
  const elem=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:''});return nodes.get(id)};
  ctx.document={getElementById:elem,querySelectorAll:()=>[]};
  run("ccFinishInput=()=>true;ccRender=()=>{throw Error('month navigation must not remount calendar')};ccDate=new Date(2026,6,1);draft.date=ccDate;draft.dirty=true;ccSelected='2026-07-06';draft.selected=ccSelected;ccRefreshGrid()");
  elem('cc-edit').innerHTML='previous selection';
  const grid=elem('cc-grid');
  const month=elem('cc-month');
  for(const [direction,label,dayCount] of [[1,'agosto de 2026',31],[-1,'julho de 2026',31],[-1,'junho de 2026',30]]){
   run("ccMove("+direction+")");
   assert.equal(month.textContent,label);
   assert.equal((grid.innerHTML.match(/class="btn-ghost cc-day/g)||[]).length,dayCount);
   assert.equal((grid.innerHTML.match(/class="cc-empty-day"/g)||[]).length,42-dayCount);
   assert.equal(elem('cc-edit').innerHTML,'');
   assert.equal(run("draft.dirty"),true);
   assert.equal(run("draft.selected"),'');
  }
 }
});

const lessonCode=readFileSync('js/admin-calendar-lessons.js','utf8');
function setupUnified(group=false){
 const {run,ctx}=setup({group});vm.runInContext(lessonCode,ctx);return {run,ctx};
}
test('unified calendar suggests chronological title and next habitual date',()=>{
 const {run}=setupUnified();
 run("ctx.lessons.push({id:'a',student_id:'s1',lesson_date:'2026-11-09',title:'Class #1'},{id:'b',student_id:'s1',lesson_date:'2026-11-23',title:'Class #2'})");
 assert.equal(run("ccLessonNumber(ctx,'2026-11-16')"),'Class #2');
 assert.equal(run("ccNextLessonDate(ctx,draft)"),'2026-11-30');
 run("draft.payloads.s1.events['2026-11-30']={skip:true}");
 assert.equal(run("ccNextLessonDate(ctx,draft)"),'2026-12-07');
 run("ccLessonMap(ctx).set('2026-11-16',{date:'2026-11-16',automatic:true,files:[]})");
 assert.equal(run("ccLessonNumber(ctx,'2026-11-30')"),'Class #4');
});
test('group numbering counts common historic dates once and never counts separate individual dates',()=>{
 const {run}=setupUnified(true);
 run("ctx.lessons.push({student_id:'s1',lesson_date:'2026-11-09',title:'Class #1',topic:'Intro'},{student_id:'s2',lesson_date:'2026-11-09',title:'Class #1',topic:'Intro'},{student_id:'s1',lesson_date:'2026-11-16',title:'Class #2',topic:'Extra'},{student_id:'s1',group_id:'g1',lesson_date:'2026-11-23',title:'Class #2'},{student_id:'s2',group_id:'g1',lesson_date:'2026-11-23',title:'Class #2'})");
 assert.equal(run("ccLessonNumber(ctx,'2026-11-30')"),'Class #3');
});
test('material form appears only for realized sessions and targets present group members',()=>{
 const {run}=setupUnified(true);
 assert.equal(run("ccLessonForm(ctx,draft,'2026-11-23',ccDateState(ctx,draft,'2026-11-23'))"),'');
 run("ccStageGroupDate(ctx,draft,'2026-11-23','done',{},'18:00','','');ccStageGroupDate(ctx,draft,'2026-11-23','done',{s1:'absent',s2:'inherit'},'18:00','','',true)");
 const html=run("ccLessonForm(ctx,draft,'2026-11-23',ccDateState(ctx,draft,'2026-11-23'))");
 assert.match(html,/Class #1/);assert.match(html,/Slides compartilhados/);
 assert.match(html,/Arraste e solte os materiais aqui/);assert.match(html,/Two/);assert.doesNotMatch(html,/One/);assert.doesNotMatch(html,/Adicionar ao próximo salvamento/);
});
test('lesson drafts refuse save when the underlying class is not completed',()=>{
 const {run}=setupUnified();
 run("ccLessonMap(ctx).set('2026-11-23',{date:'2026-11-23',automatic:true,files:[]})");
 assert.throws(()=>run("ccValidateLessonDrafts(ctx,draft)"),/Realizada/);
});
test('flush sends explicit manual titles and preserves attendance boundary',async()=>{
 const {run,ctx}=setupUnified(true);ctx.calls=[];
 ctx.sb={rpc:async(name,args)=>{ctx.calls.push({name,args});return {}}};
 run("ccStageGroupDate(ctx,draft,'2026-11-23','done',{},'18:00','','');ccStageGroupDate(ctx,draft,'2026-11-23','done',{s1:'absent',s2:'inherit'},'18:00','','',true);ccLessonMap(ctx).set('2026-11-23',{date:'2026-11-23',automatic:false,title:'Class #12',topic:'Topic',files:[]})");
 await run("ccFlushLessons(ctx,draft)");
 assert.equal(ctx.calls[0].name,'portal_calendar_lesson_save');
 assert.deepEqual(Array.from(ctx.calls[0].args.p_members),['s2']);
 assert.equal(ctx.calls[0].args.p_title,'Class #12');
 assert.equal(run("ccLessonMap(ctx).size"),0);
});

test('drag upload keeps the original file classification rules and permits correction',()=>{
 const {run}=setupUnified();
 assert.equal(run("inferQuickResourceType('Report - Class 39 - Ana.pdf')"),'rep');
 assert.equal(run("inferQuickResourceType('39 - Conversation.pdf')"),'ppt');
 assert.equal(run("inferQuickResourceType('Conversation.pptx')"),'ppt');
 assert.equal(run("inferQuickResourceType('Practice.docx')"),'ex');
 assert.equal(run("inferQuickResourceType('Reading.pdf')"),'pdf');
 const html=run("ccLessonFilesHtml({files:[{file:{name:'Report - Class 39.pdf'},type:'rep'}]},ctx,['s1'])");
 assert.match(html,/value="rep" selected/);
 assert.match(html,/ccChangeLessonFileType/);
 assert.doesNotMatch(html,/Destinatário do relatório/);
});
test('group report requires explicit eligible recipient; shared materials do not',()=>{
 const {run}=setupUnified(true);
 run("ccStageGroupDate(ctx,draft,'2026-11-23','done',{},'18:00','','');ccStageGroupDate(ctx,draft,'2026-11-23','done',{s1:'absent',s2:'inherit'},'18:00','','',true);ccLessonMap(ctx).set('2026-11-23',{date:'2026-11-23',automatic:true,files:[{file:{name:'Report - Class 1.pdf'},type:'rep',student:null}]})");
 const html=run("ccLessonFilesHtml(ccLessonMap(ctx).get('2026-11-23'),ctx,ccLessonTargets(ctx,draft,'2026-11-23'))");
 assert.match(html,/Selecione o aluno/);assert.match(html,/value="s2"/);assert.doesNotMatch(html,/value="s1"/);
 assert.throws(()=>run("ccValidateLessonDrafts(ctx,draft)"),/Escolha um integrante presente/);
 run("ccLessonMap(ctx).get('2026-11-23').files[0].student='s1'");
 assert.throws(()=>run("ccValidateLessonDrafts(ctx,draft)"),/Escolha um integrante presente/);
 run("ccLessonMap(ctx).get('2026-11-23').files[0].student='s2'");
 assert.doesNotThrow(()=>run("ccValidateLessonDrafts(ctx,draft)"));
});

test('one drop stages mixed file types automatically without an extra add-to-save button',()=>{
 const {run,ctx}=setupUnified();
 const elements=new Map([['cc-lesson-title',{value:'Class #1'}],['cc-lesson-topic',{value:'Topic'}],['cc-lesson-auto',{checked:true}],['cc-lesson-files',{innerHTML:''}]]);
 ctx.document={getElementById:id=>elements.get(id)||null};
 run("ccSelected='2026-11-23';draft.payloads.s1.events['2026-11-23']={status:'done'};ccAddLessonFiles([{name:'01 - slides.pdf'},{name:'Report - Class 1.pdf'},{name:'Practice.docx'}])");
 assert.equal(run("ccLessonMap(ctx).get(ccSelected).files.map(r=>r.type).join(',')"),'ppt,rep,ex');
 assert.equal(run("draft.dirty"),true);
 assert.match(elements.get('cc-lesson-files').innerHTML,/Report - Class 1.pdf/);
 run("ccChangeLessonFileType(2,'pdf');ccRemoveLessonFile(0)");
 assert.equal(run("ccLessonMap(ctx).get(ccSelected).files.map(r=>r.type).join(',')"),'rep,pdf');
});

test('automatic numbering is a compact checkbox immediately after the editable title',()=>{
 const {run}=setupUnified();
 run("draft.payloads.s1.events['2026-11-23']={status:'done'}");
 const html=run("ccLessonForm(ctx,draft,'2026-11-23',ccDateState(ctx,draft,'2026-11-23'))");
 assert.match(html,/<label class="cc-lesson-number-toggle"><input type="checkbox" id="cc-lesson-auto" checked onchange="ccLessonAuto\(\)">/);
 assert.ok(html.indexOf('id="cc-lesson-title"')<html.indexOf('id="cc-lesson-auto"'));
 assert.ok(html.indexOf('id="cc-lesson-auto"')<html.indexOf('id="cc-lesson-topic"'));
 const css=readFileSync('admin-crm.css','utf8');
 assert.match(css,/\.cc-lesson-number-toggle input\[type="checkbox"\]\{[^}]*width:15px;height:15px/);
});

test('both calendar contexts share a responsive grid for habitual schedule and changes',()=>{
 const markup=readFileSync('js/admin-calendar-test.js','utf8');
 const css=readFileSync('admin-crm.css','utf8');
 assert.match(markup,/<div class="cc-schedule-grid"><section class="box cc-schedule-card cc-schedule-base"><h3>Horário habitual<\/h3>/);
 assert.match(markup,/<\/section><section class="box cc-schedule-card cc-schedule-changes"><h3>Alterações de horário habitual<\/h3>/);
 assert.match(markup,/<\/section><\/div><\/details><div class="box" id="cc-annual">/);
 assert.match(css,/\.cc-schedule-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,460px\),1fr\)\)/);
 assert.match(css,/\.cc-schedule-card \.cc-schedule-fields>label\{min-width:0/);
});

for(const group of [false,true])test((group?'group':'individual')+': registered lesson actions, staged deletion and undo',async()=>{
 const {run,ctx}=setupUnified(group);ctx.calls=[];
 ctx.sb={from:()=>({select(){return this},in(){return this},async limit(){return {data:[]}}}),rpc:async(name,args)=>{ctx.calls.push({name,args});return {data:3}}};
 run((group?"tgSelected.calendarLessons.push({id:'one',student_id:'s1',group_id:'g1',lesson_date:'2026-11-23',title:'Class #1'},{id:'two',student_id:'s2',group_id:'g1',lesson_date:'2026-11-23',title:'Class #1'});":"currentLessons.push({id:'one',student_id:'s1',lesson_date:'2026-11-23',title:'Class #1'});")+"ctx=ccContext();ccSelected='2026-11-23';ccEditor=()=>{};");
 const html=run("ccLessonForm(ctx,draft,ccSelected,ccDateState(ctx,draft,ccSelected))");
 assert.match(html,/>Editar aula<\/button>/);assert.match(html,/>Excluir aula<\/button>/);
 run("ccStageLessonDelete()");
 assert.equal(ctx.calls.length,0);
 assert.equal(run("ccLessonMap(ctx).get(ccSelected).deleteIds.join(',')"),group?'one,two':'one');
 assert.match(run("ccLessonForm(ctx,draft,ccSelected,ccDateState(ctx,draft,ccSelected))"),/Desfazer exclusão/);
 assert.equal(run("ccDateState(ctx,draft,ccSelected).status"),'');
 assert.equal(run("ccDateState(ctx,draft,'2026-11-30').status"),'planned');
 run("ccUndoLessonDelete()");assert.equal(run("ccLessonMap(ctx).size"),0);
 assert.equal(run("ccDateState(ctx,draft,ccSelected).rows[0].status"),'done');
 run("ccStageLessonDelete();ccValidateLessonDrafts(ctx,draft);ccRender=()=>{};ccLoadCloud=async()=>{};tgLoad=async()=>{};loadLessonsFor=async()=>{};");
 await run("ccSaveAll()");
 assert.equal(ctx.calls.length,1);
 assert.equal(ctx.calls[0].name,'portal_calendar_save_with_deletions');
 assert.deepEqual(Array.from(ctx.calls[0].args.p_deletions[0].ids),group?['one','two']:['one']);
 assert.equal(ctx.calls[0].args.p_deletions[0].date,'2026-11-23');
 for(const c of ctx.calls[0].args.p_changes)assert.equal(c.payload.events['2026-11-23'].skip,true);
 if(group)assert.equal(ctx.calls[0].args.p_schedule.calendar_events['2026-11-23'].skip,true);
 assert.equal(run("ccLessonMap(ctx).size"),0);
});
test('historical group editing and deletion require an unambiguous matching session',()=>{
 const {run}=setupUnified(true);
 run("ctx.lessons.push({id:'one',student_id:'s1',lesson_date:'2026-11-23',title:'Class #1',topic:'Intro'},{id:'two',student_id:'s2',lesson_date:'2026-11-23',title:'Class #1',topic:'Intro'})");
 assert.equal(run("ccLessonCanManage(ctx,'2026-11-23')"),true);
 run("ctx.lessons.push({id:'extra',student_id:'s1',lesson_date:'2026-11-23',title:'Extra'})");
 assert.equal(run("ccLessonCanManage(ctx,'2026-11-23')"),false);
});
test('delete RPC checks administrative authorization and exact lesson IDs before deleting and renumbering',()=>{
 const sql=readFileSync('supabase-calendar-lesson-numbering.sql','utf8');
 const body=sql.slice(sql.indexOf('create or replace function public.portal_calendar_lesson_delete'),sql.indexOf('create or replace function public.portal_calendar_save_with_deletions'));
 assert.match(body,/security invoker/);assert.match(body,/not coalesce\(public\.is_admin\(\),false\)/);
 assert.match(body,/ids <@ p_ids and p_ids <@ ids/);assert.match(body,/delete from public\.lessons where id=any\(ids\)/);
 assert.match(body,/portal_calendar_resequence/);assert.doesNotMatch(body,/delete from storage/);
});

test('atomic lesson deletion failure leaves original calendar and deletion draft intact',async()=>{
 const {run,ctx}=setupUnified();
 ctx.sb={from:()=>({select(){return this},in(){return this},async limit(){return {data:[]}}}),rpc:async()=>({error:new Error('revision conflict')})};
 run("currentLessons.push({id:'one',student_id:'s1',lesson_date:'2026-11-23',title:'Class #1'});ctx=ccContext();ccSelected='2026-11-23';ccEditor=()=>{};ccStageLessonDelete();");
 await run("ccSaveAll()");
 assert.equal(run("ccLessonMap(ctx).size"),1);
 assert.equal(run("ccDrafts.get(ctx.key).dirty"),true);
 assert.equal(run("ccRead('s1').events['2026-11-23']"),undefined);
 run("ccUndoLessonDelete()");
 assert.equal(run("ccDateState(ctx,ccDraft(ctx),'2026-11-23').status"),'done');
});
test('prospective deletion removes manual completion and writes an exception without changing other dates',()=>{
 const {run}=setupUnified();
 run("currentLessons.push({id:'one',student_id:'s1',lesson_date:'2026-11-23',title:'Class #1'});ctx=ccContext();ccSelected='2026-11-23';draft.payloads.s1.events[ccSelected]={status:'done'};draft.payloads.s1.events['2026-11-30']={status:'planned'};ccEditor=()=>{};ccStageLessonDelete();var projected=ccProjectLessonDeletions(ctx,draft);");
 assert.equal(run("projected.payloads.s1.events['2026-11-23'].skip"),true);
 assert.equal(run("ccManualDoneDates(projected.payloads.s1).length"),0);
 assert.equal(run("projected.payloads.s1.events['2026-11-30'].status"),'planned');
 assert.equal(run("draft.payloads.s1.events['2026-11-23'].status"),'done');
});
test('deletion SQL wraps exact scoped deletion and revision-checked calendar saves in one function',()=>{
 const sql=readFileSync('supabase-calendar-lesson-numbering.sql','utf8');
 const body=sql.slice(sql.indexOf('create or replace function public.portal_calendar_save_with_deletions'),sql.indexOf('create or replace function public.portal_calendar_lesson_save'));
 assert.match(body,/security invoker/);assert.match(body,/Missing calendar deletion/);assert.match(body,/Other lesson on this date/);
 assert.match(body,/portal_calendar_lesson_delete\(p_group,p_student,day,ids\)/);
 assert.match(body,/portal_group_calendar_save\(p_group,p_schedule,p_changes\)/);
 assert.match(body,/save_admin_calendar\(p_student::text/);
});

test('isolated demo persists deletion and mirrors an empty group date into both individual calendars',async()=>{
 const {randomUUID}=await import('node:crypto');
 const c=vm.createContext({console,crypto:{randomUUID},window:{addEventListener(){}},document:{getElementById(){return null}},alert(){},confirm:()=>true});
 vm.runInContext(code+'\n'+lessonCode+'\n'+readFileSync('js/calendar-preview-demo.js','utf8').replace('(async()=>{await ccLoadCloud();demoSelect(false)})();',''),c);
 const run=s=>vm.runInContext(s,c);
 await run("ccLoadCloud();");
 run("ccRender=()=>{};ccEditor=()=>{};ccRefreshGrid=()=>{};tgGroups=[demoGroup];tgSelected=demoGroup;currentView='turmas';tgTab='calendar';demoRefresh();ccSelected='2026-11-19';ccStageLessonDelete();");
 await run("ccSaveAll()");
 assert.equal(run("demoLessons.filter(l=>l.group_id===demoGroup.id&&l.lesson_date==='2026-11-19').length"),0);
 assert.equal(run("ccDateState(ccContext(),ccDraft(),'2026-11-19').status"),'');
 assert.equal(run("ccDateState(ccContext(),ccDraft(),'2026-11-26').status"),'done');
 for(const id of ['demo-2','demo-3']){
  run("currentView='student';currentTab='calendario';currentStudent=students.find(s=>s.id==='"+id+"');demoRefresh()");
  assert.equal(run("ccRead(currentStudent.id).events['2026-11-19'].skip"),true);
  assert.equal(run("ccDateState(ccContext(),ccDraft(),'2026-11-19').status"),'');
 }
 run("currentStudent=students[0];demoRefresh();ccSelected='2026-11-19';ccStageLessonDelete();");
 await run("ccSaveAll()");
 assert.equal(run("demoLessons.filter(l=>l.student_id==='demo-1'&&l.lesson_date==='2026-11-19').length"),0);
 assert.equal(run("ccDateState(ccContext(),ccDraft(),'2026-11-19').status"),'');
 assert.equal(run("demoLessons.find(l=>l.student_id==='demo-1'&&l.lesson_date==='2026-11-26').title"),'Class #1');
});

test('habitual schedule settings are collapsed by default and contain the original cards',()=>{
 const {run,ctx}=setupUnified();const elements=new Map();
 const elem=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',querySelector:q=>elem(q.slice(1))});return elements.get(id)};
 ctx.document={getElementById:elem,querySelectorAll:()=>[]};
 run("ccRender()");
 assert.match(elem('tab-content').innerHTML,/<details class="cc-schedule-settings" id="cc-schedule-settings"  ontoggle=/);
 assert.match(elem('tab-content').innerHTML,/Configurar horário habitual/);
 run("draft.scheduleOpen=true;ccRender()");
 assert.match(elem('tab-content').innerHTML,/<details class="cc-schedule-settings" id="cc-schedule-settings" open/);
});
test('quick actions depend on date state and keep full status controls accessible',()=>{
 const {run}=setupUnified();
 const planned=run("ccQuickDayActions(ctx,{status:'planned',real:false})");
 for(const label of ['Realizar aula','Registrar falta','Reagendar','Excluir registro','Falta com reposição','Falta sem reposição'])assert.match(planned,new RegExp(label));
 assert.doesNotMatch(run("ccQuickDayActions(ctx,{status:'',real:false})"),/Reagendar|Excluir registro/);
 assert.equal(run("ccQuickDayActions(ctx,{status:'done',real:true})"),'');
 const group=setupUnified(true);
 assert.match(group.run("ccQuickDayActions(ctx,{status:'planned',real:false})"),/Falta de todos os integrantes/);
});
test('registered lesson consultation hides edit fields by default, shows title and unique shared files, and can enter and leave editing',()=>{
 const {run}=setupUnified(true);
 run("ctx.lessons.push({id:'a',student_id:'s1',group_id:'g1',lesson_date:'2026-11-23',title:'Class #7',topic:'Conversation',resources:[{type:'ppt',name:'Slides.pdf',file_path:'group/slides.pdf'}]},{id:'b',student_id:'s2',group_id:'g1',lesson_date:'2026-11-23',title:'Class #7',topic:'Conversation',resources:[{type:'ppt',name:'Slides.pdf',file_path:'group/slides.pdf'}]});");
 const expression="ccLessonForm(ctx,draft,'2026-11-23',ccDateState(ctx,draft,'2026-11-23'))";
 const view=run(expression);
 assert.match(view,/<h3>Conversation<\/h3><p>Class #7<\/p>/);
 assert.match(view,/id="cc-lesson-edit-fields" hidden/);
 assert.equal((view.split('id="cc-lesson-edit-fields"')[0].match(/Slides\.pdf/g)||[]).length,1);
 run("draft.editLessonDate='2026-11-23'");
 const edit=run(expression);
 assert.doesNotMatch(edit,/id="cc-lesson-edit-fields" hidden/);
 assert.match(edit,/Concluir edição/);assert.match(edit,/id="cc-lesson-title"/);
 run("draft.editLessonDate=''");
 assert.match(run(expression),/id="cc-lesson-edit-fields" hidden/);
});
