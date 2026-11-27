import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(result={error:null}){
 const els={};
 const element=()=>({children:[],events:{},value:'',checked:false,hidden:false,textContent:'',append(...a){this.children.push(...a)},setAttribute(){},addEventListener(k,fn){this.events[k]=fn},focus(){}});
 for(const id of ['schedule','count','availability-form','name','phone','notes','consent','error','success'])els[id]=element();
 const btn=element(); const radio={value:'2'};
 els['availability-form'].querySelector=s=>s.includes('button')?btn:radio;
 els.schedule.querySelectorAll=()=>els.schedule.children.flatMap(x=>x.children).filter(x=>x.checked);
 let payload;
 const context={document:{getElementById:id=>els[id],createElement:element},window:{supabase:{createClient:()=>({from:t=>({insert:async data=>{assert.equal(t,'landing_leads');payload=data;return result}})})}}};
 vm.runInNewContext(fs.readFileSync('landing/availability.js','utf8'),context);
 return {els,btn,payload:()=>payload,submit:()=>els['availability-form'].events.submit({preventDefault(){}})};
}
test('anonymous form registers multiple exact slots with normalized Brazilian phone',async()=>{
 const {els,payload,submit}=setup();
 const boxes=els.schedule.children.flatMap(x=>x.children).filter(x=>x.type==='checkbox');
 assert.equal(boxes.length,75);
 boxes.find(x=>x.value==='0|18:00').checked=true;
 boxes.find(x=>x.value==='2|19:00').checked=true;
 els.name.value='Teste';els.phone.value='(27) 99999-0000';els.consent.checked=true;
 await submit();
 const data=JSON.parse(JSON.stringify(payload()));
 assert.deepEqual(data.availability_slots,['0|18:00','2|19:00']);
 assert.equal(data.phone,'5527999990000');assert.equal(data.frequency,2);assert.equal(data.source,'availability');
 assert.equal(els['availability-form'].hidden,true);
});
test('form rejects missing availability and keeps input on storage failure',async()=>{
 const {els,payload,submit,btn}=setup({error:{message:'failed'}});
 els.name.value='Teste';els.phone.value='(27) 99999-0000';els.consent.checked=true;
 await submit();assert.equal(payload(),undefined);assert.ok(els.error.textContent);
 els.schedule.children.flatMap(x=>x.children).find(x=>x.value==='1|07:00').checked=true;
 await submit();assert.ok(els.error.textContent);assert.equal(els['availability-form'].hidden,false);assert.equal(btn.disabled,false);
});
test('embedded form identifies landing origin and keeps detailed availability',async()=>{
 const {els,payload,submit}=setup();
 els['availability-form'].dataset={source:'landing'};
 els.name.value='Teste';els.phone.value='(27) 99999-0000';els.consent.checked=true;
 els.schedule.children.flatMap(x=>x.children).find(x=>x.value==='1|07:00').checked=true;
 await submit();
 assert.equal(payload().source,'landing');
 assert.equal(payload().availability_slots[0],'1|07:00');
});
