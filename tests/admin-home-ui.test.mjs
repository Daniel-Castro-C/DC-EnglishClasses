import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
const source = path => readFileSync(path,'utf8');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

function fixture(){
 const content={innerHTML:''},nav={innerHTML:''};
 const activity={innerHTML:'',isConnected:true};
 const c=vm.createContext({console,escapeHtml:esc,materialTypeLabel:s=>s,formatDate:s=>s.split('-').reverse().join('/'),window:{addEventListener(){}},document:{getElementById:id=>({'main-content':content,'nav-container':nav,'admin-recent-activity-list':activity}[id]||null)},localStorage:{getItem(){return null}},requireSession:async()=>null});
 for(const p of ['js/admin-calendar-test.js','js/admin-turmas-preview.js','js/admin-home-ui.js','js/admin.js'])vm.runInContext(source(p),c);
 vm.runInContext("students=[{id:'a',full_name:'Ana Silva'},{id:'b',full_name:'Bruno Costa'}];tgGroups=[{id:'g',name:'Ana e Bruno',members:['a','b']}];",c);
 return {c,run:s=>vm.runInContext(s,c),content,nav,activity};
}
test('pending action grid is consistent for individuals, collective members and group actions',()=>{
 const {run}=fixture();
 const html=run("crmGroupedLessons([{studentName:'Ana Silva',lesson:{id:1,student_id:'a',group_id:'g',lesson_date:'2026-11-26'}},{studentName:'Bruno Costa',lesson:{id:2,student_id:'b',group_id:'g',lesson_date:'2026-11-26'}},{studentName:'Nome <script>',lesson:{id:3,student_id:'a',lesson_date:'2026-11-20'}}])");
 assert.equal((html.match(/class="crm-pending-member"/g)||[]).length,2);
 assert.equal((html.match(/class="crm-pending-actions"/g)||[]).length,3);
 assert.equal((html.match(/Adicionar relatório/g)||[]).length,3);
 assert.equal((html.match(/Descartar pendência/g)||[]).length,3);
 assert.match(html,/openPendingReport\(&quot;b&quot;,&quot;2&quot;\)/);
 assert.match(html,/dismissReportPending\(&quot;2&quot;\)/);
 assert.match(html,/Nome &lt;script&gt;/);
 assert.match(run("crmPendingMember('Ana Silva','',crmDismissButton('a','replacement:2026-11-19'))"),/<span aria-hidden="true"><\/span><button class="resource-action"/);
 assert.match(run("crmGroupedLessons([{studentName:'Ana Silva',missingLesson:true,lesson:{student_id:'a',lesson_date:'2026-11-26'}}])"),/Cadastrar aula/);
 const css=source('admin-crm.css');
 assert.match(css,/\.crm-pending-actions\{display:grid;grid-template-columns:126px 142px/);
 assert.match(css,/@container \(max-width:430px\)/);
 assert.match(css,/\.crm-today-panel\{background:color-mix/);
 assert.match(css,/dark-mode \.crm-today-panel\{background:color-mix/);
});
test('dedicated recent activity screen loads 50 latest entries, excludes test profile and translates preview events',async()=>{
 const {run,c,content,nav,activity}=fixture(),calls=[];
 c.sb={from(table){calls.push(['from',table]);return {select(s){calls.push(['select',s]);return this},order(...args){calls.push(['order',...args]);return this},limit(n){calls.push(['limit',n]);return this},neq(...args){calls.push(['neq',...args]);return Promise.resolve({data:[{student_id:'a',action:'preview_material',created_at:'2026-11-26T23:37:00Z'}]})}}}};
 run("teacherTestProfile={id:'test'};currentStudent=students[0]");
 await run('openRecentAdminActivity()');
 assert.equal(run('currentView'),'atividades');assert.equal(run('currentStudent'),null);
 assert.match(nav.innerHTML,/class="nav-item crm-nav active"[^>]*onclick="openRecentAdminActivity\(\)"[\s\S]*?Atividades recentes/);
 assert.doesNotMatch(nav.innerHTML,/Controle de aulas/);
 assert.match(content.innerHTML,/<h1>Atividades recentes<\/h1>/);
 assert.match(content.innerHTML,/Atualizar/);
 assert.deepEqual(calls.map(x=>x[0]),['from','select','order','limit','neq']);
 assert.deepEqual(calls[3],['limit',50]);
 assert.deepEqual(calls[4],['neq','student_id','test']);
 assert.match(activity.innerHTML,/Ana Silva[\s\S]*Visualizou material[\s\S]*20:37/);
 assert.doesNotMatch(activity.innerHTML,/preview_material/);
});
test('activity list cannot overwrite another screen on a late response; handles empty and escaped data',async()=>{
 const {run,c,activity}=fixture();let resolve;
 c.sb={from(){return {select(){return this},order(){return this},limit(){return new Promise(r=>resolve=r)}}}};
 const promise=run('openRecentAdminActivity()');
 run("currentView='alunos'");activity.isConnected=false;
 resolve({data:[{student_id:'a',action:'preview_material',created_at:'2026-11-26'}]});await promise;
 assert.equal(activity.innerHTML,'');
 assert.match(run('crmActivityRows([],students)'),/Ainda não há atividades/);
 assert.match(run("crmActivityRows([{student_id:'a',action:'<img>',created_at:'invalid'}],students)"),/&lt;img&gt;/);
});
