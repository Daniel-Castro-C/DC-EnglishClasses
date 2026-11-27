const ICONS = {
  ppt: ['ic-ppt','P'],
  pdf: ['ic-pdf','PDF'],
  ex:  ['ic-ex','Ex'],
  rep: ['ic-rep','R'],
};
const TYPE_LABELS = Object.fromEntries(['ppt','pdf','ex','rep'].map(type => [type, materialTypeLabel(type, 'pt')]));
const WEEKDAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

let students = [];
let teacherTestProfile = null;
let currentStudent = null;
let currentLessons = [];
let currentLessonsReady = false;
let currentTab = 'geral';
let currentView = 'home'; // 'home' | 'comunicados' | 'student'
let danielPendingTotal = 0;
let pendingCountsByStudent = {};
let crmInbox = {};
let crmInboxError = false;
// Arquivos selecionados em diferentes pastas antes de cadastrar a aula.
let quickLessonFiles = [];

(async function init(){
  const session = await requireSession();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);
  if (!profile) { await signOutAndRedirect(); return; }

  if (profile.role !== 'admin') {
    window.location.href = 'aluno.html';
    return;
  }

  teacherTestProfile = makeTeacherTestProfile(profile);
  await syncThemeFromProfile(profile);
  document.getElementById('theme-toggle-container').innerHTML = buildThemeToggle(profile.id);

  await loadStudents();
  try { await ccLoadCloud(); } catch(error) { console.error(error); alert('Não foi possível carregar o calendário do Supabase. As alterações do calendário estão bloqueadas até recarregar a página.'); }
  await refreshPendingCounts();
  renderNav();
  const requestedStudent = new URLSearchParams(location.search).get('student');
  if (requestedStudent && students.some(s => s.id === requestedStudent)) await openStudent(requestedStudent);
  else renderHome();
  window.addEventListener('focus',crmRefreshIndicators);
  setInterval(()=>{if(!document.hidden)crmRefreshIndicators();},60000);
})();

async function loadStudents(){
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: true });

  if (error) console.error(error);
  students = data || [];
  if (teacherTestProfile) students.push(teacherTestProfile);
  sortStudentsBySchedule();
}

function sortStudentsBySchedule(){
  students.sort((a, b) => {
    if (a.is_test_profile) return b.is_test_profile ? 0 : 1;
    if (b.is_test_profile) return -1;
    const aHas = a.lesson_weekday != null && a.lesson_time;
    const bHas = b.lesson_weekday != null && b.lesson_time;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (!aHas && !bHas) return 0; // mantém a ordem de cadastro entre quem não tem horário definido
    if (a.lesson_weekday !== b.lesson_weekday) return a.lesson_weekday - b.lesson_weekday;
    return a.lesson_time.localeCompare(b.lesson_time);
  });
}

async function refreshPendingCounts(){
  const queries=await Promise.all([
    sb.from('daniel_questions').select('id,student_id').is('answer',null),
    sb.from('material_requests').select('id,student_id'),
    sb.from('text_submissions').select('id,student_id').eq('status','pending')
  ]);
  crmInboxError=queries.some(q=>q.error);
  const next={},counts={};
  const kinds=['questions','materials','texts'];
  queries.forEach((q,i)=>{if(q.error)return;(q.data||[]).forEach(r=>{const entry=next[r.student_id]??=( {questions:[],materials:[],texts:[]} );entry[kinds[i]].push(r.id);if(i<2)counts[r.student_id]=(counts[r.student_id]||0)+1;});});
  crmInbox=next;
  pendingCountsByStudent=counts;
  danielPendingTotal=(queries[0].data||[]).filter(q=>!teacherTestProfile||q.student_id!==teacherTestProfile.id).length;
}
function crmInboxFor(id){return crmInbox[id]||{questions:[],materials:[],texts:[]}}
function crmInboxCount(id){const e=crmInboxFor(id);return e.questions.length+e.materials.length+e.texts.length}
function crmCountBadge(n,label){return n?'<span class="crm-inbox-count" aria-label="'+escapeHtml(label)+': '+n+'">'+n+'</span>':''}
async function crmRefreshIndicators(){
  await refreshPendingCounts();
  document.querySelectorAll('[data-crm-inbox]').forEach(el=>{const e=crmInboxFor(el.dataset.crmInbox),k=el.dataset.crmKind;const n=k?e[k].length:crmInboxCount(el.dataset.crmInbox);el.innerHTML=crmCountBadge(n,'Pendências');});
  const nav=document.querySelector('[data-crm-nav-inbox]');
  if(nav)nav.innerHTML=crmCountBadge(students.filter(s=>!s.is_test_profile).reduce((a,s)=>a+crmInboxCount(s.id),0),'Envios e dúvidas');
}
function renderNav(){
 const groups=[['GESTÃO',[['home','Visão geral','dashboard','renderHome()'],['alunos','Alunos','users','ccRoster()'],['turmas','Turmas','users','tgOpen()'],['agenda','Agenda','calendar','ccGlobalView()'],['controle','Controle de aulas','chart','ccOverview()']]],['PEDAGÓGICO',[['guias','Guias de Gramática','book','openGuias()'],['materiais-busca','Buscador de materiais','file','crmMaterialSearch()'],['daniel','Pergunte ao Daniel','message','openDanielModule()'],['comunicados','Comunicados','megaphone','openComunicados()']]],['FERRAMENTAS',[['test','Modo aluno de teste','graduation','enterStudentTestMode()'],['testprofile','Perfil de teste','users','openStudent(teacherTestProfile.id)'],['landing','Landing page','external',"window.open('https://dc-englishclasses.vercel.app/','_blank','noopener')"],['leads','Administração da landing page','settings',"window.open('https://dc-englishclasses.vercel.app/admin.html','_blank','noopener')"]]]];
 document.getElementById('nav-container').innerHTML=groups.map(([label,items])=>'<div class="nav-label">'+label+'</div>'+items.map(([key,name,icon,action])=>{const active=currentView===key||(key==='alunos'&&currentView==='student');return '<button type="button" class="nav-item crm-nav'+(active?' active':'')+'" onclick="'+escapeHtml(action)+'">'+crmIcon(icon)+'<span class="nav-item-label">'+name+'</span>'+(key==='daniel'&&danielPendingTotal?'<span class="pill">'+danielPendingTotal+'</span>':'')+(key==='alunos'?'<span data-crm-nav-inbox>'+crmCountBadge(students.filter(s=>!s.is_test_profile).reduce((a,s)=>a+crmInboxCount(s.id),0),'Envios e dúvidas')+'</span>':'')+'</button>'}).join('')).join('');
}
function filterAdminStudentNav(query){
  const value = (query || '').trim().toLocaleLowerCase('pt-BR');
  document.querySelectorAll('.admin-student-nav').forEach(item => {
    item.hidden = !item.dataset.searchName.includes(value);
  });
}

// São Paulo timezone: today and weekly schedule reflect the school's local calendar.
function adminToday(){
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:7 }[values.weekday];
  return { day, date: `${values.year}-${values.month}-${values.day}` };
}

function studentDashboardLabel(student){
  return escapeHtml(student.full_name || student.email || 'Aluno sem nome');
}

let crmRegisteredDates=new Set();
async function loadReportPendencies(){
  const pending=[], registered=new Set();
  const studentById=new Map(students.filter(s=>!s.is_test_profile).map(s=>[s.id,s]));
  for(let offset=0;;offset+=500){
    const {data,error}=await sb.from('lessons').select('id,student_id,group_id,lesson_date,title,calendar_status,report_pending_dismissed,resources(type)').order('id',{ascending:true}).range(offset,offset+499);
    if(error)throw error;
    const batch=data||[];
    for(const lesson of batch){
      const student=studentById.get(lesson.student_id);
      if(!student)continue;
      if(lesson.lesson_date&&(!lesson.calendar_status||lesson.calendar_status==='done'))registered.add(lesson.student_id+'|'+lesson.lesson_date);
      // Apenas aulas realizadas geram pendência de relatório de desempenho.
      if(lesson.calendar_status&&lesson.calendar_status!=='done')continue;
      if(lesson.report_pending_dismissed||(lesson.resources||[]).some(r=>r.type==='rep'))continue;
      pending.push({lesson,studentName:student.full_name||student.email||'Aluno',missingLesson:false});
    }
    if(batch.length<500)break;
  }
  for(const student of studentById.values()){
    for(const date of ccManualDoneDates(ccData(student))){
      if(registered.has(student.id+'|'+date)||crmDismissed(student.id,'missing:'+date))continue;
      pending.push({lesson:{student_id:student.id,lesson_date:date,title:'Aula realizada',group_id:ccData(student).events[date]?.group_id||null},studentName:student.full_name||student.email||'Aluno',missingLesson:true});
    }
  }
  crmRegisteredDates=registered;
  return pending.sort((a,b)=>(b.lesson.lesson_date||'').localeCompare(a.lesson.lesson_date||'')||a.studentName.localeCompare(b.studentName,'pt-BR'));
}
async function openMissingLesson(studentId,date){
  await openStudent(studentId);
  await ccOpenDate(studentId,date);
}

// Abre a videochamada da aula diretamente, sem navegar para o perfil.
function openTodayClassCall(studentId){
  const student = students.find(item => item.id === studentId);
  if (!student) {
    alert('Aluno não encontrado.');
    return;
  }
  const url = (student.permanent_lesson_link || '').trim();
  if (!url) {
    alert('Este aluno ainda não possui um link fixo de videochamada cadastrado.');
    return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Unsupported protocol');
    window.open(parsed.href, '_blank', 'noopener,noreferrer');
  } catch(error) {
    alert('O link de videochamada cadastrado para este aluno é inválido.');
  }
}

