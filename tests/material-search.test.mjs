import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const context=vm.createContext({});
vm.runInContext(read('js/admin-material-search.js'),context);
const filter=vm.runInContext('crmMaterialFilter',context);
const rows=[{id:'1',student_id:'a',topic:'Conversação',lesson_date:'2026-11-19'},{id:'2',student_id:'b',topic:'Conversation',lesson_date:'2026-11-26'},{id:'3',student_id:'test',topic:'Conversação',lesson_date:'2026-11-27'}];
const students=new Map([['a',{}],['b',{}]]);
test('material search lists all real students by default, newest dates first',()=>assert.deepEqual(Array.from(filter(rows,students,'').map(l=>l.id)),['2','1']));
test('material topic matching ignores accents and case and excludes test profiles',()=>assert.deepEqual(Array.from(filter(rows,students,' CONVERSACAO ').map(l=>l.id)),['1']));
test('real admin and isolated preview use the same material-search component',()=>{
 for(const file of ['admin.html','calendar-preview.html'])assert.match(read(file),/js\/admin-material-search\.js/);
 assert.match(read('calendar-preview.html'),/onclick="demoOpenMaterials\(\)"/);
 assert.match(read('js/admin.js'),/crmRenderMaterialSearch\(/);
 assert.match(read('js/calendar-preview-demo.js'),/crmRenderMaterialSearch\(root,students/);
 assert.match(read('js/calendar-preview-demo.js'),/ccJump\(row.lesson_date\)/);
});
