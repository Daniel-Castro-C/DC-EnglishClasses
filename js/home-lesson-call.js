/* The student card only receives a yes/no answer about their own calendar. */
const homeLessonCallIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/></svg>';
function homeLessonCallUrl(raw) {
  try { const url = new URL(String(raw || '').trim()); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
}
function renderHomeLessonCall({url='', demo=false, today=false, lang='pt'}={}) {
  const safeUrl = homeLessonCallUrl(url);
  if (!safeUrl && !demo) return '';
  const en = lang === 'en';
  const title = today ? (en ? 'It’s lesson day!' : 'Chegou o dia da sua aula!') : (en ? 'Your online lesson' : 'Sua aula online');
  const description = today ? (en ? 'Access the video call directly.' : 'Acesse diretamente a videochamada.') : (en ? 'Access your lesson video call directly.' : 'Acesse diretamente a videochamada da sua aula.');
  const action = en ? 'Join video call' : 'Entrar na videochamada';
  const button = safeUrl && !demo ? `<a class="btn-primary home-lesson-call-action" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${homeLessonCallIcon}${action}</a>` : `<button type="button" class="btn-primary home-lesson-call-action" onclick="alert(getLang()==='en'?'Example button: no real video call is opened in test mode.':'Botão demonstrativo: nenhuma videochamada real é aberta no modo de teste.')">${homeLessonCallIcon}${action}</button>`;
  return `<section class="home-lesson-call${today?' is-lesson-day':''}" aria-label="${en?'Online lesson':'Aula online'}"><span class="home-lesson-call-icon">${homeLessonCallIcon}</span><div class="home-lesson-call-copy"><h2>${title}</h2><p>${description}</p></div>${button}</section>`;
}
async function homeHasLessonToday(profile) {
  if (isTestStudentProfile(profile) || profile?.role !== 'student') return false;
  try {
    const {data,error} = await sb.rpc('student_has_lesson_today');
    if (error) throw error;
    return data === true;
  } catch (error) { console.warn('Lesson-day indicator unavailable',error); return false; }
}
function updateHomeLessonCall(profile,today) {
  const container=document.getElementById('home-lesson-call-container');
  if (container) container.innerHTML=renderHomeLessonCall({url:profile.permanent_lesson_link,demo:isTestStudentProfile(profile),today,lang:getLang()});
}
function toggleHomeLessonDayPreview() {
  if (!window.__dcTeacherTestMode) return;
  const card=document.querySelector('#home-lesson-call-container .home-lesson-call');
  updateHomeLessonCall({role:'student',is_test_profile:true},!card?.classList.contains('is-lesson-day'));
}
