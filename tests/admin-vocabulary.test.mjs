import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('js/admin-vocabulary.js','utf8');
function fixture(){
 const element={innerHTML:'',isConnected:true},calls=[];
 const words=[{answer:'nao_uso',updated_at:'2026-11-26',word_of_day:{term:'resourceful',definition:'Find solutions',example:'She is resourceful.'}},{answer:'uso',updated_at:'2026-11-25',word_of_day:{term:'reliable',definition:'Dependable',example:'He is reliable.'}}];
 const c=vm.createContext({window:{},console,document:{getElementById:id=>id==='tab-content'?element:null},currentTab:'vocab',currentView:'student',currentStudent:{id:'one',full_name:'Aluno A'},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),sb:{from(table){calls.push(table);return {select(columns){calls.push(columns);return this},eq(key,id){calls.push([key,id]);return this},async order(){return {data:words}}}}}});
 vm.runInContext(code,c);
 return {c,element,calls,words};
}
test('vocabulary is an explicit tab of the new dossier and no longer modifies the old role-switch',()=>{
 const admin=readFileSync('js/admin.js','utf8');
 assert.match(admin,/\['vocab','Vocabulário','book'\]/);
 assert.match(admin,/currentTab === 'vocab'\) \{\s*window.renderVocabTab\(\)/);
 assert.match(readFileSync('admin.html','utf8'),/js\/admin-vocabulary.js/);
 assert.doesNotMatch(readFileSync('js/recursos-module.js','utf8'),/window\.renderStudentDetail\s*=/);
});
test('vocabulary reads only the selected student, switches answer categories and searches',async()=>{
 const {c,element,calls}=fixture();await c.window.renderVocabTab();
 assert.equal(calls[0],'word_of_day_answers');assert.deepEqual(calls[2],['student_id','one']);
 assert.match(element.innerHTML,/Ainda não uso \(1\)/);assert.match(element.innerHTML,/Já uso \(1\)/);
 assert.match(element.innerHTML,/resourceful/);assert.doesNotMatch(element.innerHTML,/He is reliable/);
 c.window.vocabAdminSub('uso');assert.match(element.innerHTML,/reliable/);
 c.window.vocabAdminSearch('no match');assert.match(element.innerHTML,/Nenhuma palavra encontrada/);
});
test('late vocabulary results do not display a previous student’s data',async()=>{
 const {c,element}=fixture();const pending=c.window.renderVocabTab();
 c.currentStudent={id:'two'};element.innerHTML='Other student';await pending;
 assert.equal(element.innerHTML,'Other student');
});
