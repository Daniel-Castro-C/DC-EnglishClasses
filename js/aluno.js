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
let notifCounts = {};
const LESSONS_PER_PAGE = 10;

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }

  if (!canAccessStudentPortal(myProfile)) {
    window.location.href = 'admin.html';
    return;
  }
  myProfile = studentPortalProfile(myProfile);

  await syncLanguageFromProfile(myProfile);
  document.getElementById('lang-switcher-container').innerHTML = buildLanguageSwitcher(myProfile.id);
  translateStaticChrome();

  await syncThemeFromProfile(myProfile);
  document.getElementById('theme-toggle-container').innerHTML = buildThemeToggle(myProfile.id);

  grammarUnlocked = await isGrammarUnlocked();

  // O aluno já está vendo "Minhas aulas" agora, então qualquer notificação de aula nova
  // pode ser marcada como lida (o sininho não aparece mais nesta ou em outras páginas).
  await markNotificationsRead(myProfile.id, 'new_lesson');
  notifCounts = await getNotificationCounts(myProfile.id);

  await loadLessons();
})();


async function loadLessons(){
  // Aulas e recursos são carregados juntos; o aluno já vê todos os materiais
  // na listagem, sem precisar selecionar a aula previamente.
  const { data, error } = await sb.from('lessons')
    .select('*, resources(*)')
    .eq('student_id', myProfile.id);

  if (error) {
    console.error('Erro ao carregar aulas e materiais:', error);
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">${t('load_lessons_error')}</div>`;
    return;
  }
  myLessons = sortLessonsByDate(data || [], false);
  currentResources = myLessons.flatMap(l => l.resources || []);
  lessonsPage = 0;
  renderNav();
  renderLessonsPage();
}

function renderNav(){
  document.getElementById('nav-container').innerHTML =
    buildStudentTopNav('aulas', grammarUnlocked, notifCounts);
}

function onLessonSearchInput(value){
  lessonSearchTerm = value;
  lessonsPage = 0;
  renderLessonsList(); // atualiza só os cards — não perde foco do campo de busca
}

function getFilteredLessons(){
  const term = lessonSearchTerm.trim().toLocaleLowerCase(getLang() === 'en' ? 'en-US' : 'pt-BR');
  return term ? myLessons.filter(l => ((l.title || '') + ' ' + (l.topic || '')).toLocaleLowerCase(getLang() === 'en' ? 'en-US' : 'pt-BR').includes(term)) : myLessons;
}

function lessonDateLabel(isoDate){
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return escapeHtml(isoDate);
  return getLang() === 'en' ? [parts[1],parts[2],parts[0]].join('/') : [parts[2],parts[1],parts[0]].join('/');
}

function renderLessonsPage(){
  const count = myLessons.length;
  document.getElementById('main-content').innerHTML = `
    <div class="student-page student-lessons-page">
      <header class="student-page-heading">
        <span class="student-page-kicker">${t('lessons_overview_kicker')}</span>
        <h1>${t('lessons_overview_title')}</h1>
        <p>${t('lessons_overview_sub')}</p>
      </header>
      <div class="student-lessons-statbar">
        <div class="student-lessons-stat"><strong>${count}</strong><span>${t('lessons_counter')}</span></div>
        <div class="student-lessons-stat"><strong>${currentResources.length}</strong><span>${t('lessons_materials_counter')}</span></div>
      </div>
      <div class="student-lessons-toolbar">
        <div>
          <h2>${t('nav_aulas')}</h2>
          <p class="student-muted">${t('materials_meta')}</p>
        </div>
        <label class="student-search-wrap">
          <span class="sr-only">${t('search_placeholder')}</span>
          <input id="lesson-search-input" type="search" placeholder="${escapeHtml(t('search_placeholder'))}" value="${escapeHtml(lessonSearchTerm)}" oninput="onLessonSearchInput(this.value)">
        </label>
      </div>
      <div id="lessons-list-container" aria-live="polite"></div>
    </div>
  `;
  renderLessonsList();
}

