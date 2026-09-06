const ICONS = {
  ppt: ['ic-ppt','P'],
  pdf: ['ic-pdf','PDF'],
  ex:  ['ic-ex','Ex'],
  rep: ['ic-rep','R'],
};
const TYPE_LABELS = { ppt:'Slides (PPT)', pdf:'PDF', ex:'Exercícios', rep:'Relatório de desempenho' };

let students = [];
let currentStudent = null;
let currentLessons = [];

(async function init(){
  const session = await requireSession();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);
  if (!profile) { await signOutAndRedirect(); return; }

  if (profile.role !== 'admin') {
    window.location.href = 'aluno.html';
    return;
  }

  await loadStudents();
  renderNav();
  renderHome();
})();

async function loadStudents(){
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('created_at', { ascending: true });

  if (error) { console.error(error); students = []; return; }
  students = data || [];
}

function renderNav(){
  let html = `<div class="nav-label">Alunos</div>`;
  if (students.length === 0) {
    html += `<div class="nav-item" style="opacity:.6;cursor:default;">Nenhum aluno ainda</div>`;
  }
  students.forEach(s => {
    const active = currentStudent && currentStudent.id === s.id ? 'active' : '';
    html += `<div class="nav-item ${active}" onclick="openStudent('${s.id}')">
      <span>${escapeHtml(s.full_name || s.email)}</span><span class="dot" style="background:var(--sky)"></span>
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
}

function renderHome(){
  currentStudent = null;
  renderNav();
  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Seus alunos</h1>
        <div class="sub">Cada aluno enxerga apenas as próprias aulas ao entrar</div>
      </div>
    </div>
    ${students.length === 0 ? `
      <div class="box">
        <h3>Nenhum aluno cadastrado ainda</h3>
        <div class="small-note">
          Para adicionar um aluno: vá no painel do Supabase → <b>Authentication → Add user</b>,
          crie o e-mail e senha dele. Ele aparece aqui automaticamente assim que fizer o primeiro login,
          ou você pode recarregar esta página depois de criá-lo.
        </div>
      </div>
    ` : `
      <div class="students-list">
        ${students.map(s => `
          <div class="student-row">
            <div>
              <div class="name">${escapeHtml(s.full_name || '(sem nome definido)')}</div>
              <div class="lessons-count">${escapeHtml(s.email)}</div>
            </div>
            <button class="btn-ghost" onclick="openStudent('${s.id}')">Ver aulas</button>
          </div>
        `).join('')}
      </div>
      <div class="box">
        <h3>Adicionar novo aluno</h3>
        <div class="small-note">
          Vá no painel do Supabase → <b>Authentication → Add user</b> → cadastre e-mail e senha.
          Depois volte aqui e clique em "Atualizar lista" abaixo.
        </div>
        <div style="margin-top:12px;">
          <button class="btn-dark-sm" onclick="refreshStudents()">Atualizar lista</button>
        </div>
      </div>
    `}
  `;
}

async function refreshStudents(){
  await loadStudents();
  renderNav();
  renderHome();
}

async function openStudent(studentId){
  currentStudent = students.find(s => s.id === studentId);
  renderNav();
  await loadLessonsFor(studentId);
  renderStudentDetail();
}

async function loadLessonsFor(studentId){
  const { data, error } = await sb
    .from('lessons')
    .select('*, resources(*)')
    .eq('student_id', studentId)
    .order('lesson_date', { ascending: true });

  if (error) { console.error(error); currentLessons = []; return; }
  currentLessons = data || [];
}

function renderStudentDetail(){
  const s = currentStudent;

  const lessonsHtml = currentLessons.map(l => {
    const rows = (l.resources || []).map(r => {
      const [cls, label] = ICONS[r.type] || ['ic-pdf','?'];
      return `<div class="resource-row">
        <div class="resource-icon ${cls}">${label}</div>
        <div class="resource-info">
          <div class="name">${escapeHtml(r.name)}</div>
          <div class="desc">${escapeHtml(r.description || '')}</div>
        </div>
        <button class="resource-action" onclick="deleteResource('${r.id}','${r.file_path}')">Excluir</button>
      </div>`;
    }).join('') || `<div class="empty-state">Nenhum material nesta aula ainda.</div>`;

    return `<div class="lesson-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h3>${escapeHtml(l.title)}</h3>
          <div class="meta">${escapeHtml(l.topic || '')}${l.lesson_date ? ' · ' + formatDate(l.lesson_date) : ''}</div>
        </div>
        <button class="resource-action" onclick="deleteLesson('${l.id}')">Excluir aula</button>
      </div>
      ${rows}
    </div>`;
  }).join('') || `<div class="empty-state">Nenhuma aula cadastrada para ${escapeHtml(s.full_name || s.email)} ainda.</div>`;

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${escapeHtml(s.full_name || s.email)}</h1>
        <div class="sub">${escapeHtml(s.email)} · visível apenas para você e para o aluno</div>
      </div>
      <button class="btn-dark-sm" onclick="renderHome()">← Todos os alunos</button>
    </div>

    <div class="box">
      <h3>Nome de exibição do aluno</h3>
      <div class="row">
        <input id="student-name-input" placeholder="Nome completo" value="${escapeAttr(s.full_name || '')}">
        <button class="btn-dark-sm" style="flex:0 0 auto;" onclick="saveStudentName()">Salvar nome</button>
      </div>
    </div>

    ${lessonsHtml}

    <div class="box">
      <h3>+ Adicionar nova aula</h3>
      <div class="row">
        <input id="new-lesson-title" placeholder="Título (ex: Aula 3 — 20/09/2026)">
        <input id="new-lesson-topic" placeholder="Tópico da aula">
        <input id="new-lesson-date" type="date">
      </div>
      <div style="margin-top:12px;">
        <button class="btn-dark-sm" onclick="createLesson()">Salvar aula</button>
      </div>
    </div>

    <div class="box">
      <h3>+ Adicionar material a uma aula</h3>
      <div class="row">
        <select id="resource-lesson">
          ${currentLessons.map(l => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join('')}
        </select>
        <select id="resource-type">
          <option value="ppt">Slides (PPT)</option>
          <option value="pdf">PDF</option>
          <option value="ex">Exercícios</option>
          <option value="rep">Relatório de desempenho</option>
        </select>
      </div>
      <div class="row">
        <input id="resource-name" placeholder="Nome do material (ex: Slides da aula 3.pptx)">
        <input id="resource-desc" placeholder="Descrição curta (opcional)">
      </div>
      <div class="row">
        <input id="resource-file" type="file">
      </div>
      <div style="margin-top:12px;">
        <button id="upload-btn" class="btn-dark-sm" onclick="uploadResource()" ${currentLessons.length === 0 ? 'disabled' : ''}>
          ${currentLessons.length === 0 ? 'Cadastre uma aula primeiro' : 'Enviar material'}
        </button>
      </div>
    </div>
  `;
}

async function saveStudentName(){
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

  if (!title) { alert('Dê um título para a aula.'); return; }

  const { error } = await sb.from('lessons').insert({
    student_id: currentStudent.id,
    title, topic, lesson_date: date
  });

  if (error) { alert('Não foi possível salvar a aula.'); console.error(error); return; }

  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

async function deleteLesson(lessonId){
  if (!confirm('Excluir esta aula e todos os materiais dela?')) return;
  const { error } = await sb.from('lessons').delete().eq('id', lessonId);
  if (error) { alert('Não foi possível excluir.'); return; }
  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

async function uploadResource(){
  const lessonId = document.getElementById('resource-lesson').value;
  const type = document.getElementById('resource-type').value;
  const name = document.getElementById('resource-name').value.trim();
  const desc = document.getElementById('resource-desc').value.trim();
  const fileInput = document.getElementById('resource-file');
  const file = fileInput.files[0];

  if (!lessonId) { alert('Cadastre uma aula antes de enviar materiais.'); return; }
  if (!name) { alert('Dê um nome para o material.'); return; }
  if (!file) { alert('Escolha um arquivo.'); return; }

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${currentStudent.id}/${lessonId}/${Date.now()}_${safeFileName}`;

  const { error: uploadError } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file);

  if (uploadError) {
    alert('Não foi possível enviar o arquivo.');
    console.error(uploadError);
    btn.disabled = false;
    btn.textContent = 'Enviar material';
    return;
  }

  const { error: insertError } = await sb.from('resources').insert({
    lesson_id: lessonId, type, name, description: desc, file_path: filePath
  });

  if (insertError) {
    alert('O arquivo foi enviado, mas não foi possível salvar as informações.');
    console.error(insertError);
  }

  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

async function deleteResource(resourceId, filePath){
  if (!confirm('Excluir este material?')) return;
  await sb.storage.from(STORAGE_BUCKET).remove([filePath]);
  const { error } = await sb.from('resources').delete().eq('id', resourceId);
  if (error) { alert('Não foi possível excluir.'); return; }
  await loadLessonsFor(currentStudent.id);
  renderStudentDetail();
}

function formatDate(isoDate){
  const [y,m,d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[m]));
}
function escapeAttr(str){ return escapeHtml(str); }
