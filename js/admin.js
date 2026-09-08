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
let currentTab = 'geral';

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
  currentTab = 'perfil';
  renderNav();
  await loadLessonsFor(studentId);
  renderStudentDetail();
}

function switchTab(tab){
  currentTab = tab;
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

    <div class="role-switch" style="max-width:460px;margin-bottom:26px;">
      <button class="${currentTab === 'perfil' ? 'active' : ''}" onclick="switchTab('perfil')">Perfil</button>
      <button class="${currentTab === 'nova' ? 'active' : ''}" onclick="switchTab('nova')">Cadastrar nova aula</button>
      <button class="${currentTab === 'cadastradas' ? 'active' : ''}" onclick="switchTab('cadastradas')">Aulas cadastradas</button>
    </div>

    <div id="tab-content"></div>
  `;

  if (currentTab === 'perfil') {
    renderPerfilTab();
  } else if (currentTab === 'nova') {
    renderNovaAulaTab();
  } else {
    renderAulasCadastradasTab(lessonsHtml);
  }
}

function renderPerfilTab(){
  const s = currentStudent;
  document.getElementById('tab-content').innerHTML = `
    <div class="box">
      <h3>Perfil do aluno</h3>
      <div class="row" style="align-items:center;">
        ${s.avatar_url
          ? `<img id="student-avatar-preview" src="${s.avatar_url}" alt="Foto" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex:0 0 auto;">`
          : `<div id="student-avatar-preview" style="width:56px;height:56px;border-radius:50%;background:var(--sky-soft);flex:0 0 auto;"></div>`}
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
        <input id="student-link-input" placeholder="https://..." value="${escapeAttr(s.permanent_lesson_link || '')}">
        <button class="btn-dark-sm" style="flex:0 0 auto;" onclick="saveStudentLink()">Salvar link</button>
      </div>
    </div>

    <div class="box">
      <h3>Financeiro</h3>
      <div class="row">
        <div>
          <label>Dia de pagamento</label>
          <input id="student-payday-input" type="number" min="1" max="31" placeholder="ex: 8" value="${s.payment_day ?? ''}">
        </div>
        <div>
          <label>Valor da mensalidade (R$)</label>
          <input id="student-fee-input" type="number" min="0" step="0.01" placeholder="ex: 250.00" value="${s.monthly_fee ?? ''}">
        </div>
      </div>
      <button class="btn-dark-sm" onclick="saveStudentFinance()">Salvar dados financeiros</button>
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

function renderNovaAulaTab(){
  document.getElementById('tab-content').innerHTML = `
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

function renderAulasCadastradasTab(lessonsHtml){
  document.getElementById('tab-content').innerHTML = `
    <div class="box" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <h3 style="margin:0 0 4px;">Notificar aluno por e-mail</h3>
        <div class="small-note" style="margin-top:0;">Envia: "Os dados da sua última aula já estão disponíveis no portal!"</div>
      </div>
      <button class="btn-dark-sm" style="flex:0 0 auto;" onclick="notifyStudentAboutLesson()">Enviar e-mail ao aluno</button>
    </div>

    ${lessonsHtml}
  `;
}

async function uploadStudentAvatar(e){
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
  const link = document.getElementById('student-link-input').value.trim();
  const { error } = await sb.from('profiles').update({ permanent_lesson_link: link }).eq('id', currentStudent.id);
  if (error) { alert('Não foi possível salvar o link.'); return; }
  currentStudent.permanent_lesson_link = link;
  alert('Link salvo!');
}

async function saveStudentFinance(){
  const dayRaw = document.getElementById('student-payday-input').value;
  const feeRaw = document.getElementById('student-fee-input').value;

  const payment_day = dayRaw ? parseInt(dayRaw, 10) : null;
  const monthly_fee = feeRaw ? parseFloat(feeRaw) : null;

  const { error } = await sb.from('profiles').update({ payment_day, monthly_fee }).eq('id', currentStudent.id);
  if (error) { alert('Não foi possível salvar os dados financeiros.'); return; }

  currentStudent.payment_day = payment_day;
  currentStudent.monthly_fee = monthly_fee;
  alert('Dados financeiros salvos!');
}

function generatePasswordSQL(){
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

function escapeAttr(str){ return escapeHtml(str); }