function renderLessonsList(){
  const list = document.getElementById('lessons-list-container');
  if (!list) return;
  const filtered = getFilteredLessons();
  const totalPages = Math.max(1, Math.ceil(filtered.length / LESSONS_PER_PAGE));
  lessonsPage = Math.max(0, Math.min(lessonsPage, totalPages - 1));
  const pageItems = filtered.slice(lessonsPage * LESSONS_PER_PAGE, (lessonsPage + 1) * LESSONS_PER_PAGE);

  if (!pageItems.length) {
    list.innerHTML = '<div class="student-empty-card">' + escapeHtml(t(myLessons.length ? 'no_lessons_found' : 'no_lessons_sub')) + '</div>';
    return;
  }

  const tiles = pageItems.map(lesson => {
    const resources = (lesson.resources || []).slice().sort((x,y) => String(x.created_at || '').localeCompare(String(y.created_at || '')));
    const materials = resources.filter(r => !!r.file_path).map(r => {
      const typeKey = 'lessons_type_' + r.type;
      const typeLabel = t(typeKey) === typeKey ? (r.type || 'Arquivo') : t(typeKey);
      const filename = r.name || typeLabel;
      const hint = filename === typeLabel ? '' : filename;
      const aria = t('lessons_open_material', {type:typeLabel,name:filename});
      return `
        <details class="student-material-dropdown">
          <summary class="student-material-tile" aria-label="${escapeHtml(aria)}" title="${escapeHtml(filename)}">
            <span class="student-material-icon type-${escapeHtml(r.type || 'file')}">${escapeHtml(r.type === 'ppt' ? 'PPT' : (r.type === 'rep' ? 'R' : (r.type === 'ex' ? 'EX' : 'PDF')))}</span>
            <span class="student-material-text">
              <strong>${escapeHtml(typeLabel)}</strong>
              ${hint ? `<small>${escapeHtml(hint)}</small>` : ''}
            </span>
            <span class="student-material-caret" aria-hidden="true">⌄</span>
          </summary>
          <div class="student-material-actions">
            <button type="button" onclick="previewLessonResource('${r.id}')">${t('lessons_preview')}</button>
            <button type="button" onclick="downloadLessonResourceById('${r.id}')">${t('lessons_download')}</button>
          </div>
        </details>`;
    }).join('');
    return `
      <article class="student-lesson-item">
        <div class="student-lesson-summary">
          <span class="student-lesson-number">${escapeHtml(t('nav_aulas'))}</span>
          <h3>${escapeHtml(lesson.title || '')}</h3>
          ${lesson.topic ? `<p>${escapeHtml(lesson.topic)}</p>` : ''}
          ${lesson.lesson_date ? `<time datetime="${escapeHtml(lesson.lesson_date)}">${lessonDateLabel(lesson.lesson_date)}</time>` : ''}
        </div>
        <div class="student-lesson-materials" aria-label="${escapeHtml(t('materials_title'))}">
          ${materials || `<span class="student-muted student-no-materials">${t('lessons_no_materials')}</span>`}
        </div>
      </article>`;
  }).join('');

  list.innerHTML = '<div class="student-lesson-list">' + tiles + '</div>' +
    (totalPages > 1 ? `
    <nav class="student-lessons-pagination" aria-label="${escapeHtml(t('nav_aulas'))}">
      <button type="button" onclick="changeLessonsPage(-1)" ${lessonsPage === 0 ? 'disabled' : ''}>${t('prev_page')}</button>
      <span>${t('page_of', {a:lessonsPage + 1,b:totalPages})}</span>
      <button type="button" onclick="changeLessonsPage(1)" ${lessonsPage >= totalPages - 1 ? 'disabled' : ''}>${t('next_page')}</button>
    </nav>` : '');
}

function changeLessonsPage(delta){
  const maxPage = Math.max(0, Math.ceil(getFilteredLessons().length / LESSONS_PER_PAGE) - 1);
  lessonsPage = Math.max(0, Math.min(maxPage, lessonsPage + delta));
  renderLessonsList();
  document.querySelector('.student-lessons-toolbar')?.scrollIntoView({behavior:'smooth',block:'start'});
}

async function previewLessonResource(resourceId){
  const resource = currentResources.find(r => r.id === resourceId);
  if (!resource || !resource.file_path) return;
  // Abre a aba no gesto de clique para não ser bloqueada como pop-up após a requisição assíncrona.
  const tab = window.open('about:blank', '_blank');
  const { data, error } = await sb.storage.from(STORAGE_BUCKET).createSignedUrl(resource.file_path, 60 * 10);
  if (error || !data) {
    if (tab) tab.close();
    alert(t('download_error_alert'));
    return;
  }
  logActivity(myProfile.id, 'preview_material', resource.name || '');
  if (tab) {
    tab.opener = null;
    tab.location.replace(data.signedUrl);
  } else {
    window.location.href = data.signedUrl;
  }
  // O navegador pode baixar arquivos como PPT/DOC caso não suporte visualização nativa.
}

function downloadLessonResourceById(resourceId){
  const resource = currentResources.find(r => r.id === resourceId);
  if (resource && resource.file_path) downloadResource(resource.file_path);
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
