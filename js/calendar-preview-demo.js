/* Isolated fixture, no network or production data. Uses the actual calendar and lesson UI. */
const escapeHtml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const formatDate=d=>String(d||'').split('-').reverse().join('/');
const adminToday=()=>({date:'2026-11-26'});
const students=[{id:'demo-1',full_name:'Aluno de teste',lesson_weekday:4,lesson_time:'21:00'},{id:'demo-2',full_name:'Integrante A',lesson_weekday:4,lesson_time:'21:00'},{id:'demo-3',full_name:'Integrante B',lesson_weekday:4,lesson_time:'21:00'}];
let currentStudent=students[0],currentView='student',currentTab='calendario',currentLessons=[],currentLessonsReady=true;
const crmRegisteredDates=new Set(),materialDisplayName=r=>r.name;
const demoGroup={id:'demo-group',name:'Dupla de teste',members:['demo-2','demo-3'],start:'2026-11-19',days:'4',time:'21:00',calendar_events:{},calendarLessons:[],lessons:[],events:{}};
let demoLessons=students.flatMap(s=>['2026-11-19','2026-11-26'].map((date,i)=>({id:crypto.randomUUID(),student_id:s.id,group_id:s.id==='demo-1'?null:demoGroup.id,lesson_date:date,title:'Class #'+(i+1),title_automatic:true,topic:i?'Conversation':'Introductions',resources:[]})));
const demoStates=new Map(students.map(s=>[s.id,{calendar_key:s.id,revision:1,payload:{start:'2026-11-19',weekdays:'4',time:'21:00',events:{}}}]));
function demoRefresh(){currentLessons=demoLessons.filter(l=>l.student_id===currentStudent?.id);demoGroup.calendarLessons=demoLessons.filter(l=>demoGroup.members.includes(l.student_id));}
const sb={
 storage:{from:()=>({upload:async()=>({error:null})})},
 from:table=>({select(){return this},limit:async()=>({data:[]}),in(){return this}}),
 async rpc(name,args){
  if(name==='save_admin_calendar'){const row={calendar_key:args.p_key,revision:args.p_revision+1,payload:ccClone(args.p_payload)};demoStates.set(row.calendar_key,row);return {data:row.revision};}
  if(name==='portal_group_calendar_save'){for(const v of args.p_changes)demoStates.set(v.id,{calendar_key:v.id,revision:v.revision+1,payload:ccClone(v.payload)});if(args.p_schedule){const x=args.p_schedule;Object.assign(demoGroup,x);demoGroup.days=x.days;}return {};}
  if(name!=='portal_calendar_lesson_save')return {error:new Error('Operação não simulada')};
  for(const id of args.p_members){
   let l=demoLessons.find(l=>l.student_id===id&&l.lesson_date===args.p_date);
   if(!l){l={id:crypto.randomUUID(),student_id:id,group_id:args.p_group,lesson_date:args.p_date,resources:[]};demoLessons.push(l);}
   l.title=args.p_title||'Class #1';l.title_automatic=args.p_title===null;l.topic=args.p_topic;
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
function demoSelect(group){
 if([...ccDrafts.values()].some(d=>d.dirty)&&!confirm('Descartar alterações de teste não salvas?'))return;
 ccDrafts.clear();ccLessonDrafts.clear();ccActiveKey='';ccSelected='';ccDate=new Date(2026,10,1);
 currentView=group?'turmas':'student';currentStudent=students[0];currentTab='calendario';tgGroups=[demoGroup];tgSelected=demoGroup;tgTab='calendar';
 document.getElementById('tab-content').innerHTML='';document.getElementById('tg-body').innerHTML='';demoRefresh();ccRender();
}
(async()=>{await ccLoadCloud();demoSelect(false)})();