let crmHomeRequest=0;
async function renderHome(){
  currentStudent = null;
  currentView = 'home';
  renderNav();
  const today = adminToday();
  const homeRequest = ++crmHomeRequest;
  let completedIds = new Set(), registeredIds = new Set(), registeredLessons=[], agendaLoadError = false, groupLoadError=false;
  const groupsReady=tgLoad();
  // Resolve the group source before building or counting the daily agenda.
  try{await groupsReady;}catch(error){console.error('Agenda: falha ao consultar turmas',error);groupLoadError=true;}
  try { const {data,error}=await sb.from('lessons').select('student_id,calendar_status,group_id,lesson_date').eq('lesson_date',today.date); if(error)throw error; registeredLessons=data||[]; registeredIds=new Set((data||[]).map(l=>l.student_id)); completedIds=new Set((data||[]).filter(l=>!l.calendar_status||l.calendar_status==='done').map(l=>l.student_id)); } catch(error){console.error('Agenda: falha ao consultar aulas cadastradas',error);agendaLoadError=true;}
  if(currentView!=='home'||homeRequest!==crmHomeRequest)return;
  const classes = groupLoadError?[]:crmGroupDailyAgenda(ccAgenda(today,completedIds,true,registeredIds,registeredLessons));
  const main = document.getElementById('main-content');
  main.innerHTML = `

    <header class="crm-heading"><div><h1>Visão geral</h1><p>Painel de gestão acadêmica</p></div><div class="crm-heading-tools"><button class="crm-icon-btn" aria-label="Ver pendências" onclick="document.getElementById('crm-pendencias').scrollIntoView({behavior:'smooth'})">${crmIcon('bell')}</button><span class="crm-avatar crm-avatar-small">DC</span></div></header>
    <section class="crm-kpis">
     ${crmKpi('Alunos ativos',students.filter(s=>!s.is_test_profile).length,'users')}
     ${crmKpi('Aulas hoje',groupLoadError?'—':classes.length,'calendar')}
     ${crmKpi('Reposições pendentes',students.filter(s=>!s.is_test_profile).reduce((a,s)=>a+ccPending(ccData(s)),0),'refresh','crm-replacement-stat')}
     ${crmKpi('Pendências de aulas e relatórios','—','file','report-pending-stat')}
    </section>
    <div class="crm-home-layout">
      <div class="crm-home-column">
    <section class="crm-panel crm-today-panel"><div class="crm-panel-head"><h3>Agenda de hoje</h3><button class="crm-link" onclick="ccGlobalView()">Ver agenda completa →</button></div>
    <div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>Horário</th><th>Aluno</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${crmTodayRowsHtml(classes)||(groupLoadError?'<tr><td colspan="5" class="crm-empty">Agenda indisponível.</td></tr>':'<tr><td colspan="5" class="crm-empty">Nenhuma aula prevista para hoje.</td></tr>')}</tbody></table></div><p id="crm-agenda-feedback" class="crm-muted crm-agenda-feedback" role="status">${groupLoadError?'Não foi possível carregar as turmas. Reabra a Home para tentar novamente.':agendaLoadError?'Não foi possível consultar as aulas cadastradas. O status será verificado antes de salvar.':'Altere o status diretamente na tabela. Para ajustar a frequência individual de uma turma, abra o calendário.'}</p></section>
      <section class="crm-panel" id="crm-pendencias"><div class="crm-panel-head"><h3>Central de pendências</h3><span class="crm-muted" id="report-pending-count">—</span></div><div id="crm-other-pending">${crmOtherPending()}</div><div id="report-pending-list" aria-live="polite"><p class="crm-empty">Verificando relatórios...</p></div><div id="tg-home-pending">${tgPendingHtml()}</div></section>
      <section class="crm-panel crm-plan-panel" id="crm-weekly-planning" aria-label="Planejamento semanal"></section>
      </div>
      <div class="crm-home-column">
        <section class="crm-panel crm-month-panel" id="crm-month-calendar" aria-label="Calendário mensal"></section>
      <section class="crm-panel"><div class="crm-panel-head"><h3>Atividades recentes</h3></div><div id="admin-recent-activity-list" aria-live="polite"><p class="crm-empty">Carregando atividades...</p></div></section>
      </div>
    </div>
  `;
  renderRecentAdminActivity();
  crmMountMonthlyCalendar(document.getElementById('crm-month-calendar'),groupsReady);
  crmMountWeeklyPlanning(document.getElementById('crm-weekly-planning'),groupsReady);
  try {
    await groupsReady;
    const pendencies = await loadReportPendencies();
    // Evita sobrescrever outra tela se o usuário navegar durante o carregamento.
    if (currentView !== 'home' || homeRequest!==crmHomeRequest || !document.getElementById('report-pending-list')) return;
    document.getElementById('report-pending-count').textContent = String(pendencies.length);
    document.getElementById('report-pending-stat').textContent = String(pendencies.length);
    document.getElementById('report-pending-list').innerHTML = crmGroupedLessons(pendencies);
    document.getElementById('crm-other-pending').innerHTML=crmOtherPending();
    document.getElementById('crm-replacement-stat').textContent=String(students.filter(s=>!s.is_test_profile).reduce((n,s)=>n+Object.entries(ccData(s).events).filter(([date,e])=>!e.group_id&&['owed','teacher'].includes(e.status)&&!crmRegisteredDates.has(s.id+'|'+date)&&!Object.entries(ccData(s).events).some(([d,v])=>v.original===date&&(v.status==='done'||crmRegisteredDates.has(s.id+'|'+d)))).length,0)+tgGroupReplacementRows().length);
  } catch(error) {
    console.error('Falha ao consultar pendências de relatórios:', error);
    if (currentView !== 'home') return;
    const count = document.getElementById('report-pending-count');
    const list = document.getElementById('report-pending-list');
    if (count) count.textContent = '—';
    const stat = document.getElementById('report-pending-stat');
    if (stat) stat.textContent = '—';
    if (list) list.innerHTML = '<div class="small-note">Não foi possível carregar as pendências. Abra a Home novamente para tentar.</div>';
  }
}


