import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const code=['js/admin-calendar-test.js','js/admin-turmas-preview.js','js/admin-monthly-calendar.js'].map(p=>readFileSync(p,'utf8')).join('\n');
function setup(){
 const c=vm.createContext({console,window:{addEventListener(){}},document:{getElementById(){return null}},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),students:[
  {id:'one',full_name:'Aluno A',lesson_weekday:1,lesson_time:'18:00'},
  {id:'two',full_name:'Aluno B',lesson_weekday:4,lesson_time:'21:00'},
  {id:'three',full_name:'Aluno C',lesson_weekday:4,lesson_time:'21:00'},
  {id:'test',full_name:'Teste',lesson_weekday:1,lesson_time:'15:00',is_test_profile:true}
 ],localStorage:{getItem(){return null}},adminToday:()=>({date:'2026-11-26'})});
 vm.runInContext(code,c);
 vm.runInContext(`
  ccCloudReady=true;
  tgGroups=[{id:'g',members:['two','three'],start:'2026-11-01',days:'4',time:'21:00',calendar_events:{'2026-11-19':{status:'planned',time:'20:00'},'2026-11-26':{skip:true}},calendarLessons:[]}];
  ccCloud.set('one',{payload:{start:'2026-11-01',weekdays:'1',time:'18:00',changes:[{from:'2026-11-23',weekdays:'2',time:'19:00'}],events:{'2026-11-09':{status:'rescheduled',rescheduled_to:'2026-11-10'},'2026-11-10':{status:'planned',time:'20:00',rescheduled_from:'2026-11-09'},'2026-11-16':{skip:true},'2026-11-27':{status:'planned',time:'17:00',original:'2026-11-16'}}}});
  ccCloud.set('two',{payload:{events:{'2026-11-19':{status:'absent',group_id:'g',attendance_override:'absent'}}}});
  ccCloud.set('global',{payload:[{start:'2026-11-05',end:'2026-11-05',status:'holiday'}]});
  var lessonRows=[{student_id:'one',lesson_date:'2026-11-07',calendar_status:null},{student_id:'one',lesson_date:'2026-11-03',calendar_status:'teacher'}];
  var entries=crmMonthlyEntries('2026-11',lessonRows);
 `,c);
 return {run:s=>vm.runInContext(s,c),c};
}
test('monthly agenda uses habitual schedule, changes, rescheduling, replacement, skipping and holidays',()=>{
 const {run}=setup();
 assert.equal(run("entries.get('2026-11-02')[0].time"),'18:00');
 assert.equal(run("entries.get('2026-11-09').length"),0);
 assert.equal(run("entries.get('2026-11-10')[0].time"),'20:00');
 assert.equal(run("entries.get('2026-11-16').length"),0);
 assert.equal(run("entries.get('2026-11-23').length"),0);
 assert.equal(run("entries.get('2026-11-24')[0].time"),'19:00');
 assert.equal(run("entries.get('2026-11-27')[0].time"),'17:00');
 assert.equal(run("entries.get('2026-11-05').length"),0);
});
test('group appointments are listed once, attendance overrides are respected, deletion removes the group',()=>{
 const {run}=setup();
 assert.equal(run("entries.get('2026-11-12').length"),1);
 assert.equal(run("entries.get('2026-11-12')[0].names.join(',')"),'Aluno B,Aluno C');
 assert.equal(run("entries.get('2026-11-19')[0].names.join(',')"),'Aluno C');
 assert.equal(run("entries.get('2026-11-19')[0].time"),'20:00');
 assert.equal(run("entries.get('2026-11-26').length"),0);
});
test('registered lessons appear off schedule, non-class statuses are excluded, test profiles never appear',()=>{
 const {run}=setup();
 assert.equal(run("entries.get('2026-11-07')[0].names[0]"),'Aluno A');
 assert.equal(run("entries.get('2026-11-03').length"),0);
 assert.equal(run("[...entries.values()].flat().some(e=>e.names.includes('Teste'))"),false);
});
test('month boundaries, year rollover, leap year and stable 42-cell grid',()=>{
 const {run}=setup();
 assert.equal(run("crmShiftMonth('2026-12',1)"),'2027-01');
 assert.equal(run("crmShiftMonth('2026-01',-1)"),'2025-12');
 assert.equal(run("crmMonthBounds('2028-02').days"),29);
 const html=run("crmMonthlyGrid('2026-11',entries,'2026-11-26')");
 assert.equal((html.match(/class="crm-month-day(?: |")/g)||[]).length,42);
 assert.match(html,/aria-current="date"/);
 assert.match(html,/20:00/);
 assert.doesNotMatch(html,/Reposição|Realizada|Cancelada|Materiais/);
});
test('monthly navigation ignores stale asynchronous responses',async()=>{
 const {run,c}=setup(),elements=new Map(),loads=[];
 const panel={isConnected:true,innerHTML:'',querySelector(sel){if(!elements.has(sel))elements.set(sel,{textContent:'',innerHTML:'',setAttribute(){},addEventListener(_,fn){this.click=fn;}});return elements.get(sel);}};
 c.panel=panel;c.loadLessons=month=>new Promise(resolve=>loads.push({month,resolve}));
 const mount=run("crmMountMonthlyCalendar(panel,Promise.resolve(),loadLessons,'2026-11-26')");
 await Promise.resolve();
 elements.get('.crm-month-next').click();await Promise.resolve();
 assert.equal(loads[0].month,'2026-11');assert.equal(loads[1].month,'2026-12');
 loads[1].resolve([]);await new Promise(r=>setImmediate(r));
 assert.match(elements.get('.crm-month-title').textContent,/dezembro/);
 const rendered=elements.get('.crm-month-content').innerHTML;
 loads[0].resolve([]);await mount;
 assert.equal(elements.get('.crm-month-content').innerHTML,rendered);
});

