import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('js/student-journey.js','utf8'),ctx);const J=ctx.window.StudentJourney;
test('lesson duration is always 50 minutes per completed class and is formatted hh:mm',()=>{
 for(const [n,s] of [[0,'00:00'],[1,'00:50'],[2,'01:40'],[38,'31:40'],[150,'125:00'],[null,'—']])assert.equal(J.duration(n),s);
});
test('locked Grammar Guides never render a card; each badge milestone counts exactly once',async()=>{
 const calls=[];const db={from(table){calls.push(table);return{select(_f,opts){assert.equal(opts.count,'exact');assert.equal(opts.head,true);return this},eq(k,v){if(k==='student_id'){assert.equal(v,'own');return this;}assert.equal(v,table==='word_of_day_answers'?'nao_uso':'estudado');return Promise.resolve({count:table==='word_of_day_answers'?7:3})}}}};
 const badgeThresholds=[10,30,50,100,150,200].map(threshold=>({threshold}));
 const locked=await J.load(db,'own',38,false,badgeThresholds);
 assert.equal(locked.badges,2);assert.equal(locked.saved,7);assert.doesNotMatch(J.render(locked),/Grammar Guides/);
 assert.deepEqual(calls,['word_of_day_answers']);
 const unlocked=await J.load(db,'own',200,true,badgeThresholds);
 assert.equal(unlocked.badges,6);assert.equal(unlocked.guides,3);assert.match(J.render(unlocked),/Grammar Guides estudados/);assert.match(J.render(unlocked,'en'),/Grammar Guides studied/);
});
test('yearly data is scoped to own published rows and grammar guides stay hidden when currently locked',async()=>{
 const calls=[];const db={from(table){assert.equal(table,'student_retrospectives');return {select(){return this},eq(k,v){calls.push([k,v]);return this},order(){return this},async limit(){return {data:[{year:2026,stats:{completed:38,grammarUnlocked:true}}]}}}}};
 const x=await J.yearly(db,'own',false);assert.deepEqual(calls,[['student_id','own'],['published',true]]);
 assert.equal(x.stats.grammarUnlocked,false);assert.doesNotMatch(J.render(x.stats,'pt',x.year),/Grammar Guides/);
});
test('annual snapshot publishing and precise resource notification categories use admin and own-user RLS',()=>{
 const sql=fs.readFileSync('supabase-student-journey.sql','utf8');
 assert.match(sql,/student_id=\(select auth.uid\(\)\) and published/);
 assert.match(sql,/retrospective_insert[\s\S]*?with check\(public.is_admin\(\)\)/);
 assert.match(sql,/if not public.is_admin\(\) then raise exception 'Acesso negado'/);
 assert.match(sql,/coalesce\(l.calendar_status,'done'\)='done'/);
 assert.match(sql,/unnest\(array\[10,30,50,100,150,200\]\)/);
 assert.match(sql,/new.type='rep' then 'new_report' else 'new_material'/);
 assert.match(sql,/new.type='new_lesson' then return null/);
 assert.match(sql,/after insert or update of file_path,type/);
 assert.match(fs.readFileSync('js/admin-retrospective.js','utf8'),/confirm\(\(publish\?'Publicar':'Retirar'\)/);
});
