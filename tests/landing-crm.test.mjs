import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('landing/admin-crm.js','utf8'),sql=fs.readFileSync('supabase-landing-crm.sql','utf8');
const ctx={window:{}};vm.runInNewContext(source,ctx);
const {matches}=ctx.window.LandingCRM;
test('matches recurring and extra opening dates, excluding blocks, inactive slots and non-active leads',()=>{
 const leads=[{id:'1',status:'novo',availability_slots:['0|18:00','1|19:00','2|20:00','3|21:00']},{id:'2',status:'encerrado',availability_slots:['0|18:00']},{id:'3',status:'contatado',availability_slots:[]}];
 const weekly=[{weekday:0,active:true,start_time:'18:00:00',starts_on:'2026-12-07'},{weekday:2,active:false,start_time:'20:00:00'},{weekday:3,active:true,start_time:'21:00:00',starts_on:'2027-02-01'}];
 const overrides=[{slot_date:'2026-12-07',kind:'blocked',start_time:'18:00:00'},{slot_date:'2026-12-01',kind:'available',start_time:'19:00:00'}];
 const result=JSON.parse(JSON.stringify(matches(leads,weekly,overrides,'2026-11-30')));
 assert.deepEqual(result,[{lead:leads[0],slots:[{key:'0|18:00',date:'2026-12-14'},{key:'1|19:00',date:'2026-12-01'}]}]);
});
test('CRM contact history is admin-only, server timestamps drive 48 hours, private notes never reset deadlines',()=>{
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public.landing_lead_contacts from public, anon, authenticated/);
 assert.match(sql,/grant insert\(lead_id,kind,note\).*authenticated/);assert.match(sql,/landing_contact_admin_read[\s\S]*?p.role='admin'/);
 assert.match(sql,/landing_contact_admin_insert[\s\S]*?p.role='admin'/);
 assert.match(sql,/h.kind in \('outbound','inbound'\)/);assert.match(sql,/c.kind='outbound' and c.created_at<=now\(\)-interval '48 hours'/);
 assert.match(sql,/l.status in \('novo','contatado'\)/);
 assert.match(sql,/landing_analytics_sources[\s\S]*?security invoker/);
 assert.match(sql,/grant insert\(source\) on public.landing_visit_events to anon, authenticated/);
 assert.doesNotMatch(sql,/grant insert\(.*created_at/);
});
test('new modules are integrated with current landing and admin, accessible on small screens',()=>{
 const html=fs.readFileSync('landing/admin.html','utf8'),landing=fs.readFileSync('landing/index.html','utf8');
 for(const id of ['crm-followup-badge','crm-matches','crm-followups','crm-contact-form','analytics-sources'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/crm\?\.update\(leadRows,a.data\|\|\[\],b.data\|\|\[\]\)/);
 assert.match(html,/crm\?\.clear\(\)/);
 assert.match(landing,/Como funciona uma aula de 50 minutos\?/);assert.match(landing,/Vocabulário e gramática em contexto/);
 assert.match(fs.readFileSync('landing/admin-navigation.css','utf8'),/@media\(max-width:700px\)\{\.crm-lead-insights\{grid-template-columns:1fr\}/);
});
