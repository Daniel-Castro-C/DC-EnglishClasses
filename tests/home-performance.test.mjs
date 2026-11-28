import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('js/home-lesson-call.js','utf8');
test('lesson stats launch the two independent reads together and preserve completion/fallback rules', async()=>{
 const pending={}, calls=[];
 const defer=k=>{calls.push(k);return new Promise(resolve=>pending[k]=resolve)};
 const sb={from:()=>({select:()=>({eq:()=>defer('list')})}),rpc:()=>defer('completed')};
 const ctx=vm.createContext({sb,isTestStudentProfile:p=>p.is_test_profile,console:{warn(){}}});
 vm.runInContext(source,ctx);
 const run=(expr)=>vm.runInContext(expr,ctx);
 const ready=run("loadHomeLessonStats({id:'student',role:'student'})");
 assert.deepEqual(calls,['list','completed']);
 pending.completed({data:38,error:null});pending.list({count:40,error:null});
 const x=await ready;assert.equal(x.lessonCount,40);assert.equal(x.completedCount,38);assert.equal(x.completedError,null);
 const failed=run("loadHomeLessonStats({id:'student',role:'student'})");
 pending.completed({error:'unavailable'});pending.list({count:12,error:null});
 const y=await failed;assert.equal(y.completedCount,12);assert.equal(y.completedError,'unavailable');
 calls.length=0;
 const testMode=run("loadHomeLessonStats({id:'student',is_test_profile:true})");
 assert.deepEqual(calls,['list']);pending.list({count:5,error:null});assert.equal((await testMode).completedCount,5);
});
test('home starts four independent startup tasks in parallel, not sequential waterfall',()=>{
 const home=fs.readFileSync('home.html','utf8');
 assert.match(home,/Promise\.all\(\[isGrammarUnlocked\(\), getNotificationCounts\(profile.id\), loadHomeLessonStats\(profile\), homeNextLessonDays\(profile\)\]\)/);
 assert.match(home,/let lessonDays = initialLessonDays/);
});
test('badge assets optimized without removing original files',()=>{
 for(const n of [10,30,50,100,150,200]){
 const png=fs.statSync('badges/badge-'+n+'.png').size,webp=fs.statSync('badges/badge-'+n+'.webp').size;
 assert.ok(webp<png);
 assert.match(fs.readFileSync('js/common.js','utf8'),new RegExp('badges/badge-'+n+'\\.webp'));
 }
});