async function renderRecentAdminActivity(){
  const target = document.getElementById('admin-recent-activity-list');
  if (!target) return;
  try {
    let query = sb.from('activity_log')
      .select('student_id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(6);
    if (teacherTestProfile) query = query.neq('student_id', teacherTestProfile.id);
    const { data, error } = await query;
    if (error) throw error;
    if (currentView !== 'home' || !target.isConnected) return;
    if (!data || !data.length) {
      target.innerHTML = '<p class="dashboard-muted">Ainda não há atividades registradas.</p>';
      return;
    }
    const names = new Map(students.map(s => [s.id, s.full_name || s.email]));
    target.innerHTML = data.map(log => {
      const date = new Date(log.created_at);
      const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
      const action = ACTIVITY_LABELS[log.action] || log.action;
      return '<div class="admin-activity-row"><span class="admin-activity-marker" aria-hidden="true"></span>' +
        '<div><strong>' + escapeHtml(names.get(log.student_id) || 'Aluno') + '</strong>' +
        '<small>' + escapeHtml(action) + '</small></div><time>' + escapeHtml(when) + '</time></div>';
    }).join('');
  } catch (error) {
    console.error('Erro ao carregar atividades recentes:', error);
    if (target.isConnected) target.innerHTML = '<p class="dashboard-muted">Não foi possível carregar as atividades.</p>';
  }
}

async function dismissReportPending(lessonId){
  if (!confirm('Descartar esta pendência? A aula e os materiais serão mantidos. Esta pendência não aparecerá novamente na Home.')) return;
  const { error } = await sb.from('lessons')
    .update({ report_pending_dismissed: true })
    .eq('id', lessonId);
  if (error) {
    console.error('Não foi possível descartar a pendência:', error);
    alert('Não foi possível descartar a pendência. Tente novamente.');
    return;
  }
  if (currentView === 'home') await renderHome();
}

async function openPendingReport(studentId, lessonId){
  await openStudent(studentId);
  openAddMaterialToLesson(lessonId);
}

let guiasCurrentLevel = 'basico';
const GUIAS_LEVEL_LABELS = { basico: 'Básico (A1/A2)', intermediario: 'Intermediário (B1/B2)', avancado: 'Avançado (C1)' };
const GUIAS_SUBLEVELS = { basico: ['A1','A2'], intermediario: ['B1','B2'], avancado: ['C1'] };

async function openGuias(){
  currentStudent = null;
  currentView = 'guias';
  renderNav();
  await renderGuiasView();
}

async function renderGuiasView(){
  const { data: settingData } = await sb.from('app_settings').select('value').eq('key', 'grammar_guides_locked').single();
  const isLocked = !settingData || settingData.value !== 'false';

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Guias de Gramática</h1>
        <div class="sub">Materiais organizados por nível (Básico, Intermediário, Avançado)</div>
      </div>
    </div>

    <div class="box" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <h3 style="margin:0 0 4px;">Status para os alunos</h3>
        <div class="small-note" style="margin-top:0;">
          ${isLocked
            ? 'O conteúdo está BLOQUEADO — os alunos não veem esta seção em lugar nenhum do portal.'
            : 'O conteúdo está DESBLOQUEADO — todos os alunos já podem acessar os Guias de Gramática.'}
        </div>
      </div>
      <div style="flex:0 0 auto;">
        <button class="btn-dark-sm" onclick="setGuiasLock(true)" ${isLocked ? 'disabled' : ''}>Bloquear conteúdo</button>
        <button class="btn-ghost" onclick="setGuiasLock(false)" ${!isLocked ? 'disabled' : ''}>Desbloquear conteúdo</button>
      </div>
    </div>

    <div class="role-switch" style="max-width:460px;margin-bottom:20px;">
      <button class="${guiasCurrentLevel === 'basico' ? 'active' : ''}" onclick="switchGuiasLevel('basico')">Básico (A1/A2)</button>
      <button class="${guiasCurrentLevel === 'intermediario' ? 'active' : ''}" onclick="switchGuiasLevel('intermediario')">Intermediário (B1/B2)</button>
      <button class="${guiasCurrentLevel === 'avancado' ? 'active' : ''}" onclick="switchGuiasLevel('avancado')">Avançado (C1)</button>
    </div>

    <div id="guias-level-content"></div>
  `;

  await renderGuiasLevelContent();
}

async function setGuiasLock(locked){
  const { error } = await sb.from('app_settings')
    .update({ value: locked ? 'true' : 'false' })
    .eq('key', 'grammar_guides_locked');

  if (error) { alert('Não foi possível atualizar o status.'); console.error(error); return; }
  renderGuiasView();
}

function switchGuiasLevel(level){
  guiasCurrentLevel = level;
  renderGuiasView();
}

async function renderGuiasLevelContent(){
  const level = guiasCurrentLevel;
  const container = document.getElementById('guias-level-content');
  container.innerHTML = `<div class="empty-state">Carregando materiais...</div>`;

  const { data, error } = await sb
    .from('grammar_materials')
    .select('*')
    .eq('level', level)
    .order('created_at', { ascending: true });

  if (error) {
    container.innerHTML = `<div class="empty-state">Não foi possível carregar os materiais.</div>`;
    return;
  }

  const rows = (data || []).map(m => materialRowHtml(m)).join('')
    || `<div class="empty-state">Nenhum material no nível ${GUIAS_LEVEL_LABELS[level]} ainda.</div>`;

  container.innerHTML = `
    <div class="lesson-card">
      <h3>Materiais — ${GUIAS_LEVEL_LABELS[level]}</h3>
      ${rows}
    </div>

    <div class="box">
      <h3>+ Adicionar material ao nível ${GUIAS_LEVEL_LABELS[level]}</h3>
      <div class="row">
        <select id="guias-material-sublevel">
          ${GUIAS_SUBLEVELS[level].map(sl => `<option value="${sl}">${sl}</option>`).join('')}
        </select>
        <input id="guias-material-title" placeholder="Título do material (ex: Present Perfect — teoria e exercícios)">
      </div>
      ${level === 'basico' ? `
      <div class="row">
        <div>
          <label>Arquivo em Português</label>
          <input id="guias-material-file" type="file" accept=".pdf">
        </div>
        <div>
          <label>Arquivo em Inglês</label>
          <input id="guias-material-file-en" type="file" accept=".pdf">
        </div>
      </div>
      ` : `
      <div class="row">
        <input id="guias-material-file" type="file">
      </div>
      `}
      <div class="row">
        <input id="guias-material-youtube" placeholder="Link do YouTube (opcional — pode ser adicionado depois também)">
      </div>
      <div style="margin-top:12px;">
        <button id="guias-upload-btn" class="btn-dark-sm" onclick="uploadGrammarMaterial()">Adicionar material</button>
      </div>
    </div>
  `;
}

function materialRowHtml(m){
  const sublevelBadge = `<div class="resource-icon ic-pdf" style="width:26px;height:26px;font-size:10.5px;flex-shrink:0;">${escapeHtml(m.sublevel || '')}</div>`;
  const langBadge = m.file_path_en ? `<span class="pill" style="background:var(--sky-soft);">PT + EN</span>` : '';

  if (m.youtube_link) {
    return `
      <div class="lesson-card" style="padding:12px 16px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${sublevelBadge}
            <div class="name" style="font-weight:600;font-size:14px;">${escapeHtml(m.title)}</div>
            ${langBadge}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span class="pill" style="background:${m.video_visible ? 'var(--sky-soft)' : '#EFEBE3'};">${m.video_visible ? 'Vídeo visível' : 'Vídeo oculto'}</span>
            <button class="btn-ghost" onclick="toggleVideoVisible('${m.id}', ${m.video_visible ? 'false' : 'true'})">${m.video_visible ? 'Ocultar link' : 'Exibir link'}</button>
            <button class="resource-action" onclick="deleteGrammarMaterial('${m.id}')">Excluir</button>
          </div>
        </div>
        <div class="row" style="margin-top:8px;">
          <input id="yt-input-${m.id}" value="${escapeAttr(m.youtube_link)}" placeholder="Link do YouTube">
          <button class="btn-ghost" style="flex:0 0 auto;" onclick="saveYoutubeLink('${m.id}')">Salvar link</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="lesson-card" style="padding:12px 16px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${sublevelBadge}
          <div class="name" style="font-weight:600;font-size:14px;">${escapeHtml(m.title)}</div>
          ${langBadge}
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-ghost" onclick="toggleAddVideoForm('${m.id}')">+ Adicionar vídeo</button>
          <button class="resource-action" onclick="deleteGrammarMaterial('${m.id}')">Excluir</button>
        </div>
      </div>
      <div id="add-video-form-${m.id}" class="row" style="margin-top:8px;display:none;">
        <input id="yt-input-${m.id}" placeholder="Colar link do YouTube">
        <button class="btn-dark-sm" style="flex:0 0 auto;" onclick="saveYoutubeLink('${m.id}')">Salvar link</button>
      </div>
    </div>
  `;
}

function toggleAddVideoForm(id){
  const el = document.getElementById(`add-video-form-${id}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

async function saveYoutubeLink(id){
  const input = document.getElementById(`yt-input-${id}`);
  const val = input.value.trim();
  const { error } = await sb.from('grammar_materials').update({ youtube_link: val || null }).eq('id', id);
  if (error) { alert('Não foi possível salvar o link.'); console.error(error); return; }
  await renderGuiasLevelContent();
}

async function toggleVideoVisible(id, newVal){
  const { error } = await sb.from('grammar_materials').update({ video_visible: newVal === 'true' || newVal === true }).eq('id', id);
  if (error) { alert('Não foi possível atualizar.'); console.error(error); return; }
  await renderGuiasLevelContent();
}

async function uploadGrammarMaterial(){
  const title = document.getElementById('guias-material-title').value.trim();
  const fileInput = document.getElementById('guias-material-file');
  const file = fileInput.files[0];
  const youtubeLink = document.getElementById('guias-material-youtube').value.trim();
  const sublevel = document.getElementById('guias-material-sublevel').value;
  const level = guiasCurrentLevel;

  const fileEnInput = level === 'basico' ? document.getElementById('guias-material-file-en') : null;
  const fileEn = fileEnInput ? fileEnInput.files[0] : null;

  if (!title) { alert('Dê um título para o material.'); return; }
  if (!file) { alert(`Escolha o arquivo${level === 'basico' ? ' em português' : ''}.`); return; }
  if (level === 'basico' && !fileEn) { alert('Para o nível Básico, envie também o arquivo em inglês.'); return; }

  const btn = document.getElementById('guias-upload-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `grammar/${level}/${Date.now()}_${safeFileName}`;

  const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);

  if (uploadError) {
    alert('Não foi possível enviar o arquivo.');
    console.error(uploadError);
    btn.disabled = false;
    btn.textContent = 'Adicionar material';
    return;
  }

  let filePathEn = null;
  if (fileEn) {
    const safeFileNameEn = fileEn.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    filePathEn = `grammar/${level}/${Date.now()}_en_${safeFileNameEn}`;

    const { error: uploadErrorEn } = await sb.storage.from(STORAGE_BUCKET).upload(filePathEn, fileEn);
    if (uploadErrorEn) {
      alert('O arquivo em português foi enviado, mas houve um erro ao enviar o arquivo em inglês.');
      console.error(uploadErrorEn);
      filePathEn = null;
    }
  }

  const { error: insertError } = await sb.from('grammar_materials').insert({
    level, title, file_path: filePath, file_path_en: filePathEn, youtube_link: youtubeLink || null, sublevel
  });

  if (insertError) {
    alert('O arquivo foi enviado, mas não foi possível salvar as informações.');
    console.error(insertError);
  }

  await renderGuiasLevelContent();
}

async function deleteGrammarMaterial(id){
  if (!confirm('Excluir este material?')) return;
  const { error } = await sb.from('grammar_materials').delete().eq('id', id);
  if (error) { alert('Não foi possível excluir.'); return; }
  await renderGuiasLevelContent();
}

function openComunicados(){
  currentStudent = null;
  currentView = 'comunicados';
  renderNav();

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Comunicados</h1>
        <div class="sub">Envie um aviso por e-mail para os alunos que você escolher</div>
      </div>
    </div>

    <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
      <div class="lesson-card" style="flex:2;min-width:320px;">
        <h3>Novo comunicado</h3>
        <label>Assunto</label>
        <input id="broadcast-subject" placeholder="Ex: Aviso importante sobre as aulas desta semana">
        <label>Mensagem</label>
        <textarea id="broadcast-message" placeholder="Escreva aqui o comunicado..."></textarea>
        <label>Anexo (opcional)</label>
        <input id="broadcast-file" type="file">
        <div class="small-note" style="margin-bottom:12px;">O anexo vira um link de download dentro do e-mail.</div>
        <button id="broadcast-btn" class="btn-dark-sm" onclick="sendBroadcast()">Enviar comunicado</button>
        <div id="broadcast-feedback" class="feedback"></div>
      </div>

      <div class="lesson-card" style="flex:1;min-width:220px;">
        <h3>Destinatários</h3>
        ${students.length === 0 ? `
          <div class="empty-state">Nenhum aluno cadastrado ainda.</div>
        ` : `
          <label class="broadcast-recipient-row broadcast-recipient-all">
            <input type="checkbox" id="broadcast-select-all" onchange="toggleSelectAllStudents(this.checked)">
            Todos os alunos reais
          </label>
          <div id="broadcast-student-list">
            ${students.map(s => `
              <label class="broadcast-recipient-row">
                <input type="checkbox" class="broadcast-student-checkbox" data-test-profile="${s.is_test_profile ? 'true' : 'false'}" value="${s.id}" onchange="updateSelectAllState()">
                ${escapeHtml(s.full_name || s.email)}${s.is_test_profile ? ' — ' + escapeHtml(TEACHER_TEST_EMAIL) : ''}
              </label>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function toggleSelectAllStudents(checked){
  document.querySelectorAll('.broadcast-student-checkbox:not([data-test-profile="true"])').forEach(cb => { cb.checked = checked; });
}

function updateSelectAllState(){
  const all = document.querySelectorAll('.broadcast-student-checkbox:not([data-test-profile="true"])');
  const checkedCount = document.querySelectorAll('.broadcast-student-checkbox:not([data-test-profile="true"]):checked').length;
  document.getElementById('broadcast-select-all').checked = all.length > 0 && checkedCount === all.length;
}

async function sendBroadcast(){
  const subject = document.getElementById('broadcast-subject').value.trim();
  const message = document.getElementById('broadcast-message').value.trim();
  const fileInput = document.getElementById('broadcast-file');
  const file = fileInput.files[0];
  const feedbackEl = document.getElementById('broadcast-feedback');

  if (!subject || !message) {
    feedbackEl.className = 'feedback show err';
    feedbackEl.textContent = 'Preencha o assunto e a mensagem.';
    return;
  }

  const selectedIds = Array.from(document.querySelectorAll('.broadcast-student-checkbox:checked')).map(cb => cb.value);
  if (selectedIds.length === 0) {
    feedbackEl.className = 'feedback show err';
    feedbackEl.textContent = 'Selecione ao menos um aluno para receber o comunicado.';
    return;
  }

  const recipients = students.filter(s => selectedIds.includes(s.id));
  // O endereço do perfil de teste é sempre o informado pelo professor.
  // Isso não depende do e-mail do perfil administrador no Supabase.
  const testRecipient = recipients.find(s => s.is_test_profile);
  if (testRecipient) testRecipient.email = TEACHER_TEST_EMAIL;

  if (!confirm(`Enviar este comunicado para ${recipients.length} destinatário(s)?${testRecipient ? '\\nPerfil de teste: ' + TEACHER_TEST_EMAIL : ''}`)) return;

  const btn = document.getElementById('broadcast-btn');
  btn.disabled = true;

  // Envia o anexo primeiro (se houver), gerando um botão de download pra colocar no e-mail
  let attachmentHtml = '';
  if (file) {
    btn.textContent = 'Enviando anexo...';
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `comunicados/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      feedbackEl.className = 'feedback show err';
      feedbackEl.textContent = 'Não foi possível enviar o anexo. Tente novamente.';
      btn.disabled = false;
      btn.textContent = 'Enviar comunicado';
      return;
    }

    const { data: urlData } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 30, { download: file.name });
    const attachmentUrl = urlData ? urlData.signedUrl : null;

    if (attachmentUrl) {
      attachmentHtml = `
        <table role="presentation" style="border-collapse:collapse;margin:16px 0 4px;">
          <tr>
            <td style="background-color:#5B93C4;border-radius:7px;">
              <a href="${attachmentUrl}" style="display:inline-block;padding:11px 20px;font-size:13.5px;color:#ffffff;text-decoration:none;font-weight:bold;">
                Baixar anexo (${escapeHtml(file.name)})
              </a>
            </td>
          </tr>
        </table>`;
    }
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const s = recipients[i];
    btn.textContent = `Enviando... (${i + 1}/${recipients.length})`;
    const result = await sendLessonNotification(s.email, s.full_name, message, subject, attachmentHtml);
    if (result.ok) successCount++; else failCount++;
  }

  btn.disabled = false;
  btn.textContent = 'Enviar comunicado';

  feedbackEl.className = 'feedback show ' + (failCount === 0 ? 'ok' : 'err');
  feedbackEl.textContent = failCount === 0
    ? `Comunicado enviado com sucesso para ${successCount} aluno(s)!`
    : `Enviado para ${successCount} aluno(s). ${failCount} falharam — verifique o console para detalhes.`;

  if (failCount === 0) {
    document.getElementById('broadcast-subject').value = '';
    document.getElementById('broadcast-message').value = '';
    document.getElementById('broadcast-file').value = '';
  }
}

async function refreshStudents(){
  await loadStudents();
  renderNav();
  renderHome();
}

async function openStudent(studentId){
  const student = students.find(s => s.id === studentId);
  if (!student) return;
  currentStudent = student;
  currentView = 'student';
  currentTab = 'resumo';
  renderNav();
  await Promise.all([loadLessonsFor(studentId),refreshPendingCounts()]);
  if(currentView!=='student'||currentStudent?.id!==studentId)return;
  renderStudentDetail();
}

function switchTab(tab){
  const alias=tab==='nova'||tab==='cadastradas';
  currentTab = alias?'calendario':tab;
  renderStudentDetail();
  if(tab==='nova')ccOpenSuggested();
  if(tab==='cadastradas')ccLessonHistory();
}

async function loadLessonsFor(studentId){
  currentLessonsReady=false;
  const rows=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await sb.from('lessons').select('*, resources(*)').eq('student_id',studentId).order('id',{ascending:true}).range(offset,offset+499);
    if(currentStudent?.id!==studentId)return;
    if(error){console.error(error);currentLessons=[];return;}
    rows.push(...(data||[]));if((data||[]).length<500)break;
  }
  currentLessons=sortLessonsByDate(rows,false);currentLessonsReady=true;
}
function renderStudentDetail(){
  const s = currentStudent;

  const lessonsHtml = currentLessons.map(l => {
    const rows = (l.resources || []).map(r => resourceRowWithEditHtml(l, r)).join('') || `<div class="empty-state">Nenhum material nesta aula ainda.</div>`;

    return `<div class="lesson-card" id="crm-lesson-${escapeAttr(l.id)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h3>${escapeHtml(l.title)}</h3>
          <div class="meta">${escapeHtml(l.topic || '')}${l.lesson_date ? ' · ' + formatDate(l.lesson_date) : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn-ghost" onclick="crmEditLesson('${l.id}')">Editar aula</button>
          <button class="btn-ghost" onclick="openAddMaterialToLesson('${l.id}')">+ Adicionar material</button>
          <button class="resource-action" onclick="deleteLesson('${l.id}')">Excluir aula</button>
        </div>
      </div>
      ${rows}
    </div>`;
  }).join('') || `<div class="empty-state">Nenhuma aula cadastrada para ${escapeHtml(s.full_name || s.email)} ainda.</div>`;

  const metrics=crmStudentMetrics(s,currentLessons);
  document.getElementById('main-content').innerHTML = `
    <div class="crm-dossier">
    <div class="crm-dossier-top"><button class="crm-link crm-back" onclick="ccRoster()">← Todos os alunos</button><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-ghost" onclick="crmMaterialSearch(currentStudent.id)">Buscar material</button><button class="btn-dark-sm" onclick="switchTab('nova')">${crmIcon('plus')} Cadastrar aula</button></div></div>
    <section class="crm-profile-head crm-dossier-head"><span class="crm-avatar">${s.avatar_url?'<img src="'+escapeAttr(s.avatar_url)+'" alt="" class="crm-dossier-photo">':escapeHtml((s.full_name||s.email||'A').charAt(0).toUpperCase())}</span><div class="crm-dossier-identity"><h1>${escapeHtml(s.full_name||s.email)}</h1><p>${crmPlan(ccData(s))} · ${escapeHtml(s.email||'')}</p><small class="crm-muted">${s.is_test_profile?'Perfil de teste':(s.lesson_weekday?WEEKDAY_LABELS[s.lesson_weekday-1]+' · '+escapeHtml((s.lesson_time||'').slice(0,5)):'Horário habitual não definido')}</small></div><button class="btn-ghost" onclick="openTodayClassCall(currentStudent.id)">${crmIcon('video')} Videochamada</button></section>
    <section class="crm-kpis crm-kpis-three">${crmKpi('Carga anual',metrics.count+'/'+(metrics.target??'—'),'chart')}${crmKpi('Reposições',metrics.pending,'refresh')}${crmKpi('Frequência',metrics.frequency,'calendar')}</section>
    <div class="crm-dossier-layout"><nav class="crm-dossier-nav" aria-label="Ficha do aluno">
    ${[['ACOMPANHAMENTO',[['resumo','Resumo','dashboard'],['calendario','Calendário e aulas','calendar'],['atividade','Atividades','chart'],['estudos','Estudos e conquistas','graduation'],['vocab','Vocabulário','book']]],['CAIXA DE ENTRADA',[['pedidos','Material do Aluno','file','materials'],['duvidas','Perguntas','message','questions'],['textos-aluno','Textos para correção','file','texts']]],['CONFIGURAÇÕES',[['perfil','Cadastro','settings']]]].map(([group,items])=>'<div class="crm-dossier-label">'+group+'</div>'+items.map(([k,label,icon,kind])=>'<button class="'+(currentTab===k?'active':'')+'" onclick="switchTab(&quot;'+k+'&quot;)">'+crmIcon(icon)+'<span>'+label+'</span>'+(kind?'<span data-crm-inbox="'+escapeAttr(s.id)+'" data-crm-kind="'+kind+'">'+crmCountBadge(crmInboxFor(s.id)[kind].length,label)+'</span>':'')+'</button>').join('')).join('')}
    </nav><div class="crm-dossier-content">
    <div id="tab-content"></div></div></div></div>
  `;

  if (currentTab === 'resumo') {
    crmStudentSummary();
  } else if (currentTab === 'vocab') {
    window.renderVocabTab();
  } else if (currentTab === 'estudos') {
    crmStudyTab();
  } else if (currentTab === 'duvidas' || currentTab === 'textos-aluno') {
    crmStudentInboxTab(currentTab);
  } else if (currentTab === 'perfil') {
    renderPerfilTab();
  } else if (currentTab === 'calendario') {
    ccRender();
  } else if (currentTab === 'nova') {
    renderNovaAulaTab();
  } else if (currentTab === 'cadastradas') {
    renderAulasCadastradasTab(lessonsHtml);
  } else if (currentTab === 'pedidos') {
    renderPedidosTab();
  } else {
    renderAtividadeTab();
  }
}

function renderPerfilTab(){
  const s = currentStudent;
  if (s.is_test_profile) {
    document.getElementById('tab-content').innerHTML = `
      <div class="box teacher-test-panel">
        <h3>Seu aluno de teste</h3>
        <p>Este perfil usa seu login atual, sem criar outra conta. Aulas, materiais e atividades ficam vinculados ao seu ID, sem entrar nos indicadores dos alunos reais.</p>
        <div class="test-mode-actions">
          <button type="button" class="btn-dark-sm" onclick="enterStudentTestMode()">Abrir visão do aluno →</button>
          <button type="button" class="btn-ghost" onclick="switchTab('nova')">Cadastrar aula de teste</button>
        </div>
        <p class="small-note">Os comunicados selecionados para este perfil chegam a ${escapeHtml(TEACHER_TEST_EMAIL)}. Outros testes não disparam e-mails.</p>
      </div>
      <div class="box"><h3>Mural de conquistas — teste</h3>
        ${buildAchievementsSection(crmCompletedLocalCount(), {title:''}) || '<p class="small-note">Os emblemas aparecem após 10 aulas de teste.</p>'}
      </div>
      <div class="box"><h3>Status de estudo — teste</h3><div id="grammar-status-box">Carregando...</div></div>
    `;
    renderGrammarStatusBox(s.id);
    return;
  }
  document.getElementById('tab-content').innerHTML = `
    <div class="box">
      <h3>Perfil do aluno</h3>
      <div class="row" style="align-items:center;">
        ${s.avatar_url
          ? `<img id="student-avatar-preview" src="${s.avatar_url}" alt="Foto" style="width:56px;height:56px;min-width:56px;border-radius:50%;object-fit:cover;flex:0 0 auto;">`
          : `<div id="student-avatar-preview" style="width:56px;height:56px;min-width:56px;border-radius:50%;background:var(--sky-soft);flex:0 0 auto;"></div>`}
        <input id="student-avatar-file" type="file" accept="image/*">
      </div>
      <div class="row" style="margin-top:12px;">
        <input id="student-name-input" placeholder="Nome completo" value="${escapeAttr(s.full_name || '')}">
        <button class="btn-dark-sm" style="flex:0 0 auto;" onclick="saveStudentName()">Salvar nome</button>
      </div>
    </div>

    <div class="box">
      <h3>Link fixo da aula</h3>
      <div class="small-note" style="margin-top:0;margin-bottom:10px;">Este link fica disponível no perfil do aluno (ex: link de videochamada permanente).</div>
      <div class="row">
        <input id="student-link-input" placeholder="https://..." value="${escapeAttr(s.permanent_lesson_link || '')}" ${s.permanent_lesson_link ? 'disabled' : ''}>
      </div>
      <div class="row" style="margin-top:10px;">
        <button id="link-save-btn" class="btn-dark-sm" style="flex:0 0 auto;${s.permanent_lesson_link ? 'display:none;' : ''}" onclick="saveStudentLink()">Salvar link</button>
        <button id="link-edit-btn" class="btn-ghost" style="flex:0 0 auto;${s.permanent_lesson_link ? '' : 'display:none;'}" onclick="enableLinkEditing()">Editar link</button>
        <button id="link-open-btn" class="btn-ghost" style="flex:0 0 auto;${s.permanent_lesson_link ? '' : 'display:none;'}" onclick="openStudentLink()">Abrir aula</button>
      </div>

      <div style="border-top:1px solid var(--line);margin:20px 0 16px;"></div>

      <h3 style="margin-bottom:6px;">Dia e horário fixo da aula</h3>
      <div class="small-note" style="margin-top:0;margin-bottom:10px;">Usado só como referência (pra você e pro aluno) — e também define a ordem dos alunos na lista ao lado.</div>
      <div class="row">
        <select id="student-weekday-input">
          <option value="">Sem dia definido</option>
          ${WEEKDAY_LABELS.map((label, idx) => `<option value="${idx + 1}" ${s.lesson_weekday === idx + 1 ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <input id="student-time-input" type="time" value="${s.lesson_time ? s.lesson_time.slice(0,5) : ''}">
      </div>
      <button class="btn-dark-sm" style="margin-top:10px;" onclick="saveStudentSchedule()">Salvar dia e horário</button>
    </div>

    <div class="box">
      <h3>Redefinir senha do aluno</h3>
      <div class="small-note" style="margin-top:0;margin-bottom:10px;">
        Por segurança, o professor não consegue trocar a senha de outra pessoa diretamente pelo site.
        Digite a nova senha abaixo e clique em "Gerar comando" — copie o comando gerado e cole no
        <b>SQL Editor</b> do Supabase para efetivar a troca.
      </div>
      <div class="row">
        <input id="student-newpass-input" type="password" placeholder="Nova senha (mín. 6 caracteres)">
        <button class="btn-dark-sm" style="flex:0 0 auto;" onclick="generatePasswordSQL()">Gerar comando</button>
      </div>
      <textarea id="password-sql-output" readonly style="display:none;width:100%;margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:7px;font-family:monospace;font-size:12.5px;height:70px;"></textarea>
      <button id="copy-sql-btn" class="btn-ghost" style="display:none;margin-top:8px;" onclick="copyPasswordSQL()">Copiar comando</button>
    </div>
  `;

  document.getElementById('student-avatar-file').addEventListener('change', uploadStudentAvatar);

}

async function renderGrammarStatusBox(studentId){
  const box = document.getElementById('grammar-status-box');
  if (!box) return;

  const { data, error } = await sb
    .from('grammar_material_status')
    .select('status, grammar_materials(title, level, sublevel)')
    .eq('student_id', studentId);

  if (error) { box.innerHTML = `<div class="small-note" style="margin-top:0;">Não foi possível carregar.</div>`; return; }

  const studied = (data || []).filter(r => r.status === 'estudado' && r.grammar_materials);
  const more = (data || []).filter(r => r.status === 'estudar_mais' && r.grammar_materials);

  if (studied.length === 0 && more.length === 0) {
    box.innerHTML = `<div class="small-note" style="margin-top:0;">O aluno ainda não marcou nenhum material.</div>`;
    return;
  }

  const listHtml = (rows, emptyMsg) => rows.length
    ? `<ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:1.7;">${rows.map(r => `<li>${escapeHtml(r.grammar_materials.title)} <span class="small-note" style="display:inline;">(${GUIAS_LEVEL_LABELS[r.grammar_materials.level] || r.grammar_materials.level})</span></li>`).join('')}</ul>`
    : `<div class="small-note" style="margin-top:0;">${emptyMsg}</div>`;

  box.innerHTML = `
    <div class="row" style="align-items:flex-start;">
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--sage);margin-bottom:6px;">✓ Já estudou</div>
        ${listHtml(studied, 'Nenhum ainda.')}
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--amber);margin-bottom:6px;">↻ Precisa estudar mais</div>
        ${listHtml(more, 'Nenhum ainda.')}
      </div>
    </div>
  `;
}

let danielSubTab = 'pending'; // 'pending' | 'answered'

async function openDanielModule(){
  currentStudent = null;
  currentView = 'daniel';
  renderNav();
  await renderDanielModuleView();
}

async function renderDanielModuleView(){
  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Pergunte ao Daniel</h1>
        <div class="sub">Perguntas enviadas por todos os alunos</div>
      </div>
    </div>

    <div class="role-switch" style="max-width:420px;margin-bottom:20px;">
      <button class="${danielSubTab === 'pending' ? 'active' : ''}" onclick="switchDanielSubTab('pending')">Perguntas a responder</button>
      <button class="${danielSubTab === 'answered' ? 'active' : ''}" onclick="switchDanielSubTab('answered')">Perguntas respondidas</button>
    </div>

    <div id="daniel-module-content"></div>
  `;

  await renderDanielModuleList();
}

function switchDanielSubTab(tab){
  danielSubTab = tab;
  renderDanielModuleView();
}

async function renderDanielModuleList(){
  const container = document.getElementById('daniel-module-content');
  container.innerHTML = `<div class="empty-state">Carregando perguntas...</div>`;

  let query = sb.from('daniel_questions').select('*, profiles(full_name, email)').order('created_at', { ascending: false });
  query = danielSubTab === 'pending' ? query.is('answer', null) : query.not('answer', 'is', null);

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<div class="empty-state">Não foi possível carregar as perguntas.</div>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">${danielSubTab === 'pending' ? 'Nenhuma pergunta pendente no momento.' : 'Nenhuma pergunta respondida ainda.'}</div>`;
    return;
  }

  container.innerHTML = data.map(q => danielModuleRowHtml(q)).join('');
}

function danielModuleRowHtml(q){
  const isTest = !!teacherTestProfile && q.student_id === teacherTestProfile.id;
  const studentName = isTest ? TEACHER_TEST_NAME : ((q.profiles && (q.profiles.full_name || q.profiles.email)) || 'Aluno');
  const studentEmail = isTest ? TEACHER_TEST_EMAIL : (q.profiles ? q.profiles.email : '');
  const dateStr = new Date(q.created_at).toLocaleDateString('pt-BR');

  if (q.answer) {
    return `
      <details class="lesson-card">
        <summary style="cursor:pointer;font-weight:600;font-size:15px;list-style:none;display:flex;align-items:center;justify-content:space-between;">
          <span>${escapeHtml(studentName)} — ${escapeHtml(q.subject)}</span>
          <span class="pill" style="background:var(--sky-soft);">Respondida</span>
        </summary>
        <div style="margin-top:16px;">
          <div class="meta">Enviada em ${dateStr}</div>
          <p style="font-size:14px;margin:10px 0;">${escapeHtml(q.question)}</p>
          <label>Resposta</label>
          <textarea id="answer-${q.id}">${escapeHtml(q.answer)}</textarea>
          <div class="row">
            <button class="btn-dark-sm" onclick="updateAnswerNoEmail('${q.id}')">Editar resposta</button>
            <button class="btn-ghost" onclick="deleteQuestionByAdmin('${q.id}')">Excluir pergunta</button>
          </div>
        </div>
      </details>
    `;
  }

  return `
    <div class="lesson-card">
      <h3 style="margin:0 0 4px;">${escapeHtml(studentName)}</h3>
      <div class="meta">${escapeHtml(q.subject)}${studentEmail ? ' · ' + escapeHtml(studentEmail) : ''} · Enviada em ${dateStr}</div>
      <p style="font-size:14px;margin:10px 0;">${escapeHtml(q.question)}</p>
      <label>Sua resposta</label>
      <textarea id="answer-${q.id}" placeholder="Escreva a resposta para o aluno..."></textarea>
      <div class="row">
        <button class="btn-dark-sm" onclick="answerQuestionModule('${q.id}', '${escapeHtml(q.subject).replace(/'/g, "\\'")}', '${q.student_id}')">Responder ao aluno</button>
        <button class="btn-ghost" onclick="deleteQuestionByAdmin('${q.id}')">Excluir pergunta</button>
      </div>
    </div>
  `;
}

async function answerQuestionModule(questionId, subject, studentId){
  const answer = document.getElementById(`answer-${questionId}`).value.trim();
  if (!answer) { alert('Escreva uma resposta antes de enviar.'); return; }

  const { error } = await sb.from('daniel_questions')
    .update({ answer, answered_at: new Date().toISOString() })
    .eq('id', questionId);

  if (error) { alert('Não foi possível salvar a resposta.'); console.error(error); return; }

  // Avisa o aluno dentro do próprio portal (sininho ao lado de "Pergunte ao Daniel")
  try { await sb.from('notifications').insert({ student_id: studentId, type: 'daniel_answered' }); } catch (e) { console.error('Erro ao criar notificação:', e); }

  if (teacherTestProfile && studentId === teacherTestProfile.id) {
    alert('Resposta salva. A notificação está disponível no modo aluno de teste.');
    renderDanielModuleList();
    await refreshPendingCounts();
    renderNav();
    return;
  }
  const { data: studentProfile } = await sb.from('profiles').select('email, full_name').eq('id', studentId).single();

  if (studentProfile) {
    const emailResult = await sendLessonNotification(
      studentProfile.email,
      studentProfile.full_name,
      `Sua pergunta sobre "${subject}" foi respondida. Confira no portal!`,
      `Sua pergunta sobre ${subject} foi respondida`
    );
    if (!emailResult.ok) {
      alert('Resposta salva, mas não foi possível enviar o e-mail avisando o aluno.');
    } else {
      alert('Resposta enviada ao aluno!');
    }
  }

  renderDanielModuleList();
  await refreshPendingCounts();
  renderNav();
}

async function updateAnswerNoEmail(questionId){
  const answer = document.getElementById(`answer-${questionId}`).value.trim();
  if (!answer) { alert('A resposta não pode ficar vazia.'); return; }

  const { error } = await sb.from('daniel_questions').update({ answer }).eq('id', questionId);
  if (error) { alert('Não foi possível salvar a alteração.'); console.error(error); return; }

  renderDanielModuleList();
}

async function deleteQuestionByAdmin(questionId){
  if (!confirm('Excluir esta pergunta? O aluno não será notificado.')) return;

  const { error } = await sb.from('daniel_questions').delete().eq('id', questionId);
  if (error) { alert('Não foi possível excluir.'); console.error(error); return; }

  renderDanielModuleList();
  await refreshPendingCounts();
  renderNav();
}

const ACTIVITY_LABELS = {
  login: 'Acessou o portal',
  download_material: 'Baixou um material de aula',
  download_grammar: 'Baixou um material de gramática',
  material_request: 'Enviou um pedido de material',
  daniel_question: 'Fez uma pergunta ao Daniel'
};

async function renderAtividadeTab(){
  document.getElementById('tab-content').innerHTML = `<div class="empty-state">Carregando atividades...</div>`;

  const { data, error } = await sb
    .from('activity_log')
    .select('*')
    .eq('student_id', currentStudent.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    document.getElementById('tab-content').innerHTML = `<div class="empty-state">Não foi possível carregar as atividades.</div>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById('tab-content').innerHTML = `<div class="empty-state">Nenhuma atividade registrada ainda para ${escapeHtml(currentStudent.full_name || currentStudent.email)}.</div>`;
    return;
  }

  const rows = data.map(log => {
    const dt = new Date(log.created_at);
    const dateStr = dt.toLocaleDateString('pt-BR');
    const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const label = ACTIVITY_LABELS[log.action] || log.action;
    return `
      <div class="resource-row">
        <div class="resource-icon ic-rep" style="width:26px;height:26px;font-size:10px;flex-shrink:0;">${dt.getDate()}</div>
        <div class="resource-info">
          <div class="name">${escapeHtml(label)}${log.details ? ' — ' + escapeHtml(log.details) : ''}</div>
          <div class="desc">${dateStr} às ${timeStr}</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('tab-content').innerHTML = `
    <div class="lesson-card">
      <h3>Atividade recente</h3>
      <div class="meta">Mostrando as últimas ${data.length} ações registradas</div>
      ${rows}
    </div>
  `;
}

async function renderPedidosTab(){
  document.getElementById('tab-content').innerHTML = `<div class="empty-state">Carregando pedidos...</div>`;

  const { data, error } = await sb
    .from('material_requests')
    .select('*')
    .eq('student_id', currentStudent.id)
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('tab-content').innerHTML = `<div class="empty-state">Não foi possível carregar os pedidos.</div>`;
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById('tab-content').innerHTML = `<div class="empty-state">${escapeHtml(currentStudent.full_name || currentStudent.email)} ainda não enviou nenhum pedido de material.</div>`;
    return;
  }

  const html = data.map(r => `
    <div class="lesson-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h3>Para ${formatDate(r.requested_date)}</h3>
          <div class="meta">Enviado em ${new Date(r.created_at).toLocaleDateString('pt-BR')}</div>
        </div>
        <button class="resource-action" onclick="deleteMaterialRequest('${r.id}')">Excluir</button>
      </div>
      ${r.notes ? `<p style="font-size:14px;margin:10px 0;">${escapeHtml(r.notes)}</p>` : ''}
      ${r.external_link ? renderMaterialExternalLink(r.external_link) : ''}
      ${r.file_path ? `<div class="resource-row"><div class="resource-icon ic-pdf">Arq</div><div class="resource-info"><div class="name">${escapeHtml(r.file_name || 'Arquivo enviado')}</div></div>${isPdfPath(r.file_path) ? `<button class="resource-action" onclick="previewFile('${r.file_path}')">Visualizar</button>` : ''}<button class="resource-action" onclick="downloadRequestFile('${r.file_path}')">Baixar</button></div>` : ''}
    </div>
  `).join('');

  document.getElementById('tab-content').innerHTML = html;
}

async function deleteMaterialRequest(id){
  if (!confirm('Excluir este pedido de material?')) return;
  const { error } = await sb.from('material_requests').delete().eq('id', id);
  if (error) { alert('Não foi possível excluir.'); return; }
  renderPedidosTab();
  await refreshPendingCounts();
  renderNav();
}

async function downloadRequestFile(filePath){
  const displayName = filePath.split('/').pop().replace(/^\d+_/, '');
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 60 * 10, { download: displayName });
  if (error || !data) { alert('Não foi possível baixar este arquivo.'); return; }
  window.location.href = data.signedUrl;
}

async function downloadLessonResource(filePath){
  const displayName = filePath.split('/').pop().replace(/^\d+_/, '');
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(filePath, 60 * 10, { download: displayName });
  if (error || !data) { alert('Não foi possível baixar este arquivo.'); return; }
  window.location.href = data.signedUrl;
}

let resourceRowCount = 0;

function suggestedLessonTitle(){
  // Sugestão editável: o professor pode usar qualquer título.
  const lessonNumbers = currentLessons.map(l => {
    const match = (l.title || '').match(/(?:Aula|Class)\s*#?\s*(\d+)/i);
    return match ? Number(match[1]) : 0;
  });
  const next = Math.max(currentLessons.length, ...lessonNumbers, 0) + 1;
  return 'Class #' + String(next).padStart(2, '0');
}

function renderNovaAulaTab(){
  resourceRowCount = 0;
  quickLessonFiles = [];
  const today = new Date();
  const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');

  document.getElementById('tab-content').innerHTML = `
    <div class="box">
      <h3>+ Cadastrar aula e materiais</h3>
      <div class="small-note" style="margin-top:0;">Crie a aula e envie slides, PDFs, exercícios ou relatórios em uma única etapa. Os arquivos são opcionais — você pode adicioná-los depois.</div>
      <div class="row">
        <input id="new-lesson-title" value="${escapeAttr(suggestedLessonTitle())}" placeholder="Título da aula">
        <input id="new-lesson-topic" placeholder="Tópico da aula">
        <input id="new-lesson-date" type="date" value="${localDate}">
      </div>
      <div style="margin-top:16px;">
        <label for="new-lesson-files" style="display:block;font-weight:600;margin-bottom:8px;">Materiais desta aula (opcional)</label>
        <input id="new-lesson-files" type="file" multiple style="display:none;" onchange="addQuickLessonFiles(this.files)" aria-label="Escolher materiais da aula">
        <div id="quick-upload-dropzone" style="border:2px dashed var(--sky);border-radius:12px;padding:22px 16px;text-align:center;transition:background .15s,border-color .15s;">
          <div style="font-size:26px;margin-bottom:8px;" aria-hidden="true">📁</div>
          <div style="font-weight:600;">Arraste e solte seus arquivos aqui</div>
          <div class="small-note" style="margin:7px 0 12px;">Adicione de pastas diferentes, em quantas etapas quiser. Os arquivos serão acumulados.</div>
          <button type="button" class="btn-ghost" onclick="document.getElementById('new-lesson-files').click()">+ Adicionar arquivos</button>
        </div>
        <div class="small-note" style="margin-top:8px;">Confira o tipo dos arquivos ou remova algum antes de salvar a aula.</div>
        <div id="quick-upload-files"></div>
      </div>
      <div style="margin-top:16px;">
        <button id="create-lesson-btn" class="btn-dark-sm" onclick="createLesson()">Salvar aula e materiais</button>
      </div>
      <div id="create-lesson-feedback" class="feedback" role="status" aria-live="polite"></div>
    </div>

    <div class="box" id="existing-lesson-materials">
      <h3>+ Adicionar materiais a uma aula já cadastrada</h3>
      <div class="small-note" style="margin-top:0;">Para enviar um relatório de desempenho depois dos slides, selecione a aula existente. Os arquivos anteriores serão mantidos.</div>
      <div class="row">
        <select id="resource-lesson" aria-label="Escolha a aula">
          ${currentLessons.map(l => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join('')}
        </select>
      </div>
      <div id="resource-rows-container"></div>
      <div style="margin-top:6px;">
        <button class="btn-ghost" onclick="addResourceRow()">+ Adicionar mais</button>
      </div>
      <div style="margin-top:12px;">
        <button id="upload-btn" class="btn-dark-sm" onclick="uploadResources()" ${currentLessons.length === 0 ? 'disabled' : ''}>
          ${currentLessons.length === 0 ? 'Cadastre uma aula primeiro' : 'Enviar materiais'}
        </button>
      </div>
      <div id="upload-feedback" class="feedback" role="status" aria-live="polite"></div>
    </div>
  `;

  const dropzone = document.getElementById('quick-upload-dropzone');
  if (dropzone) {
    let dragDepth = 0;
    const highlight = active => {
      dropzone.style.background = active ? 'var(--surface-hover, rgba(80,150,220,.12))' : '';
      dropzone.style.borderColor = active ? 'var(--primary, #2676bd)' : 'var(--sky)';
    };
    dropzone.addEventListener('dragenter', event => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      dragDepth++;
      highlight(true);
    });
    dropzone.addEventListener('dragover', event => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      highlight(true);
    });
    dropzone.addEventListener('dragleave', event => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) highlight(false);
    });
    dropzone.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth = 0;
      highlight(false);
      if (event.dataTransfer?.files?.length) addQuickLessonFiles(event.dataTransfer.files);
    });
  }

  const container = document.getElementById('resource-rows-container');
  for (let i = 0; i < 3; i++) {
    resourceRowCount++;
    container.insertAdjacentHTML('beforeend', resourceRowHtml(resourceRowCount));
  }
}



function addQuickLessonFiles(fileList){
  if (!fileList || !fileList.length) return;
  for (const file of Array.from(fileList)) {
    quickLessonFiles.push({ file, type: inferQuickResourceType(file.name) });
  }
  // Permite selecionar novamente o mesmo arquivo, mesmo após excluí-lo da lista.
  const input = document.getElementById('new-lesson-files');
  if (input) input.value = '';
  renderQuickUploadFiles();
}

function setQuickLessonFileType(index, type){
  if (quickLessonFiles[index] && Object.prototype.hasOwnProperty.call(TYPE_LABELS, type)) {
    quickLessonFiles[index].type = type;
  }
}

function removeQuickLessonFile(index){
  quickLessonFiles.splice(index, 1);
  renderQuickUploadFiles();
}

function renderQuickUploadFiles(){
  const box = document.getElementById('quick-upload-files');
  if (!box) return;
  if (!quickLessonFiles.length) {
    box.innerHTML = '<div class="small-note" style="margin-top:10px;">Nenhum arquivo adicionado. Você também pode salvar a aula sem materiais.</div>';
    return;
  }
  box.innerHTML = `<div class="small-note" style="margin-top:10px;">${quickLessonFiles.length} arquivo(s) selecionado(s)</div>` +
    quickLessonFiles.map(({ file, type }, index) => `
    <div class="row" style="align-items:center;margin-top:10px;gap:10px;">
      <div style="flex:2;min-width:160px;overflow-wrap:anywhere;font-size:13px;">${escapeHtml(file.name)}</div>
      <select id="quick-file-type-${index}" style="flex:1;min-width:140px;" aria-label="Tipo do arquivo ${escapeAttr(file.name)}" onchange="setQuickLessonFileType(${index}, this.value)">
        ${Object.entries(TYPE_LABELS).map(([key,label]) => `<option value="${key}" ${key === type ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <button type="button" class="resource-action" onclick="removeQuickLessonFile(${index})" aria-label="Remover arquivo ${escapeAttr(file.name)}">Remover</button>
    </div>
  `).join('');
}

// Leva diretamente à área de anexos sem alterar a aula escolhida nem apagar os materiais existentes.
function openAddMaterialToLesson(lessonId){
 const lesson=currentLessons.find(l=>l.id===lessonId);if(!lesson)return;
 if(lesson.group_id)return tgOpenDate(lesson.group_id,lesson.lesson_date);
 currentTab='calendario';renderStudentDetail();ccJump(lesson.lesson_date);
}
function resourceRowHtml(rowIndex){
  return `
    <div class="lesson-card" id="resource-row-${rowIndex}" style="padding:14px 16px;margin-bottom:10px;">
      <div class="row">
        <select id="resource-type-${rowIndex}">
          ${Object.entries(TYPE_LABELS).map(([type,label]) => `<option value="${type}">${label}</option>`).join('')}
        </select>
        <input id="resource-file-${rowIndex}" type="file" onchange="suggestExistingResourceType(${rowIndex}, this.files)">
      </div>
    </div>
  `;
}

function suggestExistingResourceType(rowIndex, fileList){
  if (!fileList || !fileList.length) return;
  const select = document.getElementById(`resource-type-${rowIndex}`);
  if (select) select.value = inferQuickResourceType(fileList[0].name);
}

function addResourceRow(){
  resourceRowCount++;
  document.getElementById('resource-rows-container').insertAdjacentHTML('beforeend', resourceRowHtml(resourceRowCount));
}

async function uploadResources(){
  const lessonId = document.getElementById('resource-lesson').value;
  if (!lessonId) { alert('Cadastre uma aula antes de enviar materiais.'); return; }

  const lesson = currentLessons.find(l => l.id === lessonId);
  const lessonTitle = lesson ? lesson.title : 'Aula';

  // Monta a lista de linhas preenchidas (só as que têm arquivo escolhido)
  const rowsToUpload = [];
  for (let i = 1; i <= resourceRowCount; i++) {
    const fileInput = document.getElementById(`resource-file-${i}`);
    if (!fileInput || !fileInput.files[0]) continue; // linha vazia, ignora

    const type = document.getElementById(`resource-type-${i}`).value;
    rowsToUpload.push({
      type,
      name: `${lessonTitle} - ${TYPE_LABELS[type]}`,
      file: fileInput.files[0]
    });
  }

  if (rowsToUpload.length === 0) { alert('Escolha ao menos um arquivo para enviar.'); return; }

  const btn = document.getElementById('upload-btn');
  const feedbackEl = document.getElementById('upload-feedback');
  btn.disabled = true;

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rowsToUpload.length; i++) {
    const r = rowsToUpload[i];
    btn.textContent = `Enviando... (${i + 1}/${rowsToUpload.length})`;

    const safeFileName = r.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${currentStudent.id}/${lessonId}/${Date.now()}_${i}_${safeFileName}`;

    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, r.file);
    if (uploadError) { failCount++; console.error(uploadError); continue; }

    const { error: insertError } = await sb.from('resources').insert({
      lesson_id: lessonId, type: r.type, name: r.name, file_path: filePath
    });
    if (insertError) { failCount++; console.error(insertError); continue; }

    successCount++;
  }

  btn.disabled = false;
  btn.textContent = 'Enviar materiais';

  feedbackEl.className = 'feedback show ' + (failCount === 0 ? 'ok' : 'err');
  feedbackEl.textContent = failCount === 0
    ? `${successCount} material(is) enviado(s) com sucesso!`
    : `${successCount} enviado(s), ${failCount} falharam. Verifique o console para detalhes.`;

  // Avisa o aluno dentro do próprio portal (sininho ao lado de "Minhas aulas")
  if (successCount > 0) {
    try { await sb.from('notifications').insert({ student_id: currentStudent.id, type: 'new_lesson' }); } catch (e) { console.error('Erro ao criar notificação:', e); }
  }

  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

function renderAulasCadastradasTab(lessonsHtml){
  document.getElementById('tab-content').innerHTML = `
    <div class="box" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <h3 style="margin:0 0 4px;">Notificar aluno por e-mail</h3>
        <div class="small-note" style="margin-top:0;">Envia: "Os dados da sua última aula já estão disponíveis no portal!"</div>
      </div>
      ${currentStudent.is_test_profile ? '<span class="small-note">Aulas de teste: apenas notificação interna.</span>' : '<button class="btn-dark-sm" style="flex:0 0 auto;" onclick="notifyStudentAboutLesson()">Enviar e-mail ao aluno</button>'}
    </div>

    ${lessonsHtml}
  `;
}

async function uploadStudentAvatar(e){
  if (currentStudent && currentStudent.is_test_profile) return;
  const file = e.target.files[0];
  if (!file) return;

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${currentStudent.id}/avatar.${ext}`;

  const { error: uploadError } = await sb.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) { alert('Não foi possível enviar a foto.'); return; }

  const { data: urlData } = sb.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();

  const { error: updateError } = await sb.from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', currentStudent.id);

  if (updateError) { alert('Foto enviada, mas não foi possível salvar.'); return; }

  currentStudent.avatar_url = publicUrl;
  const idx = students.findIndex(s => s.id === currentStudent.id);
  if (idx >= 0) students[idx].avatar_url = publicUrl;
  renderStudentDetail();
}

async function notifyStudentAboutLesson(){
  if (currentStudent && currentStudent.is_test_profile) return;
  const confirmed = confirm(
    `Enviar e-mail para ${currentStudent.email} avisando que os dados da última aula estão disponíveis?`
  );
  if (!confirmed) return;

  const result = await sendLessonNotification(
    currentStudent.email,
    currentStudent.full_name,
    'Os dados da sua última aula já estão disponíveis no portal!'
  );

  if (result.ok) {
    alert('E-mail enviado com sucesso!');
  } else {
    alert('Não foi possível enviar o e-mail. Verifique a configuração do EmailJS.');
  }
}

async function saveStudentLink(){
  if (currentStudent && currentStudent.is_test_profile) return;
  const link = document.getElementById('student-link-input').value.trim();
  const { error } = await sb.from('profiles').update({ permanent_lesson_link: link }).eq('id', currentStudent.id);
  if (error) { alert('Não foi possível salvar o link.'); return; }
  currentStudent.permanent_lesson_link = link;
  const idx = students.findIndex(s => s.id === currentStudent.id);
  if (idx >= 0) students[idx].permanent_lesson_link = link;
  renderPerfilTab();
}

async function saveStudentSchedule(){
  if (currentStudent && currentStudent.is_test_profile) return;
  const weekdayRaw = document.getElementById('student-weekday-input').value;
  const timeRaw = document.getElementById('student-time-input').value;

  const lesson_weekday = weekdayRaw ? parseInt(weekdayRaw, 10) : null;
  const lesson_time = timeRaw || null;

  const { error } = await sb.from('profiles')
    .update({ lesson_weekday, lesson_time })
    .eq('id', currentStudent.id);

  if (error) { alert('Não foi possível salvar o dia/horário.'); console.error(error); return; }

  currentStudent.lesson_weekday = lesson_weekday;
  currentStudent.lesson_time = lesson_time;
  const idx = students.findIndex(s => s.id === currentStudent.id);
  if (idx >= 0) { students[idx].lesson_weekday = lesson_weekday; students[idx].lesson_time = lesson_time; }

  sortStudentsBySchedule();
  renderNav();
  alert('Dia e horário salvos!');
}

function enableLinkEditing(){
  document.getElementById('student-link-input').disabled = false;
  document.getElementById('student-link-input').focus();
  document.getElementById('link-save-btn').style.display = 'inline-block';
  document.getElementById('link-edit-btn').style.display = 'none';
}

function openStudentLink(){
  const link = currentStudent.permanent_lesson_link;
  if (!link) return;
  window.open(link, '_blank');
}

function generatePasswordSQL(){
  if (currentStudent && currentStudent.is_test_profile) return;
  const pass = document.getElementById('student-newpass-input').value;
  if (pass.length < 6) { alert('Digite uma senha com pelo menos 6 caracteres.'); return; }

  const sql = `update auth.users set encrypted_password = crypt('${pass.replace(/'/g,"''")}', gen_salt('bf')), email_confirmed_at = now() where email = '${currentStudent.email.replace(/'/g,"''")}';`;

  const box = document.getElementById('password-sql-output');
  box.style.display = 'block';
  box.value = sql;
  document.getElementById('copy-sql-btn').style.display = 'inline-block';
}

async function copyPasswordSQL(){
  const box = document.getElementById('password-sql-output');
  await navigator.clipboard.writeText(box.value);
  const btn = document.getElementById('copy-sql-btn');
  const old = btn.textContent;
  btn.textContent = 'Copiado!';
  setTimeout(() => { btn.textContent = old; }, 1500);
}

async function saveStudentName(){
  if (currentStudent && currentStudent.is_test_profile) return;
  const name = document.getElementById('student-name-input').value.trim();
  const { error } = await sb.from('profiles').update({ full_name: name }).eq('id', currentStudent.id);
  if (error) { alert('Não foi possível salvar o nome.'); return; }
  currentStudent.full_name = name;
  const idx = students.findIndex(s => s.id === currentStudent.id);
  if (idx >= 0) students[idx].full_name = name;
  renderNav();
  renderStudentDetail();
}

async function createLesson(){
  const title = document.getElementById('new-lesson-title').value.trim();
  const topic = document.getElementById('new-lesson-topic').value.trim();
  const date = document.getElementById('new-lesson-date').value || null;
  // Mantém arquivos de seleções anteriores e os respectivos tipos escolhidos.
  const files = quickLessonFiles.slice();
  const btn = document.getElementById('create-lesson-btn');
  const feedback = document.getElementById('create-lesson-feedback');

  if (!title) {
    feedback.className = 'feedback show err';
    feedback.textContent = 'Dê um título para a aula.';
    return;
  }

  const studentId = currentStudent.id;
  if(ccHasDirtyForMember(studentId)){alert('Salve o calendário antes de cadastrar aulas.');return;}
  const calendarEvent=date&&ccData(currentStudent).events[date];
  if(date&&ccGroupForDate(studentId,date)){alert('Esta aula pertence à turma. Cadastre os materiais pelo painel de turmas.');return;}
  if(calendarEvent&&(calendarEvent.skip||calendarEvent.status==='rescheduled')){alert('Esta data foi excluída ou reagendada no calendário. Escolha a data correta.');return;}
  btn.disabled = true;
  btn.textContent = 'Salvando aula...';

  const { data: lesson, error } = await sb.from('lessons')
    .insert({ student_id: studentId, title, topic, lesson_date: date })
    .select('id')
    .single();

  if (error || !lesson) {
    console.error(error);
    feedback.className = 'feedback show err';
    feedback.textContent = 'Não foi possível salvar a aula. Tente novamente.';
    btn.disabled = false;
    btn.textContent = 'Salvar aula e materiais';
    return;
  }

  let successes = 0;
  const failures = [];
  for (let i = 0; i < files.length; i++) {
    const { file, type } = files[i];
    btn.textContent = `Enviando materiais (${i + 1}/${files.length})...`;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${studentId}/${lesson.id}/${Date.now()}_${i}_${safeFileName}`;
    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      failures.push(file.name);
      continue;
    }
    const { error: insertError } = await sb.from('resources').insert({
      lesson_id: lesson.id, type, name: `${title} - ${TYPE_LABELS[type]}`, file_path: filePath
    });
    if (insertError) {
      console.error(insertError);
      // Evita arquivos órfãos quando o registro no banco falha.
      await sb.storage.from(STORAGE_BUCKET).remove([filePath]);
      failures.push(file.name);
      continue;
    }
    successes++;
  }

  // Uma única notificação, depois de concluir o cadastro, sem duplicar avisos por arquivo.
  const { error: notificationError } = await sb.from('notifications').insert({ student_id: studentId, type: 'new_lesson' });
  if (notificationError) console.error('Não foi possível notificar o aluno:', notificationError);

  await loadLessonsFor(studentId);
  if (failures.length) {
    // Mantém o formulário visível com os arquivos escolhidos para que o professor saiba o que falhou.
    feedback.className = 'feedback show err';
    feedback.textContent = `Aula cadastrada e ${successes} material(is) enviado(s). Falha em: ${failures.join(', ')}. Para reenviar, utilize a seção "Adicionar materiais a uma aula já cadastrada" abaixo.`;
    const selector = document.getElementById('resource-lesson');
    if (selector) {
      selector.insertAdjacentHTML('afterbegin', `<option value="${lesson.id}">${escapeHtml(title)}</option>`);
      selector.value = lesson.id;
    }
    btn.disabled = true; // evita criar uma segunda aula com o mesmo formulário
    btn.textContent = 'Aula salva';
    return;
  }

  currentTab = 'cadastradas';
  renderStudentDetail();
}

async function deleteLesson(lessonId){
  if (!confirm('Excluir esta aula e todos os materiais dela?')) return;
  const { error } = await sb.from('lessons').delete().eq('id', lessonId);
  if (error) { alert('Não foi possível excluir.'); return; }
  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

function resourceRowWithEditHtml(l, r){
  const [cls, label] = ICONS[r.type] || ['ic-pdf','?'];
  return `<div class="resource-row">
    <div class="resource-icon ${cls}">${label}</div>
    <div class="resource-info">
      <div class="name">${escapeHtml(materialDisplayName(r))}</div>
      <div class="desc">${escapeHtml(r.description || '')}</div>
    </div>
    ${isPdfPath(r.file_path) ? `<button class="resource-action" onclick="previewFile('${r.file_path}')">Visualizar</button>` : ''}
    <button class="resource-action" onclick="downloadLessonResource('${r.file_path}')">Baixar</button>
    <button class="btn-ghost" onclick="toggleEditResource('${r.id}')">Editar</button>
    <button class="resource-action" onclick="deleteResource('${r.id}','${r.file_path}')">Excluir</button>
  </div>
  <div id="resource-edit-${r.id}" class="box" style="display:none;margin:0 0 16px;">
    <div class="row">
      <input id="resource-edit-name-${r.id}" value="${escapeAttr(r.name)}" placeholder="Nome do material">
    </div>
    <div class="row">
      <input id="resource-edit-file-${r.id}" type="file">
    </div>
    <div class="small-note" style="margin-top:0;">Deixe o campo de arquivo em branco para manter o arquivo já enviado — só o nome será atualizado. ${r.file_path.startsWith('turmas/')?'Alterações neste perfil não modificam os materiais dos demais integrantes.':''}</div>
    <div class="row" style="margin-top:10px;">
      <button class="btn-dark-sm" onclick="saveResourceEdit('${r.id}','${r.file_path}','${l.id}')">Salvar alterações</button>
      <button class="btn-ghost" onclick="toggleEditResource('${r.id}')">Cancelar</button>
    </div>
    <div id="resource-edit-feedback-${r.id}" class="feedback"></div>
  </div>`;
}

function toggleEditResource(resourceId){
  const el = document.getElementById(`resource-edit-${resourceId}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function saveResourceEdit(resourceId, oldFilePath, lessonId){
  const nameInput = document.getElementById(`resource-edit-name-${resourceId}`);
  const fileInput = document.getElementById(`resource-edit-file-${resourceId}`);
  const feedbackEl = document.getElementById(`resource-edit-feedback-${resourceId}`);
  const newName = nameInput.value.trim();

  if (!newName) {
    feedbackEl.className = 'feedback show err';
    feedbackEl.textContent = 'Dê um nome para o material.';
    return;
  }

  const updates = { name: newName };
  const newFile = fileInput.files[0];

  if (newFile) {
    const safeFileName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const newFilePath = `${currentStudent.id}/${lessonId}/${Date.now()}_${safeFileName}`;
    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(newFilePath, newFile);
    if (uploadError) {
      feedbackEl.className = 'feedback show err';
      feedbackEl.textContent = 'Não foi possível enviar o novo arquivo.';
      console.error(uploadError);
      return;
    }
    updates.file_path = newFilePath;
  }

  const { data: changed, error } = await sb.from('resources').update(updates).eq('id', resourceId).eq('file_path', oldFilePath).select('id').single();
  if (error) {
    feedbackEl.className = 'feedback show err';
    feedbackEl.textContent = 'Não foi possível salvar as alterações.';
    console.error(error);
    return;
  }

  // Arquivos de turma podem ter vários vínculos. O banco também bloqueia a remoção física enquanto houver referências.
  if (newFile && oldFilePath) await removeUnreferencedLessonFile(oldFilePath);

  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

async function removeUnreferencedLessonFile(path){
 if(!path)return;
 const {count,error}=await sb.from('resources').select('id',{count:'exact',head:true}).eq('file_path',path);
 if(error||count!==0)return;
 // Nunca apagar automaticamente um objeto coletivo: evita corrida com novos vínculos.
 // A política restritiva no Storage protege arquivos coletivos referenciados inclusive de clientes antigos.
 if(path.startsWith('turmas/'))return;
 const result=await sb.storage.from(STORAGE_BUCKET).remove([path]);
 if(result.error)console.warn('Arquivo sem vínculo mantido no armazenamento:',result.error);
}
async function deleteResource(resourceId, filePath){
 const shared=filePath.startsWith('turmas/');
 if(!confirm(shared?'Excluir este material somente da aula deste aluno? O material dos demais será preservado.':'Excluir este material?'))return;
 const {data,error}=await sb.from('resources').delete().eq('id',resourceId).eq('file_path',filePath).select('id').single();
 if(error||!data){alert('Não foi possível excluir o vínculo. Atualize a página e tente novamente.');return;}
 await removeUnreferencedLessonFile(filePath);
 await loadLessonsFor(currentStudent.id);
 renderStudentDetail();
}

function formatDate(isoDate){
  const [y,m,d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function escapeAttr(str){ return escapeHtml(str); }

function renderMaterialExternalLink(raw){
  const url=normalizeMaterialExternalLink(raw);
  return '<div class="resource-row"><div class="resource-icon ic-pdf">Link</div><div class="resource-info" style="min-width:0"><div class="name">Link enviado pelo aluno</div><div class="desc" style="overflow-wrap:anywhere">'+escapeHtml(String(raw))+'</div></div>'+(url?'<a class="resource-action" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Abrir link</a>':'<span class="small-note">Endereço inválido. Solicite o link completo ao aluno.</span>')+'</div>';
}

function crmStudyTab(){
 const s=currentStudent;
 document.getElementById('tab-content').innerHTML='<section class="box"><h3>Mural de conquistas</h3>'+ (buildAchievementsSection(crmCompletedLocalCount(),{title:''})||'<p class="small-note">Ainda sem conquistas.</p>')+'</section><section class="box"><h3>Status de estudo — Guias de Gramática</h3><div id="grammar-status-box">Carregando...</div></section>';
 renderGrammarStatusBox(s.id);
}
async function crmStudentInboxTab(tab){
 const id=currentStudent.id,el=document.getElementById('tab-content'),questions=tab==='duvidas';
 el.innerHTML='<section class="box"><h3>'+(questions?'Perguntas do aluno':'Textos para correção')+'</h3><p>Carregando...</p></section>';
 const result=await sb.from(questions?'daniel_questions':'text_submissions').select(questions?'id,created_at,answer':'id,created_at,status').eq('student_id',id).order('created_at',{ascending:false});
 if(!el.isConnected||currentStudent?.id!==id||currentTab!==tab)return;
 const rows=result.data||[];
 el.innerHTML='<section class="box"><h3>'+(questions?'Perguntas do aluno':'Textos para correção')+'</h3><p class="small-note">Consulte os envios deste aluno. Use o módulo pedagógico para responder ou corrigir.</p><button class="btn-dark-sm" onclick="'+(questions?'openDanielModule()':'openTextosModule()')+'">Abrir módulo de atendimento</button>'+ (result.error?'<p>Não foi possível carregar os envios.</p>':rows.map(r=>'<div class="resource-row">'+crmIcon(questions?'message':'file')+'<div class="resource-info"><div class="name">'+(questions?(r.answer==null?'Aguardando resposta':'Respondida'):(r.status==='pending'?'Aguardando correção':'Correção pronta'))+'</div><div class="desc">'+escapeHtml(new Date(r.created_at).toLocaleString('pt-BR'))+'</div></div></div>').join('')||'<p class="small-note">Nenhum envio registrado.</p>')+'</section>';
}

function crmMaterialSearch(studentId=''){
 currentStudent=null;currentView='materiais-busca';renderNav();
 crmRenderMaterialSearch(document.getElementById('main-content'),students,studentId,async()=>{
  const rows=[];
  for(let offset=0;;offset+=500){
   const {data,error}=await sb.from('lessons').select('id,student_id,group_id,title,topic,lesson_date').order('id',{ascending:true}).range(offset,offset+499);
   if(error)throw error;
   rows.push(...(data||[]));if((data||[]).length<500)break;
  }
  return rows;
 },async row=>{
  if(row.group_id&&row.lesson_date){await tgOpenDate(row.group_id,row.lesson_date);return;}
  await openStudent(row.student_id);
  if(currentStudent?.id!==row.student_id||currentView!=='student')return;
  if(row.lesson_date){switchTab('calendario');ccJump(row.lesson_date);}
 });
}

function crmEditLesson(id){
 const lesson=currentLessons.find(l=>l.id===id&&l.student_id===currentStudent?.id);if(!lesson)return;
 const card=document.getElementById('crm-lesson-'+id);if(!card)return;
 if(card.querySelector('.crm-lesson-edit'))return;
 const form=document.createElement('form');form.className='box crm-lesson-edit';form.style.margin='12px 0';
 form.innerHTML='<h3>Editar aula · '+escapeHtml(lesson.title||'')+'</h3><label>Tópico da aula<input name="topic" value="'+escapeAttr(lesson.topic||'')+'"></label><label>Data da aula<input type="date" name="date" value="'+escapeAttr(lesson.lesson_date||'')+'"></label><div class="row" style="margin-top:10px"><button type="submit" class="btn-dark-sm">Salvar alterações</button><button type="button" class="btn-ghost">Cancelar</button></div><p role="status" class="small-note"></p>';
 card.appendChild(form);form.querySelector('button[type=button]').onclick=()=>form.remove();
 form.addEventListener('submit',async e=>{
  e.preventDefault();const sid=lesson.student_id,date=form.elements.date.value||null,topic=form.elements.topic.value.trim(),status=form.querySelector('[role=status]'),btn=form.querySelector('button[type=submit]');
  if(currentStudent?.id!==sid)return;
  const x=ccData(currentStudent),old=lesson.lesson_date;
  const linked=old&&old!==date&&(x.events[old]?.original||x.events[old]?.rescheduled_from||x.events[old]?.rescheduled_to||Object.values(x.events).some(r=>r.original===old));
  if(linked){status.textContent='Esta data possui vínculo de reposição ou reagendamento no calendário. Desvincule ou ajuste o registro antes de alterar a data, para preservar o histórico.';return;}
  btn.disabled=true;status.textContent='Salvando...';
  try{
   const {data,error}=await sb.from('lessons').update({topic,lesson_date:date}).eq('id',id).eq('student_id',sid).select('id').single();
   if(error||!data)throw error||new Error('Aula não atualizada');
   if(currentStudent?.id!==sid||currentView!=='student')return;
   currentLessons=sortLessonsByDate(currentLessons.map(l=>l.id===id?{...l,topic,lesson_date:date}:l),false);
   if(currentTab==='cadastradas'){renderStudentDetail();document.getElementById('crm-lesson-'+id)?.scrollIntoView({block:'nearest'});}
  }catch(error){console.error(error);status.textContent='Não foi possível salvar as alterações. Tente novamente.';}finally{btn.disabled=false;}
 });
 form.elements.topic.focus();
}

function crmCompletedLocalCount(){
 const dates=new Set(currentLessons.map(l=>l.lesson_date).filter(Boolean));
 return currentLessons.filter(l=>!l.calendar_status||l.calendar_status==='done').length+ccManualDoneDates(ccData(currentStudent)).filter(d=>!dates.has(d)).length;
}

function crmGroupedLessons(pendencies){
 const groups=new Map();
 for(const p of pendencies){const l=p.lesson,g=tgGroups.find(x=>x.id===l.group_id);const key=g&&l.lesson_date?g.id+'|'+l.lesson_date+'|'+(p.missingLesson?'missing':'report'):'single|'+(l.id||l.student_id+'|'+l.lesson_date);if(!groups.has(key))groups.set(key,{g,rows:[]});groups.get(key).rows.push(p);}
 return [...groups.values()].map(({g,rows})=>{const first=rows[0],l=first.lesson;return '<div class="crm-pending-row">'+crmIcon('file')+'<div class="crm-pending-text"><strong>'+escapeHtml(g?.name||first.studentName)+'</strong><small>'+ (first.missingLesson?'Cadastro da aula e relatório pendentes':'Relatório pendente')+' · '+escapeHtml(l.lesson_date?formatDate(l.lesson_date):l.title)+(g?' · '+rows.length+' de '+g.members.length+' alunos':'')+'</small>'+rows.map(({lesson,studentName,missingLesson})=>'<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px">'+(g?'<span>'+escapeHtml(studentName)+'</span>':'')+(missingLesson?'<button class="btn-ghost" onclick="'+escapeAttr(g?"tgOpenMissing('"+g.id+"','"+lesson.lesson_date+"')":"openMissingLesson('"+lesson.student_id+"','"+lesson.lesson_date+"')")+'">Cadastrar aula</button>'+crmDismissButton(lesson.student_id,'missing:'+lesson.lesson_date):'<button class="btn-ghost" onclick="openPendingReport(&quot;'+lesson.student_id+'&quot;,&quot;'+lesson.id+'&quot;)">Adicionar relatório</button><button class="resource-action" onclick="dismissReportPending(&quot;'+lesson.id+'&quot;)">Descartar pendência</button>')+'</div>').join('')+'</div></div>';}).join('')||'<div class="small-note">Nenhuma aula realizada aguarda cadastro ou relatório.</div>';
}
