import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const tracking=fs.readFileSync('landing/analytics.js','utf8');
const adminSource=fs.readFileSync('landing/admin-analytics.js','utf8');
function simulate({path='/',hostname='dc-englishclasses.vercel.app',session=new Map(),state='visible',now=1_800_000_000_000}={}){
 const calls=[],events={};const document={visibilityState:state,addEventListener:(name,fn)=>{events[name]=fn}};
 vm.runInNewContext(tracking,{location:{hostname,pathname:path},document,Date:{now:()=>now},
 sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
 fetch:async(url,init)=>{calls.push({url,init});return {ok:true}}});
 return {calls,session,document,events};
}
test('counts landing and visitor session once, with no personal identifiers',()=>{
 const a=simulate();
 assert.equal(a.calls.length,1);
 assert.deepEqual(JSON.parse(a.calls[0].init.body),{kind:'landing'});
 assert.equal(a.calls[0].init.credentials,'omit');assert.equal(a.calls[0].init.referrerPolicy,'no-referrer');
 assert.equal(simulate({session:a.session}).calls.length,0);
 assert.deepEqual(JSON.parse(simulate({path:'/visit/home.html',session:a.session}).calls[0].init.body),{kind:'portal'});
 assert.equal(simulate({path:'/visit/aluno.html',session:a.session}).calls.length,0);
 assert.equal(simulate({session:a.session,now:1_800_000_000_000+31*60_000}).calls.length,1);
});
test('does not track admin, preview, redirect pages or hidden prerender until visible',()=>{
 for(const path of ['/admin.html','/disponibilidade.html','/visitor.html','/visit/index.html'])assert.equal(simulate({path}).calls.length,0);
 assert.equal(simulate({hostname:'preview.vercel.app'}).calls.length,0);
 const hidden=simulate({state:'hidden'});assert.equal(hidden.calls.length,0);hidden.document.visibilityState='visible';hidden.events.visibilitychange();assert.equal(hidden.calls.length,1);
});
test('admin analytics renders totals and conversion only when authorized',async()=>{
 const make=()=>({textContent:'',children:[],value:'30',events:{},setAttribute(){},append(...els){this.children.push(...els)},replaceChildren(...els){this.children=els},addEventListener(n,fn){this.events[n]=fn}});
 const ids=['analytics-visits','analytics-portal','analytics-forms','analytics-rate','analytics-chart','analytics-message','analytics-period','analytics-refresh'];
 const nodes=Object.fromEntries(ids.map(id=>[id,make()]));
 const context={window:{},document:{getElementById:id=>nodes[id],createElementNS:()=>make()}};
 vm.runInNewContext(adminSource,context);
 let authorized=false,called=0;
 const a=context.window.createLandingAnalytics({rpc:async(name,args)=>{called++;assert.equal(name,'landing_analytics_daily');assert.equal(args.p_days,30);return{data:[{day:'2026-11-27',landing_visits:20,portal_visits:7,forms:3,tracking_start:'2026-11-27T12:00:00Z'}]}}},()=>authorized);
 await a.refresh();assert.equal(called,0);
 authorized=true;await a.refresh();assert.equal(called,1);
 assert.equal(nodes['analytics-visits'].textContent,'20');assert.equal(nodes['analytics-portal'].textContent,'7');assert.equal(nodes['analytics-forms'].textContent,'3');assert.equal(nodes['analytics-rate'].textContent,'15%');assert.equal(nodes['analytics-chart'].children.length,1);
 a.clear();assert.equal(nodes['analytics-visits'].textContent,'—');assert.equal(nodes['analytics-chart'].children.length,0);
});
