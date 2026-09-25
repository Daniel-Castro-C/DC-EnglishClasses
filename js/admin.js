const ICONS = {
  ppt: ['ic-ppt','P'],
  pdf: ['ic-pdf','PDF'],
  ex:  ['ic-ex','Ex'],
  rep: ['ic-rep','R'],
};
const TYPE_LABELS = { ppt:'Slides (PPT)', pdf:'PDF', ex:'Exercícios', rep:'Relatório de desempenho' };
const WEEKDAY_LABELS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

let students = [];
let currentStudent = null;
let currentLessons = [];
let currentTab = 'geral';
let currentView = 'home'; // 'home' | 'comunicados' | 'student'
let danielPendingTotal = 0;
let pendingCountsByStudent = {};

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
  await refreshPendingCounts();
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
  sortStudentsBySchedule();
}

function sortStudentsBySchedule(){
  students.sort((a, b) => {
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
  const { data: pendingQuestions } = await sb.from('daniel_questions').select('student_id').is('answer', null);
  const { data: materialReqs } = await sb.from('material_requests').select('student_id');

  const counts = {};
  (pendingQuestions || []).forEach(q => { counts[q.student_id] = (counts[q.student_id] || 0) + 1; });
  (materialReqs || []).forEach(r => { counts[r.student_id] = (counts[r.student_id] || 0) + 1; });

  pendingCountsByStudent = counts;
  danielPendingTotal = (pendingQuestions || []).length;
}

function renderNav(){
  let html = `<div class="nav-item ${currentView === 'comunicados' ? 'active' : ''}" onclick="openComunicados()">
    <span>Comunicados</span>
  </div>`;
  html += `<div class="nav-item ${currentView === 'guias' ? 'active' : ''}" onclick="openGuias()">
    <span>Guias de Gramática</span>
  </div>`;
  html += `<div class="nav-item ${currentView === 'daniel' ? 'active' : ''}" onclick="openDanielModule()">
    <span>Pergunte ao Daniel</span>
    ${danielPendingTotal > 0 ? `<span class="pill" style="background:var(--amber);color:#fff;font-size:11px;padding:2px 8px;">${danielPendingTotal}</span>` : ''}
  </div>`;
  html += `<div class="nav-label">Alunos</div>`;
  if (students.length === 0) {
    html += `<div class="nav-item" style="opacity:.6;cursor:default;">Nenhum aluno ainda</div>`;
  }
  students.forEach(s => {
    const active = currentView === 'student' && currentStudent && currentStudent.id === s.id ? 'active' : '';
    const pending = pendingCountsByStudent[s.id] || 0;
    const badge = pending > 0
      ? `<span class="pill" style="background:var(--amber);color:#fff;font-size:11px;padding:2px 8px;flex-shrink:0;">${pending}</span>`
      : `<span class="dot" style="background:var(--sky);flex-shrink:0;"></span>`;
    const scheduleLabel = (s.lesson_weekday && s.lesson_time)
      ? `${WEEKDAY_SHORT[s.lesson_weekday - 1]} ${s.lesson_time.slice(0,5)}`
      : '';
    html += `<div class="nav-item ${active}" onclick="openStudent('${s.id}')">
      <div style="display:flex;flex-direction:column;overflow:hidden;min-width:0;">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.full_name || s.email)}</span>
        ${scheduleLabel ? `<span style="font-size:11px;color:#8FA0BF;">${scheduleLabel}</span>` : ''}
      </div>
      ${badge}
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
}

function renderHome(){
  currentStudent = null;
  currentView = 'home';
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
          <label style="display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:10px;">
            <input type="checkbox" id="broadcast-select-all" onchange="toggleSelectAllStudents(this.checked)">
            Todos
          </label>
          <div id="broadcast-student-list">
            ${students.map(s => `
              <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.5px;cursor:pointer;">
                <input type="checkbox" class="broadcast-student-checkbox" value="${s.id}" onchange="updateSelectAllState()">
                ${escapeHtml(s.full_name || s.email)}
              </label>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function toggleSelectAllStudents(checked){
  document.querySelectorAll('.broadcast-student-checkbox').forEach(cb => { cb.checked = checked; });
}

function updateSelectAllState(){
  const all = document.querySelectorAll('.broadcast-student-checkbox');
  const checkedCount = document.querySelectorAll('.broadcast-student-checkbox:checked').length;
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

  if (!confirm(`Enviar este comunicado para ${recipients.length} aluno(s)?`)) return;

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
  currentStudent = students.find(s => s.id === studentId);
  currentView = 'student';
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
    .order('created_at', { ascending: false });

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

    <div class="role-switch" style="max-width:760px;margin-bottom:26px;">
      <button class="${currentTab === 'perfil' ? 'active' : ''}" onclick="switchTab('perfil')">Perfil</button>
      <button class="${currentTab === 'nova' ? 'active' : ''}" onclick="switchTab('nova')">Cadastrar nova aula</button>
      <button class="${currentTab === 'cadastradas' ? 'active' : ''}" onclick="switchTab('cadastradas')">Aulas cadastradas</button>
      <button class="${currentTab === 'pedidos' ? 'active' : ''}" onclick="switchTab('pedidos')">Materiais do aluno</button>
      <button class="${currentTab === 'atividade' ? 'active' : ''}" onclick="switchTab('atividade')">Atividade</button>
    </div>

    <div id="tab-content"></div>
  `;

  if (currentTab === 'perfil') {
    renderPerfilTab();
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
  document.getElementById('tab-content').innerHTML = `
    <div class="box">
      <h3>Mural de conquistas</h3>
      ${buildAchievementsSection(currentLessons.length, { title: '' }) || `<div class="small-note" style="margin-top:0;">Ainda sem emblemas — aparece aqui assim que o aluno completar 10 aulas.</div>`}
    </div>

    <div class="box">
      <h3>Status de estudo — Guias de Gramática</h3>
      <div id="grammar-status-box"><div class="small-note" style="margin-top:0;">Carregando...</div></div>
    </div>

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

  renderGrammarStatusBox(s.id);
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
  const studentName = (q.profiles && (q.profiles.full_name || q.profiles.email)) || 'Aluno';
  const studentEmail = q.profiles ? q.profiles.email : '';
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
      ${r.external_link ? `<div class="resource-row"><div class="resource-icon ic-pdf">Link</div><div class="resource-info"><div class="name">Link enviado pelo aluno</div></div><button class="resource-action" onclick="window.open('${escapeAttr(r.external_link)}','_blank')">Abrir link</button></div>` : ''}
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

let resourceRowCount = 0;

function renderNovaAulaTab(){
  resourceRowCount = 0;

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
      <h3>+ Adicionar materiais a uma aula</h3>
      <div class="row">
        <select id="resource-lesson">
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
      <div id="upload-feedback" class="feedback"></div>
    </div>
  `;

  const container = document.getElementById('resource-rows-container');
  for (let i = 0; i < 3; i++) {
    resourceRowCount++;
    container.insertAdjacentHTML('beforeend', resourceRowHtml(resourceRowCount));
  }
}

function resourceRowHtml(rowIndex){
  return `
    <div class="lesson-card" id="resource-row-${rowIndex}" style="padding:14px 16px;margin-bottom:10px;">
      <div class="row">
        <select id="resource-type-${rowIndex}">
          <option value="ppt">Slides (PPT)</option>
          <option value="pdf">PDF</option>
          <option value="ex">Exercícios</option>
          <option value="rep">Relatório de desempenho</option>
        </select>
        <input id="resource-file-${rowIndex}" type="file">
      </div>
    </div>
  `;
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
  const idx = students.findIndex(s => s.id === currentStudent.id);
  if (idx >= 0) students[idx].permanent_lesson_link = link;
  renderPerfilTab();
}

async function saveStudentSchedule(){
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

  // Avisa o aluno dentro do próprio portal (sininho ao lado de "Minhas aulas")
  try { await sb.from('notifications').insert({ student_id: currentStudent.id, type: 'new_lesson' }); } catch (e) { console.error('Erro ao criar notificação:', e); }

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
