import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('landing/admin-notifications.js','utf8');
const html=fs.readFileSync('landing/admin.html','utf8');
const keys=['testimonial','visit','availability','waitlist'];
const stamp=(offset=0)=>new Date(Date.now()+offset).toISOString();
function setup(storage=new Map()){
 let admin=true,interval=null;const events={},docEvents={},queries=[],rows={landing_testimonials:[],landing_leads:[],landing_visit_events:[]},fail=new Set(),nodes=Object.fromEntries(keys.map(k=>[k,{hidden:true}]));
 const db={from(table){let filters={};return {select(fields){assert.equal(fields,'created_at');return this},eq(key,val){filters[key]=val;return this},order(field,opts){assert.equal(field,'created_at');assert.equal(opts.ascending,false);return this},async limit(num){assert.equal(num,1);queries.push({table,filters});if(fail.has(table))return {error:Error('offline')};return {data:rows[table].filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,1).map(r=>({created_at:r.created_at}))}}}}};
 const window={addEventListener(k,f){events[k]=f}},document={visibilityState:'visible',querySelector(s){return nodes[s.match(/"([^"]+)"/)[1]]},addEventListener(k,f){docEvents[k]=f}};
 const ctx={window,document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setInterval(fn,ms){assert.equal(ms,45000);interval=fn;return 1},clearInterval(){interval=null}};
 vm.runInNewContext(code,ctx);const api=window.LandingAdminNotifications.bind(db,()=>admin);
 return {api,rows,nodes,queries,fail,storage,events,docEvents,get timer(){return interval},logout(){admin=false;api.clear()},async start(id='admin-1'){api.start(id);await api.refresh()},visible(){return keys.filter(k=>!nodes[k].hidden)}};
}
test('four distinct incoming event sources set the corresponding indicator only',async()=>{
 const a=setup();await a.start();
 a.rows.landing_testimonials.push({status:'pending',created_at:stamp(1000)});
 a.rows.landing_leads.push({source:'availability',status:'novo',created_at:stamp(1000)},{source:'landing',status:'novo',created_at:stamp(1000)});
 a.rows.landing_visit_events.push({kind:'portal',created_at:stamp(1000)},{kind:'tracking_start',created_at:stamp(1000)});
 await a.api.refresh();assert.deepEqual(a.visible(),['testimonial','availability','waitlist']);
 a.rows.landing_visit_events.push({kind:'landing',created_at:stamp(1000)});
 await a.api.refresh();assert.deepEqual(a.visible(),keys);
 assert.equal(a.queries.length%4,0);
});
test('opening one successfully loaded module clears only its notifications, including across reloads',async()=>{
 const a=setup();await a.start();
 a.rows.landing_testimonials.push({status:'pending',created_at:stamp(1000)});
 a.rows.landing_leads.push({source:'availability',status:'novo',created_at:stamp(1000)},{source:'landing',status:'novo',created_at:stamp(1000)});
 a.rows.landing_visit_events.push({kind:'landing',created_at:stamp(1000)});
 await a.api.refresh();
 await a.api.open('disponibilidade',async()=>true,()=>true);
 assert.deepEqual(a.visible(),['testimonial','visit']);
 const b=setup(a.storage);Object.assign(b.rows,a.rows);await b.start();assert.deepEqual(b.visible(),['testimonial','visit']);
 b.rows.landing_leads.push({source:'landing',status:'novo',created_at:stamp(3000)});
 await b.api.refresh();assert.deepEqual(b.visible(),['testimonial','visit','waitlist']);
 await b.start('admin-2');assert.deepEqual(b.visible(),keys);
});
test('failed or abandoned page loads do not acknowledge; arrivals while loading are kept unread',async()=>{
 const a=setup();await a.start();
 a.rows.landing_testimonials.push({status:'pending',created_at:stamp(1000)});
 await a.api.refresh();
 await a.api.open('testimonials-admin',async()=>false,()=>true);assert.deepEqual(a.visible(),['testimonial']);
 await a.api.open('testimonials-admin',async()=>true,()=>false);assert.deepEqual(a.visible(),['testimonial']);
 await a.api.open('testimonials-admin',async()=>{a.rows.landing_testimonials.push({status:'pending',created_at:stamp(2000)});return true},()=>true);assert.deepEqual(a.visible(),['testimonial']);
 a.fail.add('landing_testimonials');await a.api.refresh();assert.deepEqual(a.visible(),['testimonial']);
 a.fail.clear();await a.api.open('testimonials-admin',async()=>true,()=>true);assert.deepEqual(a.visible(),[]);
});
test('reviewed leads/testimonials and portal-only visits are not flagged, logout stops polling and hides badges',async()=>{
 const a=setup();await a.start();
 a.rows.landing_testimonials.push({status:'approved',created_at:stamp(1000)});
 a.rows.landing_leads.push({source:'landing',status:'contatado',created_at:stamp(1000)});
 a.rows.landing_visit_events.push({kind:'portal',created_at:stamp(1000)});
 await a.api.refresh();assert.deepEqual(a.visible(),[]);
 a.rows.landing_visit_events.push({kind:'landing',created_at:stamp(1000)});
 await a.api.refresh();assert.deepEqual(a.visible(),['visit']);assert.ok(a.timer);
 a.logout();assert.equal(a.timer,null);assert.deepEqual(a.visible(),[]);
 const count=a.queries.length;await a.api.refresh();assert.equal(a.queries.length,count);
});
test('all four accessible badges are in the existing links and the script is packaged',()=>{
 for(const key of keys)assert.match(html,new RegExp('data-notification="'+key+'" hidden'));
 assert.match(html,/src="admin-notifications.js"/);
 assert.match(html,/notifications\?\.start\(user.id\)/);assert.match(html,/notifications\?\.clear\(\)/);
 assert.match(fs.readFileSync('landing/build.mjs','utf8'),/'admin-notifications.js'/);
});
