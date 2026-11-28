import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync('js/diagnostics.js','utf8');
test('diagnostics send only allowlisted categories and throttle repeat errors',async()=>{
 const events={},calls=[];
 const window={location:{pathname:'/home.html'},addEventListener(name,fn){events[name]=fn;}};
 const sb={auth:{getSession:async()=>({data:{session:{}}})},rpc:async(...args)=>calls.push(args)};
 vm.runInNewContext(code,{window,sb});
 events.error({target:window,message:'private content',filename:'private URL'});
 events.error({target:window});
 events.unhandledrejection({reason:'private data'});
 await new Promise(r=>setImmediate(r));
 assert.equal(calls.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[
 ['portal_record_diagnostic',{p_surface:'portal:home.html',p_kind:'runtime'}],
 ['portal_record_diagnostic',{p_surface:'portal:home.html',p_kind:'promise'}]]);
});
test('anonymous errors do not write diagnostics',async()=>{
 const events={};const window={location:{pathname:'/home.html'},addEventListener(name,fn){events[name]=fn;}};
 let calls=0;
 vm.runInNewContext(code,{window,sb:{auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>calls++}});
 events.error({target:window});
 await new Promise(r=>setImmediate(r));assert.equal(calls,0);
});
test('diagnostics SQL prohibits direct reads and restricts report to teacher',()=>{
 const sql=readFileSync('supabase-operational-diagnostics.sql','utf8');
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public.portal_diagnostics from public,anon,authenticated/i);
 assert.match(sql,/if not coalesce\(public.is_admin\(\),false\)/i);
 assert.match(sql,/on conflict do nothing/i);
});
