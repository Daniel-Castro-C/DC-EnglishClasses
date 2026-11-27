import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('landing/visitor-demo-client.js','utf8');
const admin=fs.readFileSync('landing/admin.html','utf8');
const tour=fs.readFileSync('landing/visitor-tour.js','utf8');
const slides='demo/Music and Concerts - Modo Demonstração.pdf';
const report='demo/Music and Concerts - Relatório de desempenho - Modo Demonstração.pdf';
function setup(rows=[],fail=false){
 const requests=[];
 const window={addEventListener(){}};
 vm.runInNewContext(source,{window,fetch:async url=>{
   requests.push(url);
   if(fail)throw Error('network unavailable');
   return {ok:true,json:async()=>rows};
 }});
 return {window,sb:window.sb,requests};
}
test('visitor has exactly one lesson, count one, and no unpublished or legacy class files',async()=>{
 const {sb,window,requests}=setup([{asset_key:'feedback_slides',file_path:'feedback_slides/old.pdf'}]);
 const count=await sb.from('lessons').select('id',{head:true,count:'exact'}).eq('student_id','visitor-demo-local');
 assert.equal(count.count,1);
 assert.equal(requests.length,0);
 const {data}=await sb.from('lessons').select('*, resources(*)').eq('student_id','visitor-demo-local');
 assert.equal(data.length,1);
 assert.equal(data[0].topic,'Music and Concerts');assert.equal(data[0].title,'Class #1');assert.equal(data[0].lesson_date,null);
 assert.equal(data[0].resources.length,0);
 assert.equal(await window.__dcDemoPdfUrl(slides),null);
 assert.equal(await window.__dcDemoPdfUrl('demo/Productivity - Modo Demonstração.pdf'),null);
 assert.match(requests[0],/asset_key=in\.\(music_slides,music_report,teamwork_correction\)/);
 assert.equal((await sb.from('lessons').insert({topic:'extra'})).error.message.includes('indisponível'),true);
});
test('uploaded files only appear for the Music and Concerts lesson and resolve to the public PDFs',async()=>{
 const file='a'.repeat(32)+'.pdf';
 for(const keys of [['music_slides'],['music_slides','music_report']]){
  const {sb,window,requests}=setup(keys.map(asset_key=>({asset_key,file_path:asset_key+'/'+file})));
  const {data}=await sb.from('lessons').select('*, resources(*)');
  assert.equal(data[0].resources.length,keys.length);
  assert.equal((await sb.from('resources').select('*').in('lesson_id',['demo-music'])).data.length,keys.length);
  assert.equal(await window.__dcDemoPdfUrl(slides),'https://dgwbjgngewymzgedlzix.supabase.co/storage/v1/object/public/landing-demo-materials/music_slides/'+file);
  assert.equal(await window.__dcDemoPdfUrl(report),keys.length===2?'https://dgwbjgngewymzgedlzix.supabase.co/storage/v1/object/public/landing-demo-materials/music_report/'+file:null);
  assert.equal(requests.length,1);
 }
});
test('network failure still shows the single lesson and preserves the writing example',async()=>{
 const {sb,window}=setup([],true);
 const {data}=await sb.from('lessons').select('*');
 assert.equal(data.length,1);assert.equal(data[0].resources.length,0);
 assert.match(await window.__dcDemoPdfUrl('demo/Teamwork - Text Correction - Modo Demonstração.pdf'),/^\/visit\/demo\//);
});
test('admin upload slots and guest tour agree on the new demo lesson',()=>{
 assert.match(admin,/\['music_slides','Music and Concerts · Slides'\]/);
 assert.match(admin,/\['music_report','Music and Concerts · Relatório de desempenho'\]/);
 assert.doesNotMatch(admin,/\['(?:feedback|productivity)_(?:slides|report)'/);
 assert.match(tour,/\.student-material-dropdown, \.student-no-materials/);
 for(const path of [slides,report])assert.ok(tour.includes(path));
 assert.doesNotMatch(tour,/demo\/Productivity|demo\/Giving and Receiving Feedback/);
});
