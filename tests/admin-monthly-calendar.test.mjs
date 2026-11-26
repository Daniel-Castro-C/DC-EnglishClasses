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
