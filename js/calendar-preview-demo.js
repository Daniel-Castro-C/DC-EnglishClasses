/* Isolated fixture, no network or production data. Uses the actual calendar and lesson UI. */
const escapeHtml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const formatDate=d=>String(d||'').split('-').reverse().join('/');
const adminToday=()=>({date:'2026-11-26'});
const students=[{id:'demo-1',full_name:'Aluno de teste',lesson_weekday:4,lesson_time:'21:00'},{id:'demo-2',full_name:'Integrante A',lesson_weekday:4,lesson_time:'21:00'},{id:'demo-3',full_name:'Integrante B',lesson_weekday:4,lesson_time:'21:00'}];
let currentStudent=students[0],currentView='student',currentTab='calendario',currentLessons=[],currentLessonsReady=true;
const crmRegisteredDates=new Set(),materialDisplayName=r=>r.name;
const demoGroup={id:'demo-group',name:'Dupla de teste',members:['demo-2','demo-3'],start:'2026-11-12',days:'4',time:'21:00',calendar_events:{'2026-11-12':{status:'owed',time:'21:00'}},calendarLessons:[],lessons:[],events:{}};
let demoLessons=students.flatMap(s=>['2026-11-19','2026-11-26'].map((date,i)=>({id:crypto.randomUUID(),student_id:s.id,group_id:s.id==='demo-1'?null:demoGroup.id,lesson_date:date,title:'Class #'+(i+1),title_automatic:true,topic:i?'Conversation':'Introductions',grammar_content:i?'Present Perfect':'Verb to be',resources:[{id:crypto.randomUUID(),name:(i?'Conversation':'Introductions')+' — Slides.pdf',type:'ppt',file_path:'demo/slides.pdf'},{id:crypto.randomUUID(),name:(i?'Conversation':'Introductions')+' — Exercícios.docx',type:'ex',file_path:'demo/exercise.docx'}]})));
const demoStates=new Map(students.map(s=>[s.id,{calendar_key:s.id,revision:1,payload:{start:'2026-11-12',weekdays:'4',time:'21:00',events:{'2026-11-12':{status:'owed',time:'21:00',...(s.id==='demo-1'?{}:{group_id:demoGroup.id,group_status:'owed'})}}}}]));
demoStates.set('global',{calendar_key:'global',revision:1,payload:[{start:'2026-12-18',end:'2027-01-03',status:'break',name:'Recesso de fim de ano'}]});
function demoRefresh(){currentLessons=demoLessons.filter(l=>l.student_id===currentStudent?.id);demoGroup.calendarLessons=demoLessons.filter(l=>demoGroup.members.includes(l.student_id));}
const sb={
 storage:{from:()=>({upload:async()=>({error:null}),download:async()=>({data:new Blob(['Prévia de material'])})})},
 from:table=>({select(){return this},limit:async()=>({data:[]}),in(){return this}}),
 async rpc(name,args){
  if(name==='save_admin_calendar'){const row={calendar_key:args.p_key,revision:args.p_revision+1,payload:ccClone(args.p_payload)};demoStates.set(row.calendar_key,row);return {data:row.revision};}
  if(name==='portal_group_calendar_save'){for(const v of args.p_changes)demoStates.set(v.id,{calendar_key:v.id,revision:v.revision+1,payload:ccClone(v.payload)});if(args.p_schedule){const x=args.p_schedule;Object.assign(demoGroup,x);demoGroup.days=x.days;}return {};}
  if(name==='portal_calendar_save_with_moves'||name==='portal_calendar_save_registered_statuses'){
   if(args.p_changes.some(c=>demoStates.get(c.id)?.revision!==c.revision))return {error:new Error('Calendário alterado; recarregue')};
   const before=ccClone(demoLessons),beforeGroup=ccClone(demoGroup),beforeStates=new Map([...demoStates].map(([k,v])=>[k,ccClone(v)]));
   try{
    for(const meta of args.p_metadata||[]){
     const existing=demoLessons.filter(l=>l.lesson_date===meta.date&&(args.p_group?l.group_id===args.p_group:l.student_id===args.p_student&&(meta.attendance?!!l.group_id:!l.group_id)));
     if(existing.length!==meta.ids.length||existing.some(l=>!meta.ids.includes(l.id)))throw Error('Aula alterada; recarregue');
     for(const l of existing){const event=args.p_changes.find(c=>c.id===l.student_id)?.payload.events[meta.date];if(!event?.status||event.skip)throw Error('Status inválido');l.calendar_status=event.status;}
    }
    for(const move of args.p_moves){
     const existing=demoLessons.filter(l=>l.lesson_date===move.date&&(args.p_group?l.group_id===args.p_group:l.student_id===args.p_student&&!l.group_id));
     if(existing.length!==move.ids.length||existing.some(l=>!move.ids.includes(l.id))||demoLessons.some(l=>l.lesson_date===move.to&&args.p_changes.some(c=>c.id===l.student_id)))throw Error('Aula alterada; recarregue');
     for(const l of existing)l.lesson_date=move.to;
     const result=await sb.rpc('portal_calendar_lesson_save',{p_group:args.p_group,p_student:args.p_student,p_date:move.to,p_title:move.title,p_topic:move.topic,p_grammar:move.grammar,p_members:existing.map(l=>l.student_id),p_materials:move.materials,p_edit:true});
     if(result.error)throw result.error;
    }
    if(args.p_deletions.length){const result=await sb.rpc('portal_calendar_save_with_deletions',args);if(result.error)throw result.error;return result;}
    if(args.p_group){await sb.rpc('portal_group_calendar_save',args);return {};}
    const c=args.p_changes[0];return await sb.rpc('save_admin_calendar',{p_key:c.id,p_revision:c.revision,p_payload:c.payload});
   }catch(error){demoLessons=before;Object.assign(demoGroup,beforeGroup);demoStates.clear();for(const [k,v] of beforeStates)demoStates.set(k,v);demoRefresh();return {error};}
  }
  if(name==='portal_calendar_save_with_deletions'){
   // Validate every expected record and revision before mutating this isolated fixture.
   const ids=new Set(args.p_deletions.flatMap(e=>e.ids));
   for(const entry of args.p_deletions){
    const existing=demoLessons.filter(l=>l.lesson_date===entry.date&&(args.p_group?l.group_id===args.p_group:l.student_id===args.p_student&&!l.group_id));
    if(existing.length!==entry.ids.length||existing.some(l=>!entry.ids.includes(l.id))||args.p_changes.some(c=>c.payload.events[entry.date]?.skip!==true)||args.p_group&&args.p_schedule?.calendar_events[entry.date]?.skip!==true)return {error:new Error('Aula alterada; recarregue')};
   }
   if(args.p_changes.some(c=>demoStates.get(c.id)?.revision!==c.revision))return {error:new Error('Calendário alterado; recarregue')};
   demoLessons=demoLessons.filter(l=>!ids.has(l.id));
   const sorted=demoLessons.filter(l=>args.p_group?l.group_id===args.p_group:l.student_id===args.p_student).sort((a,b)=>a.lesson_date.localeCompare(b.lesson_date));
   const dates=[...new Set(sorted.map(l=>l.lesson_date))];for(const l of sorted)if(l.title_automatic)l.title='Class #'+(dates.indexOf(l.lesson_date)+1);
   for(const c of args.p_changes)demoStates.set(c.id,{calendar_key:c.id,revision:c.revision+1,payload:ccClone(c.payload)});
   if(args.p_group)Object.assign(demoGroup,ccClone(args.p_schedule));
   demoRefresh();return {data:args.p_group?null:args.p_changes[0].revision+1};
  }
  if(!['portal_calendar_lesson_save','portal_calendar_lesson_save_with_grammar'].includes(name))return {error:new Error('Operação não simulada')};
  for(const id of args.p_members){
   let l=demoLessons.find(l=>l.student_id===id&&l.lesson_date===args.p_date);
   if(!l){l={id:crypto.randomUUID(),student_id:id,group_id:args.p_group,lesson_date:args.p_date,resources:[]};demoLessons.push(l);}
   l.title=args.p_title||'Class #1';l.title_automatic=args.p_title===null;l.topic=args.p_topic;if(args.p_grammar!==undefined)l.grammar_content=args.p_grammar;
   for(const r of args.p_materials.filter(r=>r.type!=='rep'||!args.p_group||r.student===id))l.resources.push({id:crypto.randomUUID(),name:r.name,type:r.type});
  }
  const sorted=demoLessons.filter(l=>args.p_group?l.group_id===args.p_group:l.student_id===args.p_student).sort((a,b)=>a.lesson_date.localeCompare(b.lesson_date));
  const dates=[...new Set(sorted.map(l=>l.lesson_date))];for(const l of sorted)if(l.title_automatic)l.title='Class #'+(dates.indexOf(l.lesson_date)+1);
  demoRefresh();return {};
 }
};
ccLoadCloud=async()=>{ccCloud.clear();for(const [id,row] of demoStates)ccCloud.set(id,ccClone(row));ccCloudReady=true;};
tgLoad=async()=>{demoRefresh();tgGroups=[demoGroup];tgSelected=demoGroup;};
async function loadLessonsFor(){demoRefresh();}
function demoSelect(group,studentId='demo-1'){
 if([...ccDrafts.values()].some(d=>d.dirty)&&!confirm('Descartar alterações de teste não salvas?'))return false;
 ccDrafts.clear();ccLessonDrafts.clear();ccActiveKey='';ccSelected='';ccDate=new Date(2026,10,1);
 currentView=group?'turmas':'student';currentStudent=students.find(s=>s.id===studentId)||students[0];currentTab='calendario';tgGroups=[demoGroup];tgSelected=demoGroup;tgTab='calendar';
 document.getElementById('demo-materials').hidden=true;document.getElementById('demo-materials').innerHTML='';
 document.getElementById('tab-content').hidden=false;document.getElementById('tg-body').hidden=false;
 document.getElementById('tab-content').innerHTML='';document.getElementById('tg-body').innerHTML='';demoRefresh();ccRender();return true;
}
// Isolated worked example: an owed lesson followed by a scheduled make-up.
async function demoMissedReplacement(group){
 if(!demoSelect(group))return;
 const date='2026-12-03',replacement='2026-12-04',source={status:'owed',time:'21:00'},makeup={status:'planned',time:'21:00',original:date};
 if(group)Object.assign(demoGroup.calendar_events,{[date]:source,[replacement]:makeup});
 for(const id of group?demoGroup.members:['demo-1']){
  const payload=demoStates.get(id).payload;
  for(const [day,event] of [[date,source],[replacement,makeup]])payload.events[day]={...event,...(group?{group_id:demoGroup.id,group_status:event.status}:{})};
 }
 await ccLoadCloud();ccDrafts.clear();ccActiveKey='';ccSelected='';ccDate=new Date(2026,11,1);ccRender();ccJump(replacement);
}
async function demoLegacyConflict(){
 if(!demoSelect(true))return;
 demoGroup.start='2026-02-05';
 for(const id of demoGroup.members){const payload=demoStates.get(id).payload;payload.start='2026-02-05';delete payload.events['2026-03-05'];}
 demoStates.get('demo-3').payload.events['2026-03-05']={skip:true};
 if(demoGroup.calendar_events)delete demoGroup.calendar_events['2026-03-05'];
 await ccLoadCloud();ccDrafts.clear();ccActiveKey='';ccSelected='';ccDate=new Date(2026,2,1);ccRender();ccJump('2026-03-05');
}
function demoLegacyMember(id){if(demoSelect(false,id))ccJump('2026-03-05');}
tgOpenDate=async(id,date)=>{if(id===demoGroup.id&&demoSelect(true))ccJump(date);};
function demoOpenMaterials(){
 const root=document.getElementById('demo-materials');
 document.getElementById('tab-content').hidden=true;document.getElementById('tg-body').hidden=true;root.hidden=false;
 crmRenderMaterialSearch(root,students,'',async()=>demoLessons.slice(),row=>{
  if(demoSelect(Boolean(row.group_id),row.student_id)){ccJump(row.lesson_date);document.getElementById('cc-edit')?.scrollIntoView({block:'start'});}
 });
}
(async()=>{await ccLoadCloud();demoSelect(false)})();
