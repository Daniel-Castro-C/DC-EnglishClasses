const ICONS = {
  ppt: ['ic-ppt','P'],
  pdf: ['ic-pdf','PDF'],
  ex:  ['ic-ex','Ex'],
  rep: ['ic-rep','R'],
};

let myProfile = null;
let myLessons = [];
let activeLessonId = null;

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

  await loadLessons();
})();

async function loadLessons(){
  const { data, error } = await sb
    .from('lessons')
    .select('*')
    .eq('student_id', myProfile.id)
    .order('lesson_date', { ascending: true });

  if (error) {
    document.getElementById('main-content').innerHTML =
      `<div class="empty-state">Não foi possível carregar suas aulas. Tente recarregar a página.</div>`;
    return;
  }

  myLessons = data || [];

  if (myLessons.length === 0) {
    document.getElementById('nav-container').innerHTML = buildStudentTopNav('aulas') + `<div class="nav-label">Minhas aulas</div>`;
    document.getElementById('main-content').innerHTML = `
      <div class="topline"><div><h1>Ainda não há aulas por aqui</h1>
      <div class="sub">Assim que seu professor cadastrar sua primeira aula, ela aparece aqui.</div></div></div>`;
    return;
  }

  activeLessonId = myLessons[0].id;
  renderNav();
  renderLesson(activeLessonId);
}

function renderNav(){
  let html = buildStudentTopNav('aulas');
  html += `<div class="nav-label">Minhas aulas</div>`;
  myLessons.forEach(l => {
    html += `<div class="nav-item ${l.id === activeLessonId ? 'active' : ''}" onclick="renderLesson('${l.id}')">
      <span>${escapeHtml(l.title)}</span><span class="dot"></span>
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
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
      <button class="resource-action" onclick="openResource('${r.file_path}')">Abrir</button>
    </div>`;
  }).join('');
}

async function openResource(filePath){
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 10); // link válido por 10 minutos

  if (error || !data) {
    alert('Não foi possível abrir este arquivo. Tente novamente.');
    return;
  }
  window.open(data.signedUrl, '_blank');
}

