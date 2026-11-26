import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
function setup(data,error){
 const calls=[];
 const ctx=vm.createContext({URL,console:{warn(){}},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),isTestStudentProfile:p=>Boolean(p?.is_test_profile),sb:{async rpc(...args){calls.push(args);return {data,error};}}});
 vm.runInContext(read('js/home-lesson-call.js'),ctx);
 return {run:s=>vm.runInContext(s,ctx),calls};
}
test('day-of-lesson card displays exact requested copy and keeps the secure video link',()=>{
 const {run}=setup(true);
 const html=run("renderHomeLessonCall({today:true,url:'https://meet.example/room'})");
 assert.match(html,/home-lesson-call is-lesson-day/);
 assert.match(html,/<h2>Chegou o dia da sua aula!<\/h2><p>Acesse diretamente a videochamada\.<\/p>/);
 assert.match(html,/href="https:\/\/meet.example\/room" target="_blank" rel="noopener noreferrer"/);
 assert.match(html,/Entrar na videochamada/);
 const normal=run("renderHomeLessonCall({today:false,url:'https://meet.example/room'})");
 assert.doesNotMatch(normal,/is-lesson-day/);
 assert.match(normal,/Sua aula online/);
 assert.match(normal,/Acesse diretamente a videochamada da sua aula\./);
 assert.match(run("renderHomeLessonCall({today:true,lang:'en',demo:true})"),/It’s lesson day!/);
 assert.equal(run("renderHomeLessonCall({url:'javascript:alert(1)'})"),'');
 assert.doesNotMatch(run("renderHomeLessonCall({url:'https://meet.example/room',demo:true})"),/href=/);
});
test('home uses the current authenticated account only, not client-supplied identifiers or test profiles',async()=>{
 const {run,calls}=setup(true);
 assert.equal(await run("homeHasLessonToday({id:'other',role:'student'})"),true);
 assert.deepEqual(calls,[['student_has_lesson_today']]);
 assert.equal(await run("homeHasLessonToday({role:'student',is_test_profile:true})"),false);
 assert.equal(await run("homeHasLessonToday({role:'admin'})"),false);
 assert.equal(calls.length,1);
 const unavailable=setup(null,new Error('unavailable'));
 assert.equal(await unavailable.run("homeHasLessonToday({role:'student'})"),false);
});
test('SQL resolves the current day in Brazil and keeps privileged calendar lookup private',()=>{
 const sql=read('supabase-student-lesson-day.sql');
 assert.match(sql,/sid uuid:=auth\.uid\(\)/);
 assert.match(sql,/America\/Sao_Paulo/);
 assert.match(sql,/where p\.id=sid and p\.role='student'/);
 assert.match(sql,/where l\.student_id=sid and l\.lesson_date=today/);
 assert.match(sql,/where s\.calendar_key=sid::text/);
 assert.match(sql,/where sid=any\(g\.members\)/);
 assert.match(sql,/attendance_override/);
 assert.match(sql,/portal_private\.student_has_lesson_today\(\)\s*returns boolean language plpgsql stable security definer set search_path=''/);
 assert.match(sql,/public\.student_has_lesson_today\(\)\s*returns boolean language sql stable security invoker set search_path=''/);
 assert.match(sql,/revoke all on function public\.student_has_lesson_today\(\) from public,anon/);
 assert.doesNotMatch(sql,/create policy|alter table/);
});
test('calendar exception precedence and all 2027 holiday dates match administrative calendar',()=>{
 const sql=read('supabase-student-lesson-day.sql'),admin=read('js/admin-calendar-test.js');
 const dates=[...admin.matchAll(/\['(2027-\d{2}-\d{2})','[^']+'\]/g)].map(m=>m[1]);
 assert.equal(dates.length,10);
 for(const date of dates) assert.ok(sql.includes(date),date);
 assert.match(sql,/p_event->>'skip','false'\)<>'true'/);
 assert.match(sql,/p_event->>'status' in \('planned','done'\)/);
 assert.match(sql,/coalesce\(p_habitual,false\) and not coalesce\(p_unavailable,false\)/);
 assert.match(sql,/e->>'status' in \('holiday','break'\)/);
 assert.match(sql,/e->>'disabled'='true'/);
 assert.match(sql,/p_schedule->'changes'/);
});
test('same component and styling in preview and actual Home; responsive and dark themes',()=>{
 const home=read('home.html'),preview=read('home-lesson-preview.html'),css=read('style.css');
 assert.match(home,/await homeHasLessonToday\(profile\)/);
 assert.match(home,/renderHomeLessonCall\(/);
 assert.match(home,/Simular dia de aula/);
 assert.match(home,/visibilitychange', refreshLessonDay/);
 assert.match(preview,/js\/home-lesson-call\.js/);
 assert.match(preview,/selectDay\(true\)/);
 assert.match(css,/\.home-lesson-call\.is-lesson-day\{background:/);
 assert.match(css,/body\.dark-mode \.home-lesson-call\.is-lesson-day/);
 assert.match(css,/@media\(max-width:600px\)\{\.home-lesson-call/);
});
