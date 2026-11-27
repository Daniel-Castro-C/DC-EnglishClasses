import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const code=['js/admin-calendar-test.js','js/admin-turmas-preview.js','js/admin-calendar-lessons.js','js/admin-weekly-planning.js'].map(p=>readFileSync(p,'utf8')).join('\n');
function setup(){
 const alerts=[],c=vm.createContext({console,window:{addEventListener(){}},document:{getElementById(){return null}},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),students:[
 {id:'a',full_name:'Alice',lesson_weekday:1,lesson_time:'18:00'},
 {id:'b',full_name:'Bruno',lesson_weekday:4,lesson_time:'21:00'},
 {id:'c',full_name:'Carla',lesson_weekday:4,lesson_time:'21:00'},
 {id:'test',full_name:'Teste',lesson_weekday:1,lesson_time:'15:00',is_test_profile:true}
 ],localStorage:{getItem(){return null}},adminToday:()=>({date:'2026-11-26'}),alert:s=>alerts.push(s),confirm:()=>true,crypto:webcrypto,File,Blob,formatDate:d=>d});
 vm.runInContext(code,c);
 vm.runInContext(`
  ccCloudReady=true;
  tgGroups=[{id:'g',name:'Bruno e Carla',members:['b','c'],start:'2026-11-01',days:'4',time:'21:00',calendar_events:{},calendarLessons:[]}];
  ccCloud.set('a',{payload:{start:'2026-11-01',weekdays:'1',time:'18:00',events:{'2026-11-23':{status:'rescheduled',rescheduled_to:'2026-11-24'},'2026-11-24':{status:'planned',rescheduled_from:'2026-11-23'},'2026-11-25':{status:'planned',time:'15:00',original:'2026-11-16'},'2026-11-27':{status:'absent'}}}});
  ccCloud.set('global',{payload:[{start:'2026-11-30',end:'2026-11-30',status:'holiday'}]});
  var plan={subject_type:'student',subject_id:'a',lesson_date:'2026-11-23',topic:'<script>unsafe</script>',ready:true,files:[]};
  var entries=crmPlanEntries('2026-11-23',[],[plan]);
 `,c);
 return {run:s=>vm.runInContext(s,c),c,alerts};
}
test('weeks start on Monday and handle month/year rollover without timezone shifts',()=>{
 const {run}=setup();
 assert.equal(run("crmPlanMonday('2026-11-29')"),'2026-11-23');
 assert.equal(run("crmPlanMonday('2027-01-01')"),'2026-12-28');
 assert.equal(run("crmPlanShift('2026-12-28',6)"),'2027-01-03');
});
test('weekly agenda includes moved and replacement classes, excludes absent, groups once, retains orphan plans',()=>{
 const {run}=setup();
 assert.equal(run("entries.length"),4);
 assert.equal(run("entries.find(e=>e.lesson_date==='2026-11-23').scheduled"),false);
 assert.equal(run("entries.find(e=>e.lesson_date==='2026-11-24').subject_id"),'a');
 assert.equal(run("entries.find(e=>e.lesson_date==='2026-11-25').time"),'15:00');
 assert.equal(run("entries.filter(e=>e.subject_type==='group').length"),1);
 assert.equal(run("entries.find(e=>e.subject_type==='group').name"),'Bruno e Carla');
 assert.equal(run("entries.some(e=>e.subject_id==='test'||e.lesson_date==='2026-11-27')"),false);
 assert.equal(run("crmPlanEntries('2026-11-30',[],[]).some(e=>e.lesson_date==='2026-11-30')"),false);
 const html=run("crmPlanRowsHtml(entries)");
 assert.match(html,/Fora da agenda atual/);assert.match(html,/&lt;script&gt;unsafe/);assert.doesNotMatch(html,/<script>/);
});
test('registered status, group cancellation, and attendance override follow source calendar',()=>{
 const {run}=setup();
 run("tgGroups[0].calendar_events['2026-11-26']={status:'absent',time:'21:00'}");
 assert.equal(run("crmPlanEntries('2026-11-23',[],[]).some(e=>e.subject_type==='group')"),false);
 run("tgGroups[0].calendar_events['2026-11-26']={status:'done',time:'21:00'};ccCloud.set('b',{payload:{events:{'2026-11-26':{group_id:'g',attendance_override:'absent',status:'absent'}}}})");
 assert.equal(run("crmPlanEntries('2026-11-23',[{student_id:'c',group_id:'g',lesson_date:'2026-11-26',calendar_status:'done'}],[]).find(e=>e.subject_type==='group').registered"),true);
});
test('planned attachments use the existing classification and a random private path, with size limits',()=>{
 const {run}=setup();
 assert.equal(run("crmPlanFileMeta(plan,new File(['test'],'Report - Class 3.pdf')).type"),'rep');
 assert.equal(run("crmPlanFileMeta(plan,new File(['x'],'12 - slides.pdf')).type"),'ppt');
 assert.equal(run("crmPlanFileMeta(plan,new File(['x'],'exercises.docx')).type"),'ex');
 assert.match(run("crmPlanFileMeta(plan,new File(['x'],'../../unsafe.pdf')).path"),/^student\/a\/2026-11-23\/[\da-f-]{36}$/);
 assert.equal(run("crmPlanValidFile({size:52428801})"),false);
 assert.equal(run("crmPlanValidFile({size:0})"),false);
});
test('private planner uses optimistic revision checks instead of unconditional upserts',async()=>{
 const {run,c}=setup(),calls=[];
 c.sb={from(name){calls.push(['table',name]);return {update(row){calls.push(['update',row]);return this},eq(k,v){calls.push(['eq',k,v]);return this},select(){return this},async maybeSingle(){return {data:null}}}}};
 await assert.rejects(run("crmPlanDatabase().save(plan,{...plan,revision:3})"),/outra sessão/);
 assert.ok(calls.some(a=>a[0]==='eq'&&a[1]==='revision'&&a[2]===3));
 assert.equal(calls[0][1],'portal_lesson_plans');
});
function importFixture(){
 const {run,c,alerts}=setup(),button={disabled:false,isConnected:true},topic={value:''},draftMap=new Map(),calendarDraft={};
 c.button=button;c.document={getElementById:id=>id==='cc-lesson-topic'?topic:null};
 c.calendarDraft=calendarDraft;c.draftMap=draftMap;c.rendered=0;c.currentView='student';c.currentTab='calendario';c.currentLessons=[];c.currentStudent=c.students[0];
 run(`ccSelected='2026-11-24';ccDraft=()=>calendarDraft;ccLessonMap=()=>draftMap;ccDateState=()=>({event:{rescheduled_from:'2026-11-23'},rows:[]});ccCaptureLesson=()=>{const previous=draftMap.get(ccSelected)||{files:[]};draftMap.set(ccSelected,{...previous,topic:document.getElementById('cc-lesson-topic').value});calendarDraft.dirty=true;};ccRenderLessonFiles=()=>rendered++;`);
 return {run,c,alerts,button,topic,draftMap,calendarDraft};
}
test('import fetches original planning for a moved lesson, keeps files private and deduplicates repeated import',async()=>{
 const {run,c,draftMap,topic,calendarDraft}=importFixture(),calls=[];
 c.repo={async get(p){calls.push(p.lesson_date);return p.lesson_date==='2026-11-23'?{topic:'Conversation',files:[{path:'student/a/2026-11-23/id',name:'slides.pptx',size:1,type:'ppt'}]}:null},async download(){return new Blob(['x'])}};
 await run("crmImportLessonPlan(button,repo)");
 await run("crmImportLessonPlan(button,repo)");
 assert.deepEqual(calls,['2026-11-24','2026-11-23','2026-11-24','2026-11-23']);
 assert.equal(topic.value,'Conversation');assert.equal(calendarDraft.dirty,true);
 assert.equal(draftMap.get('2026-11-24').files.length,1);
 assert.equal(draftMap.get('2026-11-24').files[0].file.name,'slides.pptx');
 assert.equal(draftMap.get('2026-11-24').files[0].type,'ppt');
});
test('import failure is non-destructive and does not stage a partial lesson',async()=>{
 const {run,c,alerts,topic,calendarDraft,draftMap}=importFixture();c.console={error(){}};
 c.repo={async get(){return {topic:'Conversation',files:[{path:'x',name:'a.pdf',size:1},{path:'y',name:'b.pdf',size:1}]}},async download(path){if(path==='y')throw Error('offline');return new Blob(['x']);}};
 await run("crmImportLessonPlan(button,repo)");
 assert.equal(topic.value,'');assert.equal(calendarDraft.dirty,undefined);assert.equal(draftMap.size,0);
 assert.match(alerts.at(-1),/não foi publicada/);
});
test('planner is isolated from student data, shares real home markup and exposes explicit import only on lesson form',()=>{
 const sql=readFileSync('supabase-weekly-lesson-planning.sql','utf8');
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.portal_lesson_plans from public,anon,authenticated/i);
 assert.match(sql,/using \(\(select public\.is_admin\(\)\)\) with check \(\(select public\.is_admin\(\)\)\)/i);
 assert.match(sql,/'lesson-planning','lesson-planning',false/);
 assert.match(sql,/as restrictive for all to public/i);
 for(const file of ['js/admin.js','admin-home-calendar-preview.html'])assert.match(readFileSync(file,'utf8'),/id="crm-weekly-planning"[\s\S]*?crmMountWeeklyPlanning/);
 assert.match(readFileSync('js/admin-calendar-lessons.js','utf8'),/!existing\.length&&typeof crmImportLessonPlan==='function'/);
 assert.doesNotMatch(readFileSync('js/aluno.js','utf8'),/portal_lesson_plans|lesson-planning/);
});
