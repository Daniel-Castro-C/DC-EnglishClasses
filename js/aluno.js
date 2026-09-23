const ICONS = {
  ppt: ['ic-ppt','P'],
  pdf: ['ic-pdf','PDF'],
  ex:  ['ic-ex','Ex'],
  rep: ['ic-rep','R'],
};

let myProfile = null;
let myLessons = [];
let activeLessonId = null;
let grammarUnlocked = false;
let lessonsPage = 0;
let lessonSearchTerm = '';
let currentResources = [];
const LESSONS_PER_PAGE = 10;

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }

  if (myProfile.role !== 'student') {
    // professor tentou abrir a página de aluno -> manda pro painel certo
    window.location.href = 'admin.html';
    return;
  }

  await syncLanguageFromProfile(myProfile);
  document.getElementById('lang-switcher-container').innerHTML = buildLanguageSwitcher(myProfile.id);
  translateStaticChrome();

  grammarUnlocked = await isGrammarUnlocked();
  await loadLessons();
})();

async function loadLessons(){
  const { data, error } = await sb
    .from('lessons')
    .select('*')
    .eq('student_id', myProfile.id)
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">${t('load_lessons_error')}</div>`;
    return;
  }

  myLessons = data || [];

  if (myLessons.length === 0) {
    document.getElementById('nav-container').innerHTML = buildStudentTopNav('aulas', grammarUnlocked) + `<div class="nav-label">${t('nav_aulas')}</div>`;
    document.getElementById('main-content').innerHTML = `
      <div class="topline"><div><h1>${t('no_lessons_title')}</h1>
      <div class="sub">${t('no_lessons_sub')}</div></div></div>`;
    return;
  }

  lessonsPage = 0;
  activeLessonId = myLessons[0].id;
  renderNav();
  renderLesson(activeLessonId);
}

function renderNav(){
  let html = buildStudentTopNav('aulas', grammarUnlocked);
  html += `<div class="nav-label">${t('nav_aulas')}</div>`;
  html += `<input id="lesson-search-input" placeholder="${t('search_placeholder')}" value="${escapeHtml(lessonSearchTerm)}"
    oninput="onLessonSearchInput(this.value)"
    style="width:100%;box-sizing:border-box;padding:8px 10px;margin-bottom:8px;font-size:12.5px;border-radius:6px;border:1px solid rgba(255,255,255,0.28);background:rgba(255,255,255,0.06);color:#fff;">`;
  html += `<div id="lessons-list-container"></div>`;
  document.getElementById('nav-container').innerHTML = html;
  renderLessonsList();
}

function onLessonSearchInput(value){
  lessonSearchTerm = value;
  lessonsPage = 0;
  renderLessonsList(); // só atualiza a lista, sem recriar o campo de busca (mantém o foco)
}

function getFilteredLessons(){
  const term = lessonSearchTerm.trim().toLowerCase();
  if (!term) return myLessons;
  return myLessons.filter(l => l.title.toLowerCase().includes(term));
}

function renderLessonsList(){
  const filtered = getFilteredLessons();
  const start = lessonsPage * LESSONS_PER_PAGE;
  const pageItems = filtered.slice(start, start + LESSONS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / LESSONS_PER_PAGE));

  let html = '';
  if (filtered.length === 0) {
    html = `<div class="small-note" style="padding:4px 6px;">${t('no_lessons_found')}</div>`;
  } else {
    pageItems.forEach(l => {
      html += `<div class="nav-item ${l.id === activeLessonId ? 'active' : ''}" onclick="renderLesson('${l.id}')">
        <span>${escapeHtml(l.title)}</span><span class="dot"></span>
      </div>`;
    });
  }

  if (totalPages > 1) {
    html += `<div style="display:flex;gap:6px;margin-top:10px;padding:0 6px;">`;
    html += `<button class="sidebar-nav-btn" style="flex:1;padding:6px;font-size:12px;" onclick="changeLessonsPage(-1)" ${lessonsPage === 0 ? 'disabled' : ''}>${t('prev_page')}</button>`;
    html += `<button class="sidebar-nav-btn" style="flex:1;padding:6px;font-size:12px;" onclick="changeLessonsPage(1)" ${lessonsPage >= totalPages - 1 ? 'disabled' : ''}>${t('next_page')}</button>`;
    html += `</div>`;
    html += `<div class="small-note" style="text-align:center;margin-top:6px;color:#93A3C0;">${t('page_of', {a: lessonsPage + 1, b: totalPages})}</div>`;
  }

  document.getElementById('lessons-list-container').innerHTML = html;
}

function changeLessonsPage(delta){
  lessonsPage += delta;
  renderLessonsList();
}

async function renderLesson(lessonId){
  activeLessonId = lessonId;
  renderLessonsList();
  const lesson = myLessons.find(l => l.id === lessonId);

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${escapeHtml(lesson.title)}</h1>
        <div class="sub">${escapeHtml(lesson.topic || '')}</div>
      </div>
      <div class="pill">${t('only_you_pill')}</div>
    </div>
    <div class="lesson-card">
      <h3>${t('materials_title')}</h3>
      <div class="meta">${t('materials_meta')}</div>
      <div id="resources-list"><div class="empty-state">${t('loading_materials')}</div></div>
    </div>
  `;

  const { data: resources, error } = await sb
    .from('resources')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('resources-list');

  if (error) {
    list.innerHTML = `<div class="empty-state">${t('materials_load_error')}</div>`;
    return;
  }

  if (!resources || resources.length === 0) {
    list.innerHTML = `<div class="empty-state">${t('no_materials')}</div>`;
    return;
  }

  currentResources = resources;

  list.innerHTML = resources.map(r => {
    const [cls, label] = ICONS[r.type] || ['ic-pdf','?'];
    return `<div class="resource-row">
      <div class="resource-icon ${cls}">${label}</div>
      <div class="resource-info">
        <div class="name">${escapeHtml(r.name)}</div>
        <div class="desc">${escapeHtml(r.description || '')}</div>
      </div>
      <button class="resource-action" onclick="downloadResource('${r.file_path}')">${t('download_file')}</button>
    </div>`;
  }).join('');
}

async function downloadResource(filePath){
  // Nome de exibição do arquivo baixado (remove o prefixo de timestamp usado internamente)
  const displayName = filePath.split('/').pop().replace(/^\d+_/, '');

  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 10, { download: displayName }); // força download em vez de abrir no navegador

  if (error || !data) {
    alert(t('download_error_alert'));
    return;
  }

  const resource = currentResources.find(r => r.file_path === filePath);
  logActivity(myProfile.id, 'download_material', resource ? resource.name : displayName);

  window.location.href = data.signedUrl;
}
