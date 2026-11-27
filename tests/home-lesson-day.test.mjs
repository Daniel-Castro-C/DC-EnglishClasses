import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
function setup(data,error,decision=true){
 const calls=[],confirmations=[],opened=[],alerts=[];
 const ctx=vm.createContext({URL,confirm:msg=>{confirmations.push(msg);return decision;},window:{open:(...args)=>opened.push(args)},alert:msg=>alerts.push(msg),console:{warn(){}},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),isTestStudentProfile:p=>Boolean(p?.is_test_profile),sb:{async rpc(...args){calls.push(args);return {data,error};}}});
 vm.runInContext(read('js/home-lesson-call.js'),ctx);
 return {run:s=>vm.runInContext(s,ctx),calls,confirmations,opened,alerts};
}
test('day-of-lesson card displays exact requested copy and keeps the secure video link',()=>{
 const {run}=setup(true);
 const html=run("renderHomeLessonCall({days:0,url:'https://meet.example/room'})");
 assert.match(html,/home-lesson-call is-lesson-day/);
 assert.match(html,/<h2>Chegou o dia da sua aula!<\/h2><p>Acesse diretamente a videochamada\.<\/p>/);
 assert.match(html,/href="https:\/\/meet.example\/room" target="_blank" rel="noopener noreferrer"/);
 assert.match(html,/Entrar na videochamada/);
 const normal=run("renderHomeLessonCall({days:3,url:'https://meet.example/room'})");
 assert.doesNotMatch(normal,/is-lesson-day/);
 assert.match(normal,/Faltam 3 dias para a sua aula/);
 assert.match(normal,/data-today="false"/);assert.doesNotMatch(normal,/href=/);
 assert.match(run("renderHomeLessonCall({days:1,demo:true})"),/Falta 1 dia para a sua aula/);
 assert.match(run("renderHomeLessonCall({days:null,demo:true})"),/Nenhuma próxima aula agendada/);
 assert.match(run("renderHomeLessonCall({days:1,lang:'en',demo:true})"),/1 day until your lesson/);
 assert.match(normal,/Acesse diretamente a videochamada da sua aula\./);
 assert.match(run("renderHomeLessonCall({days:0,lang:'en',demo:true})"),/It’s lesson day!/);
 assert.equal(run("renderHomeLessonCall({url:'javascript:alert(1)'})"),'');
 assert.doesNotMatch(run("renderHomeLessonCall({url:'https://meet.example/room',demo:true})"),/href=/);
});
test('home uses the current authenticated student only and distinguishes no lesson from unavailable',async()=>{
 const {run,calls}=setup(3);
 assert.equal(await run("homeNextLessonDays({id:'other',role:'student'})"),3);
 assert.deepEqual(calls,[['student_next_lesson_days']]);
 assert.equal(await run("homeNextLessonDays({role:'student',is_test_profile:true})"),3);
 assert.equal(await run("homeNextLessonDays({role:'admin'})"),undefined);
 assert.equal(calls.length,1);
 assert.equal(await setup(null).run("homeNextLessonDays({role:'student'})"),null);
 assert.equal(await setup(0).run("homeNextLessonDays({role:'student'})"),0);
 assert.equal(await setup(null,new Error('unavailable')).run("homeNextLessonDays({role:'student'})"),undefined);
});
test('off-day call requires confirmation, cancel opens nothing, confirm opens only the validated link',()=>{
 const click="homeOpenLessonCall({dataset:{today:'false',demo:'false',lang:'pt',callUrl:'https://meet.example/room'}})";
 const cancelled=setup(3,null,false);cancelled.run(click);
 assert.deepEqual(cancelled.confirmations,['Não há aula agendada para hoje. Deseja iniciar a chamada mesmo assim?']);
 assert.equal(cancelled.opened.length,0);
 const accepted=setup(3);accepted.run(click);
 assert.deepEqual(accepted.opened,[['https://meet.example/room','_blank','noopener,noreferrer']]);
 accepted.run("homeOpenLessonCall({dataset:{today:'false',demo:'true',lang:'pt'}})");
 assert.equal(accepted.opened.length,1);assert.equal(accepted.alerts.length,1);
});
test('countdown RPC is private, no student ID parameter or arbitrary cutoff, and considers registered statuses and every boundary',()=>{
 const sql=read('supabase-student-next-lesson.sql');
 assert.match(sql,/sid uuid:=auth\.uid\(\)/);
 assert.match(sql,/America\/Sao_Paulo/);
 assert.match(sql,/p\.id=sid and p\.role='student'/);
 assert.match(sql,/l\.student_id=sid and l\.lesson_date>=today/);
 assert.match(sql,/bool_or\(coalesce\(l\.calendar_status,'done'\) in \('planned','done'\)\)/);
 assert.match(sql,/generate_series\(0,6\)/);
 assert.match(sql,/portal_private\.student_next_lesson_days\(\)\s*returns integer language plpgsql stable security definer set search_path=''/);
 assert.match(sql,/public\.student_next_lesson_days\(\)\s*returns integer language sql stable security invoker set search_path=''/);
 assert.match(sql,/revoke all on function public\.student_next_lesson_days\(\) from public,anon/);
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
 assert.match(home,/await homeNextLessonDays\(profile\)/);
 assert.match(home,/renderHomeLessonCall\(/);
 assert.match(home,/Simular dia de aula/);
 assert.match(home,/visibilitychange', refreshLessonDay/);
 assert.match(preview,/js\/home-lesson-call\.js/);
 assert.match(preview,/selectDay\(0\)/);
 assert.match(css,/\.home-lesson-call\.is-lesson-day\{background:/);
 assert.match(css,/body\.dark-mode \.home-lesson-call\.is-lesson-day/);
 assert.match(css,/@media\(max-width:600px\)\{\.home-lesson-call/);
});
test('lesson day adopts the existing navy and sky tokens in the portal palette',()=>{
 const css=read('style.css');
 assert.match(css,/\.home-lesson-call\.is-lesson-day\{background:var\(--sky-soft\);border-color:var\(--sky\)/);
 assert.match(css,/\.home-lesson-call\.is-lesson-day \.home-lesson-call-action\{background:var\(--ink\)/);
});

test('quick access removes duplicate lessons card while onboarding points to the existing hero',()=>{
 const home=read('home.html');
 assert.doesNotMatch(home,/<a class="home-card" href="aluno.html">/);
 assert.match(home,/<a class="dashboard-hero-action" href="aluno.html">/);
 assert.match(home,/\['\.dashboard-hero-action\[href="aluno.html"\]','Minhas aulas'/);
 assert.match(home,/<a class="home-card" href="pergunte-ao-daniel.html">/);
});