test('home and isolated preview share the side-by-side compact calendar layout',()=>{
 for(const path of ['js/admin.js','admin-home-calendar-preview.html']){
  const html=readFileSync(path,'utf8');
  assert.match(html,/class="crm-agenda-layout">\s*<section class="crm-panel crm-today-panel">[\s\S]*?<section class="crm-panel crm-month-panel"[^>]*><\/section>\s*<\/div>\s*<div class="crm-lower">/);
 }
 const css=readFileSync('admin-crm.css','utf8');
 assert.match(css,/@media\(min-width:1180px\)\{\.admin-crm \.crm-agenda-layout\{grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,1fr\)/);
 assert.match(css,/\.crm-month-grid\{[^}]*min-width:369px/);
 assert.match(css,/\.crm-month-day\{min-height:45px/);
});

test('daily agenda counts a collective class once and keeps simultaneous unrelated classes separate',()=>{
 const {run}=setup();
 run("students.push({id:'other',full_name:'Outro aluno',lesson_weekday:4,lesson_time:'21:00'}); var daily=crmGroupDailyAgenda(ccAgenda({date:'2026-11-12'},null,true))");
 assert.equal(run('daily.length'),2);
 assert.equal(run("daily.find(d=>d.ccGroupId==='g').full_name"),'Aluno B · Aluno C');
 assert.equal(run("daily.find(d=>d.ccGroupId==='g').lesson_time"),'21:00');
 assert.equal(run("daily.find(d=>d.id==='other').ccGroupId"),null);
});
test('group schedule is authoritative even without individual recurring hours; mixed attendance stays in one row',()=>{
 const {run}=setup();
 run("students[1].lesson_weekday=null;students[1].lesson_time='';students[2].lesson_weekday=null;students[2].lesson_time='';var daily=crmGroupDailyAgenda(ccAgenda({date:'2026-11-19'},null,true))");
 assert.equal(run("daily.length"),1);
 assert.equal(run("daily[0].full_name"),'Aluno B · Aluno C');
 assert.equal(run("daily[0].ccStatus"),'mixed');
 assert.equal(run("daily[0].lesson_time"),'20:00');
 assert.equal(run("crmGroupDailyAgenda(ccAgenda({date:'2026-11-26'},null,true)).length"),0);
});
test('daily group row opens group calendar and deduplicates video links without discarding distinct links',()=>{
 const {run}=setup();
 run("students[1].permanent_lesson_link='https://example.test/room';students[2].permanent_lesson_link='https://example.test/room';var daily=crmGroupDailyAgenda(ccAgenda({date:'2026-11-12'},null,true))");
 const html=run("crmTodayRowsHtml(daily)");
 assert.match(html,/Aluno B · Aluno C/);
 assert.match(html,/tgOpenDate\(&quot;g&quot;,&quot;2026-11-12&quot;\)/);
 assert.doesNotMatch(html,/ccQuickSave/);
 assert.equal((html.match(/openTodayClassCall/g)||[]).length,1);
 run("students[2].permanent_lesson_link='https://example.test/another';daily=crmGroupDailyAgenda(ccAgenda({date:'2026-11-12'},null,true))");
 assert.equal((run("crmTodayRowsHtml(daily)").match(/openTodayClassCall/g)||[]).length,2);
});
test('actual current date has a colored date badge and border, not other days',()=>{
 const {run}=setup();
 const grid=run("crmMonthlyGrid('2026-11',entries,'2026-11-26')");
 assert.equal((grid.match(/is-today/g)||[]).length,1);
 assert.match(grid,/is-today" aria-current="date"><div class="crm-month-day-number">26<\/div>/);
 assert.doesNotMatch(run("crmMonthlyGrid('2026-12',new Map(),'2026-11-26')"),/is-today/);
 assert.match(readFileSync('admin-crm.css','utf8'),/\.crm-month-day\.is-today \.crm-month-day-number\{[^}]*background:#496C97;color:#fff/);
});
test('individual and group daily status use the same select, with safe group attendance options',()=>{
 const {run}=setup();
 const group=run("crmTodayStatus(crmGroupDailyAgenda(ccAgenda({date:'2026-11-19'},null,true))[0])");
 assert.match(group,/<select class="crm-quick-status" data-status="mixed"/);
 assert.match(group,/ccQuickGroupSave/);
 assert.match(group,/value="mixed" selected disabled/);
 assert.match(group,/Falta de todos \(com reposição\)/);
 assert.match(group,/<option value="absent"\s*>Falta sem reposição<\/option>/);
 const individual=run("ccQuickStatus({id:'one',ccStatus:'planned',ccDate:'2026-11-12'})");
 assert.match(individual,/<select class="crm-quick-status"/);
 assert.match(individual,/ccQuickSave/);
 assert.match(run("ccQuickStatus({ccGroupId:'g',ccStatus:'done',ccRegistered:true})"),/disabled title=/);
});
function quickGroupFixture({registered=false,fail=false}={}){
 const {run,c}=setup(),calls=[],alerts=[];
 c.alert=msg=>alerts.push(msg);c.console={error(){}};
 c.select={value:'done',dataset:{status:'mixed'},disabled:false,isConnected:true};
 c.sb={from(){return {select(){return this},in(){return this},eq(){return this},async limit(){return {data:registered?[{id:1}]:[]}}}},async rpc(name,args){calls.push({name,args:JSON.parse(JSON.stringify(args))});return fail?{error:Error('revision conflict')}:{data:1}}};
 c.currentView='turmas';
 run("ccLoadCloud=async()=>{};tgLoad=async()=>{};ccCloud.get('two').revision=4;ccCloud.set('three',{payload:{},revision:5})");
 return {run,c,calls,alerts};
}
test('group quick status saves one atomic transaction and preserves the individual absence and event time',async()=>{
 const {run,c,calls,alerts}=quickGroupFixture();
 await run("ccQuickGroupSave(select,'g','2026-11-19')");
 assert.equal(calls.length,1);assert.equal(calls[0].name,'portal_group_calendar_save');
 const {p_group,p_schedule,p_changes}=calls[0].args;
 assert.equal(p_group,'g');assert.equal(p_schedule.calendar_events['2026-11-19'].status,'done');
 assert.equal(p_schedule.calendar_events['2026-11-19'].time,'20:00');
 assert.deepEqual(p_changes.map(p=>[p.id,p.revision,p.payload.events['2026-11-19'].status]),[['two',4,'absent'],['three',5,'done']]);
 assert.equal(p_changes[0].payload.events['2026-11-19'].attendance_override,'absent');
 assert.equal(alerts.length,0);assert.equal(c.select.disabled,false);
});
test('collective absence marks both members eligible for a shared replacement',async()=>{
 const {run,c,calls}=quickGroupFixture();c.select.value='owed';
 await run("ccQuickGroupSave(select,'g','2026-11-12')");
 assert.equal(calls.length,1);
 const {p_schedule,p_changes}=calls[0].args;
 assert.equal(p_schedule.calendar_events['2026-11-12'].status,'owed');
 assert.deepEqual(p_changes.map(p=>p.payload.events['2026-11-12'].status),['owed','owed']);
});
test('group quick status rejects registered lessons, dirty drafts and failed transaction without replacing committed data',async()=>{
 for(const options of [{registered:true},{dirty:true},{fail:true}]){
  const {run,c,calls,alerts}=quickGroupFixture(options);
  if(options.dirty)run("ccDrafts.set('student:two',{dirty:true,payloads:{two:{}}})");
  await run("ccQuickGroupSave(select,'g','2026-11-19')");
  assert.equal(calls.length,options.fail?1:0);
  assert.equal(c.select.value,'mixed');assert.equal(c.select.disabled,false);
  assert.equal(run("tgGroups[0].calendar_events['2026-11-19'].status"),'planned');
  assert.equal(run("ccRead('two').events['2026-11-19'].status"),'absent');
  assert.equal(alerts.length,1);
 }
});
test('daily agenda links each student to their own profile, including the two members of a group',()=>{
 const {run}=setup();
 const html=run("crmTodayRowsHtml(crmGroupDailyAgenda(ccAgenda({date:'2026-11-12'},null,true)))");
 assert.match(html,/<a class="crm-student-link" href="\?student=two" data-student-id="two"[^>]+>Aluno B<\/a> · <a class="crm-student-link" href="\?student=three" data-student-id="three"[^>]+>Aluno C<\/a>/);
 assert.match(html,/openStudent\(this.dataset.studentId\)/);
 const single=run("crmStudentProfileLinks(students[0])");
 assert.match(single,/href="\?student=one"/);
 assert.match(readFileSync('js/admin.js','utf8'),/new URLSearchParams\(location.search\).get\('student'\)/);
});
test('student recent history contains only the four newest entries (not all six)',()=>{
 const {run}=setup();
 run("var latest=crmStudentHistory(students[2],Array.from({length:6},(_,i)=>({lesson_date:'2026-11-0'+(i+1),title:'Class #'+(i+1),calendar_status:i===5?'owed':'done'})))");
 assert.equal(run('latest.length'),4);
 assert.equal(run('latest.map(r=>r.title).join(",")'),'Class #6,Class #5,Class #4,Class #3');
 assert.equal(run('latest[0].status'),'Falta com reposição');
});

test('home group quick status accepts no-replacement absence and persists the exact status atomically',async()=>{
 const {run,c,calls}=quickGroupFixture();c.select.value='absent';
 await run("ccQuickGroupSave(select,'g','2026-11-12')");
 assert.equal(calls.length,1);
 const {p_schedule,p_changes}=calls[0].args;
 assert.equal(p_schedule.calendar_events['2026-11-12'].status,'absent');
 assert.deepEqual(p_changes.map(p=>p.payload.events['2026-11-12'].status),['absent','absent']);
});
