/* Read-only monthly overview of the committed class calendars. */
function crmMonthBounds(month){
 const [year,number]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year,number-1,1)),last=new Date(Date.UTC(year,number,0));
 return {first:month+'-01',last:last.toISOString().slice(0,10),days:last.getUTCDate(),offset:first.getUTCDay()};
}
function crmShiftMonth(month,delta){
 const [year,number]=month.split('-').map(Number);
 return new Date(Date.UTC(year,number-1+delta,1)).toISOString().slice(0,7);
}
function crmMonthTitle(month){
 const [year,number]=month.split('-').map(Number);
 return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,number-1,1)));
}
function crmMonthlyEntries(month,registeredLessons){
 const {days}=crmMonthBounds(month),result=new Map(),active=students.filter(s=>!s.is_test_profile);
 const schedules=new Map(active.map(s=>[s.id,ccData(s)])),registered=new Map();
 for(const l of registeredLessons){
  const key=l.student_id+'|'+l.lesson_date;
  if(!registered.has(key))registered.set(key,[]);
  registered.get(key).push(l);
 }
 const groups=new Map(tgGroups.map(g=>[g.id,g])),groupSchedules=new Map(tgGroups.map(g=>[g.id,ccGroupSchedule(g)]));
 const unavailable=ccGlobal();
 for(let day=1;day<=days;day++){
  const date=month+'-'+String(day).padStart(2,'0'),entries=new Map();
  const blocked=unavailable.some(e=>date>=e.start&&date<=e.end);
  for(const student of active){
   const schedule=schedules.get(student.id),event=schedule.events[date],rows=registered.get(student.id+'|'+date)||[];
   // Existing registrations are authoritative, including corrected attendance from PR #37.
   const present=rows.filter(l=>['planned','done'].includes(l.calendar_status||'done'));
   if(rows.length&&!present.length)continue;
   const group=groups.get(present.find(l=>l.group_id)?.group_id||event?.group_id)||ccGroupForDate(student.id,date);
   const habitual=group?groupSchedules.get(group.id)||schedule:schedule;
   if(!present.length&&(event?.skip||event?.status&&!['planned','done'].includes(event.status)))continue;
   if(!present.length&&!event?.status&&(blocked||!ccIsHabitual(habitual,date)))continue;
   const rawTime=event?.time||ccSchedule(habitual,date).time||ccSchedule(schedule,date).time;
   const time=/^\d{2}:\d{2}/.test(rawTime||'')?rawTime.slice(0,5):'';
   // One line per collective appointment, listing each participating student once.
   const key=group?'group:'+group.id+'|'+time:'student:'+student.id+'|'+time;
   if(!entries.has(key))entries.set(key,{time,names:[]});
   entries.get(key).names.push(student.full_name||student.email||'Aluno sem nome');
  }
  result.set(date,[...entries.values()].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||a.names[0].localeCompare(b.names[0],'pt-BR')));
 }
 return result;
}
function crmMonthlyGrid(month,entries,today){
 const {days,offset}=crmMonthBounds(month);
 const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 return '<div class="crm-month-scroll" tabindex="0" role="region" aria-label="Calendário mensal; deslize horizontalmente em telas pequenas"><div class="crm-month-grid">'+
 weekdays.map(d=>'<div class="crm-month-weekday">'+d+'</div>').join('')+
 Array.from({length:42},(_,i)=>{
  const day=i-offset+1;
  if(day<1||day>days)return '<div class="crm-month-day is-outside" aria-hidden="true"></div>';
  const date=month+'-'+String(day).padStart(2,'0');
  return '<div class="crm-month-day'+(date===today?' is-today':'')+'"'+(date===today?' aria-current="date"':'')+'><div class="crm-month-day-number">'+day+'</div>'+
   (entries.get(date)||[]).map(e=>'<div class="crm-month-class"><time'+(e.time?' datetime="'+e.time+'"':'')+'>'+escapeHtml(e.time||'—')+'</time><span>'+e.names.map(escapeHtml).join(' · ')+'</span></div>').join('')+'</div>';
 }).join('')+'</div></div>';
}
async function crmFetchMonthlyLessons(month){
 const {first,last}=crmMonthBounds(month),result=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await sb.from('lessons').select('id,student_id,lesson_date,group_id,calendar_status').gte('lesson_date',first).lte('lesson_date',last).order('id',{ascending:true}).range(offset,offset+499);
  if(error)throw error;
  result.push(...(data||[]));
  if((data||[]).length<500)return result;
 }
}
function crmMountMonthlyCalendar(panel,groupsReady=Promise.resolve(),loadLessons=crmFetchMonthlyLessons,today=adminToday().date){
 if(!panel)return;
 let month=today.slice(0,7),request=0;
 panel.innerHTML='<div class="crm-panel-head crm-month-header"><h3>Calendário mensal</h3><div class="crm-month-nav"><button type="button" class="crm-icon-btn crm-month-prev" aria-label="Mês anterior">←</button><strong class="crm-month-title" aria-live="polite"></strong><button type="button" class="crm-icon-btn crm-month-next" aria-label="Próximo mês">→</button></div></div><div class="crm-month-content" aria-busy="true"></div>';
 const heading=panel.querySelector('.crm-month-title'),content=panel.querySelector('.crm-month-content');
 async function render(){
  const current=month,token=++request;
  heading.textContent=crmMonthTitle(current);
  content.setAttribute('aria-busy','true');
  // Keep a six-week calendar visible while loading to avoid layout movement.
  content.innerHTML=crmMonthlyGrid(current,new Map(),today)+'<p class="crm-month-feedback crm-muted" role="status">Carregando aulas...</p>';
  try{
   await groupsReady;
   if(!ccCloudReady)throw Error('Calendário indisponível');
   const lessons=await loadLessons(current);
   if(token!==request||!panel.isConnected)return;
   content.innerHTML=crmMonthlyGrid(current,crmMonthlyEntries(current,lessons),today);
  }catch(error){
   if(token!==request||!panel.isConnected)return;
   console.error('Calendário mensal:',error);
   content.innerHTML='<p class="crm-empty" role="alert">Não foi possível carregar as aulas deste mês. Navegue entre os meses ou recarregue a Home para tentar novamente.</p>';
  }finally{if(token===request&&panel.isConnected)content.setAttribute('aria-busy','false');}
 }
 panel.querySelector('.crm-month-prev').addEventListener('click',()=>{month=crmShiftMonth(month,-1);render();});
 panel.querySelector('.crm-month-next').addEventListener('click',()=>{month=crmShiftMonth(month,1);render();});
 return render();
}
