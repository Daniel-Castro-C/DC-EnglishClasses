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
      `<div class="empty-state">Não foi possível carregar suas aulas. Tente recarregar a página.</div>`;
    return;
  }

  myLessons = data || [];

  if (myLessons.length === 0) {
    document.getElementById('nav-container').innerHTML = buildStudentTopNav('aulas', grammarUnlocked) + `<div class="nav-label">Minhas aulas</div>`;
    document.getElementById('main-content').innerHTML = `
      <div class="topline"><div><h1>Ainda não há aulas por aqui</h1>
      <div class="sub">Assim que seu professor cadastrar sua primeira aula, ela aparece aqui.</div></div></div>`;
    return;
  }

  lessonsPage = 0;
  activeLessonId = myLessons[0].id;
  renderNav();
  renderLesson(activeLessonId);
}

function renderNav(){
  let html = buildStudentTopNav('aulas', grammarUnlocked);
  html += `<div class="nav-label">Minhas aulas</div>`;

  const start = lessonsPage * LESSONS_PER_PAGE;
  const pageItems = myLessons.slice(start, start + LESSONS_PER_PAGE);
  const totalPages = Math.ceil(myLessons.length / LESSONS_PER_PAGE);

  pageItems.forEach(l => {
    html += `<div class="nav-item ${l.id === activeLessonId ? 'active' : ''}" onclick="renderLesson('${l.id}')">
      <span>${escapeHtml(l.title)}</span><span class="dot"></span>
    </div>`;
  });

  if (totalPages > 1) {
    html += `<div style="display:flex;gap:6px;margin-top:10px;padding:0 6px;">`;
    html += `<button class="sidebar-nav-btn" style="flex:1;padding:6px;font-size:12px;" onclick="changeLessonsPage(-1)" ${lessonsPage === 0 ? 'disabled' : ''}>← Anterior</button>`;
    html += `<button class="sidebar-nav-btn" style="flex:1;padding:6px;font-size:12px;" onclick="changeLessonsPage(1)" ${lessonsPage >= totalPages - 1 ? 'disabled' : ''}>Próxima →</button>`;
    html += `</div>`;
    html += `<div class="small-note" style="text-align:center;margin-top:6px;color:#93A3C0;">Página ${lessonsPage + 1} de ${totalPages}</div>`;
  }

  document.getElementById('nav-container').innerHTML = html;
}

function changeLessonsPage(delta){
  lessonsPage += delta;
  renderNav();
}

async function renderLesson(lessonId){
  activeLessonId = lessonId;
  renderNav();
  const lesson = myLessons.find(l => l.id === lessonId);

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${escapeHtml(lesson.title)}</h1>
        <div class="sub">${escapeHtml(lesson.topic || '')}</div>
      </div>
      <div class="pill">Só você vê esta aula</div>
    </div>
    <div class="lesson-card">
      <h3>Materiais e acompanhamento</h3>
      <div class="meta">Tudo o que foi usado e passado nesta aula</div>
      <div id="resources-list"><div class="empty-state">Carregando materiais...</div></div>
    </div>
  `;

  const { data: resources, error } = await sb
    .from('resources')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('resources-list');

  if (error) {
    list.innerHTML = `<div class="empty-state">Não foi possível carregar os materiais desta aula.</div>`;
    return;
  }

  if (!resources || resources.length === 0) {
    list.innerHTML = `<div class="empty-state">Nenhum material adicionado a esta aula ainda.</div>`;
    return;
  }

  list.innerHTML = resources.map(r => {
    const [cls, label] = ICONS[r.type] || ['ic-pdf','?'];
    return `<div class="resource-row">
      <div class="resource-icon ${cls}">${label}</div>
      <div class="resource-info">
        <div class="name">${escapeHtml(r.name)}</div>
        <div class="desc">${escapeHtml(r.description || '')}</div>
      </div>
      <button class="resource-action" onclick="downloadResource('${r.file_path}')">Baixar arquivo</button>
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
    alert('Não foi possível baixar este arquivo. Tente novamente.');
    return;
  }
  window.location.href = data.signedUrl;
}

