/* The student card receives only the number of days until their own next lesson. */
const homeLessonCallIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>';
function homeLessonCallUrl(raw) {
  try { const url = new URL(String(raw || '').trim()); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
}
function homeLessonCallCopy(days,lang){
  const en=lang==='en';
  if(days===0)return en?'It’s lesson day!':'Chegou o dia da sua aula!';
  if(days===1)return en?'1 day until your lesson':'Falta 1 dia para a sua aula';
  if(Number.isInteger(days)&&days>1)return en?days+' days until your lesson':'Faltam '+days+' dias para a sua aula';
  if(days===null)return en?'No upcoming lesson scheduled':'Nenhuma próxima aula agendada';
  return en?'Your online lesson':'Sua aula online';
}
function homeOpenLessonCall(button){
  const en=button.dataset.lang==='en',demo=button.dataset.demo==='true';
  if(button.dataset.today!=='true'){
    const message=button.dataset.unknown==='true'?(en?'We could not check today’s schedule. Start the call anyway?':'Não foi possível confirmar se há aula hoje. Deseja iniciar a chamada mesmo assim?'):(en?'No lesson is scheduled for today. Do you want to start the call anyway?':'Não há aula agendada para hoje. Deseja iniciar a chamada mesmo assim?');
    if(!confirm(message))return;
  }
  if(demo){alert(en?'Example button: no real video call is opened in test mode.':'Botão demonstrativo: nenhuma videochamada real é aberta no modo de teste.');return;}
  const url=homeLessonCallUrl(button.dataset.callUrl);
  if(url)window.open(url,'_blank','noopener,noreferrer');
}
function renderHomeLessonCall({url='',demo=false,days,lang='pt'}={}){
  const safeUrl=homeLessonCallUrl(url);
  if(!safeUrl&&!demo)return '';
  const en=lang==='en',today=days===0;
  const title=homeLessonCallCopy(days,lang);
  const description=today?(en?'Access the video call directly.':'Acesse diretamente a videochamada.'):(days===undefined?(en?'Unable to check your next lesson.':'Não foi possível consultar sua próxima aula.'):(en?'Access your lesson video call directly.':'Acesse diretamente a videochamada da sua aula.'));
  const action=en?'Join video call':'Entrar na videochamada';
  const button=today&&safeUrl&&!demo?`<a class="btn-primary home-lesson-call-action" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${homeLessonCallIcon}${action}</a>`:`<button type="button" class="btn-primary home-lesson-call-action" data-call-url="${demo?'':escapeHtml(safeUrl)}" data-demo="${demo}" data-today="${today}" data-unknown="${days===undefined}" data-lang="${en?'en':'pt'}" onclick="homeOpenLessonCall(this)">${homeLessonCallIcon}${action}</button>`;
  return `<section class="home-lesson-call${today?' is-lesson-day':''}" aria-label="${en?'Online lesson':'Aula online'}"><span class="home-lesson-call-icon">${homeLessonCallIcon}</span><div class="home-lesson-call-copy"><h2>${title}</h2><p>${description}</p></div>${button}</section>`;
}
async function homeNextLessonDays(profile){
  if(isTestStudentProfile(profile))return 3;
  if(profile?.role!=='student')return undefined;
  try{
    const {data,error}=await sb.rpc('student_next_lesson_days');
    if(error)throw error;
    return data===null?null:Number.isInteger(data)&&data>=0?data:undefined;
  }catch(error){console.warn('Next lesson unavailable',error);return undefined;}
}
function updateHomeLessonCall(profile,days){
  const container=document.getElementById('home-lesson-call-container');
  if(container)container.innerHTML=renderHomeLessonCall({url:profile.permanent_lesson_link,demo:isTestStudentProfile(profile),days,lang:getLang()});
}
function toggleHomeLessonDayPreview(){
  if(!window.__dcTeacherTestMode)return;
  const card=document.querySelector('#home-lesson-call-container .home-lesson-call');
  updateHomeLessonCall({role:'student',is_test_profile:true},card?.classList.contains('is-lesson-day')?3:0);
}

// Home data reads are independent. Preserve the existing fallback and badge error boundary.
async function loadHomeLessonStats(profile){
  const legacy=Promise.resolve(sb.from('lessons').select('id',{count:'exact',head:true}).eq('student_id',profile.id)).catch(error=>({count:null,error}));
  const actual=isTestStudentProfile(profile)?Promise.resolve(null):Promise.resolve(sb.rpc('completed_lesson_count',{p_student:profile.id})).catch(error=>({error}));
  const [fallback,result]=await Promise.all([legacy,actual]);
  let completedCount=fallback.count||0,completedError=fallback.error;
  if(result){
    if(result.error||result.data==null){completedError=result.error||new Error('Completion count unavailable');console.warn('Completion count unavailable; preserving legacy count',completedError);}
    else{completedCount=Number(result.data)||0;completedError=null;}
  }
  return {lessonCount:fallback.count,completedCount,completedError};
}
