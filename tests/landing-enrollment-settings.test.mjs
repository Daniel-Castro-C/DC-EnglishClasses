import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('landing/enrollment-settings.js','utf8');
const currentMessage='Novas opções de horários estarão disponíveis a partir de janeiro de 2027. Indique sua disponibilidade e entraremos em contato para apresentar as possibilidades de aulas. O preenchimento é sem compromisso.';
function setup(initial={mode:'interest',interest_message:currentMessage}){
 const ids=['interest-enrollment','open-enrollment','interest-message','enrollment-settings-form','enrollment-mode','enrollment-message','enrollment-message-field','enrollment-save','enrollment-retry','enrollment-status','enrollment-current'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',hidden:false,disabled:false,events:{},addEventListener(key,fn){this.events[key]=fn}}]));
 const links=[{},{},{},{}],doc={documentElement:{dataset:{}},getElementById:id=>nodes[id],querySelectorAll:()=>links};
 let confirm=true,record=initial,writes=0,readError=false,writeError=false;
 const window={confirm:()=>confirm};
 const db={from(table){assert.equal(table,'landing_enrollment_settings');let update=null;return {
   select(fields){assert.equal(fields,'mode,interest_message');return this},
   eq(key,value){assert.equal(key,'id');assert.equal(value,1);return this},
   update(value){update=value;return this},
   async single(){if(update){writes++;if(writeError)return {error:new Error('denied')};record={...update};return{data:record}}return readError?{error:new Error('offline')}:{data:record}}
 }}};
 vm.runInNewContext(source,{window,document:doc});
 return {api:window.LandingEnrollment,db,nodes,doc,links,get record(){return record},get writes(){return writes},denyConfirm:()=>confirm=false,allowConfirm:()=>confirm=true,failRead:()=>readError=true,failWrite:()=>writeError=true};
}
test('public setting hides the inactive section, updates CTA and renders literal message text',async()=>{
 const a=setup({mode:'interest',interest_message:'  <b>Texto</b>\nNovo período  '});
 const s=await a.api.load(a.db);
 assert.equal(a.api.applyPublic(s,a.doc),true);
 assert.equal(a.nodes['interest-enrollment'].hidden,false);
 assert.equal(a.nodes['open-enrollment'].hidden,true);
 assert.equal(a.nodes['interest-message'].textContent,'<b>Texto</b>\nNovo período');
 assert.equal(a.links[0].textContent,'Entrar na lista de interesse →');
 assert.equal(a.api.applyPublic({mode:'open',interest_message:s.interest_message},a.doc),false);
 assert.equal(a.nodes['interest-enrollment'].hidden,true);
 assert.equal(a.nodes['open-enrollment'].hidden,false);
 assert.equal(a.links[0].textContent,'Encontrar meu horário →');
});
test('admin can edit the suspended message, open enrollment, and return without losing message',async()=>{
 const a=setup();let admin=false;
 const panel=a.api.bindAdmin(a.db,()=>admin);
 const n=a.nodes,submit=()=>n['enrollment-settings-form'].events.submit({preventDefault(){}});
 assert.equal(n['enrollment-save'].disabled,true);
 await panel.refresh();assert.equal(a.writes,0);
 admin=true;await panel.refresh();
 assert.equal(n['enrollment-mode'].value,'interest');
 assert.equal(n['enrollment-message'].value,currentMessage);
 n['enrollment-message'].value='Novas turmas em março.';
 await submit();assert.equal(a.record.interest_message,'Novas turmas em março.');
 n['enrollment-mode'].value='open';n['enrollment-mode'].events.change();
 assert.equal(n['enrollment-message-field'].hidden,true);
 a.denyConfirm();await submit();assert.equal(a.record.mode,'interest');
 a.allowConfirm();await submit();assert.equal(a.record.mode,'open');
 assert.equal(a.record.interest_message,'Novas turmas em março.');
 n['enrollment-mode'].value='interest';n['enrollment-mode'].events.change();
 assert.equal(n['enrollment-message-field'].hidden,false);
 await submit();assert.equal(a.record.mode,'interest');assert.equal(a.record.interest_message,'Novas turmas em março.');
 admin=false;panel.clear();await submit();assert.equal(n['enrollment-save'].disabled,true);assert.equal(a.writes,3);
});
test('invalid text and load/save failures cannot silently overwrite the configuration',async()=>{
 const a=setup();const panel=a.api.bindAdmin(a.db,()=>true),n=a.nodes;
 await panel.refresh();n['enrollment-message'].value='   ';
 await n['enrollment-settings-form'].events.submit({preventDefault(){}});assert.equal(a.writes,0);
 n['enrollment-message'].value='a'.repeat(2001);
 await n['enrollment-settings-form'].events.submit({preventDefault(){}});assert.equal(a.writes,0);
 n['enrollment-message'].value='Texto válido.';a.failWrite();
 await n['enrollment-settings-form'].events.submit({preventDefault(){}});
 assert.equal(a.record.interest_message,currentMessage);assert.equal(n['enrollment-save'].disabled,true);assert.equal(n['enrollment-retry'].hidden,false);
 a.failRead();await panel.refresh();assert.equal(n['enrollment-save'].disabled,true);assert.equal(n['enrollment-retry'].hidden,false);
});
test('public initialization defaults to interest and reads configuration before loading schedule',()=>{
 const index=fs.readFileSync('landing/index.html','utf8'),admin=fs.readFileSync('landing/admin.html','utf8');
 assert.match(index,/let interestMode=true/);
 assert.match(index,/interestMode=window.LandingEnrollment.applyPublic\(settings,document\);\s*if\(!interestMode\)loadSchedule\(\)/);
 assert.match(index,/loadEnrollment\(\);loadProfessorPhoto\(\)/);
 assert.match(index,/id="interest-message"/);
 assert.match(admin,/enrollment\?\.refresh\(\)/);
 assert.match(admin,/enrollment\?\.clear\(\)/);
});
