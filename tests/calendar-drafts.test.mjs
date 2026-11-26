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
