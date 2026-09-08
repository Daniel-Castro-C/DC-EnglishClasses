let myProfile = null;

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (myProfile.role !== 'student') { window.location.href = 'admin.html'; return; }

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('enviar');
  render();
})();

function render(){
  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Enviar material para uma aula</h1>
        <div class="sub">Quer usar algo específico numa próxima aula? Envie aqui e o professor será avisado.</div>
      </div>
    </div>

    <div class="lesson-card">
      <h3>Novo pedido de material</h3>

      <label>Para qual data você quer usar este material?</label>
      <input id="req-date" type="date">

      <label>Arquivo (opcional)</label>
      <input id="req-file" type="file">
      <div class="small-note" style="margin-bottom:16px;">Aceita PPT, PDF, Word, imagens, etc.</div>

      <label>Ou, em vez de um arquivo, um link (opcional)</label>
      <input id="req-link" type="url" placeholder="https://... (ex: link de um artigo ou vídeo)">

      <label>Como você gostaria de usar esse material?</label>
      <textarea id="req-notes" placeholder="Conte pra gente como imagina usar esse material na aula — por exemplo: simular uma apresentação, praticar vocabulário, treinar leitura em voz alta, conversar sobre o assunto, tirar dúvidas específicas, etc."></textarea>

      <button id="req-submit-btn" class="btn-dark-sm" onclick="submitRequest()">Avisar ao professor</button>
      <div id="req-feedback" class="feedback"></div>
    </div>

    <div class="lesson-card">
      <h3>Meus pedidos enviados</h3>
      <div id="my-requests-list"><div class="empty-state">Carregando...</div></div>
    </div>
  `;

  loadMyRequests();
}

function showFeedback(msg, ok){
  const el = document.getElementById('req-feedback');
  el.textContent = msg;
  el.className = 'feedback show ' + (ok ? 'ok' : 'err');
}

async function submitRequest(){
  const date = document.getElementById('req-date').value || null;
  const link = document.getElementById('req-link').value.trim() || null;
  const notes = document.getElementById('req-notes').value.trim() || null;
  const fileInput = document.getElementById('req-file');
  const file = fileInput.files[0] || null;

  if (!date) { showFeedback('Escolha a data em que quer usar o material.', false); return; }
  if (!file && !link) { showFeedback('Envie um arquivo ou informe um link.', false); return; }

  const btn = document.getElementById('req-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  let filePath = null;
  let fileName = null;

  if (file) {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = `${myProfile.id}/requests/${Date.now()}_${safeFileName}`;
    fileName = file.name;

    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) {
      showFeedback('Não foi possível enviar o arquivo. Tente novamente.', false);
      btn.disabled = false;
      btn.textContent = 'Avisar ao professor';
      return;
    }
  }

  const { error: insertError } = await sb.from('material_requests').insert({
    student_id: myProfile.id,
    requested_date: date,
    notes,
    external_link: link,
    file_path: filePath,
    file_name: fileName
  });

  btn.disabled = false;
  btn.textContent = 'Avisar ao professor';

  if (insertError) {
    showFeedback('Não foi possível registrar seu pedido. Tente novamente.', false);
    console.error(insertError);
    return;
  }

  // Avisa o professor por e-mail
  const { data: adminProfile, error: adminError } = await sb
    .from('profiles')
    .select('email, full_name')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (adminError || !adminProfile) {
    console.error('Erro ao buscar perfil do professor:', adminError);
    showFeedback('Pedido salvo, mas não foi possível encontrar o e-mail do professor para notificar. (Erro: ' + (adminError ? adminError.message : 'perfil não encontrado') + ')', false);
    loadMyRequests();
    return;
  }

  const dateFormatted = formatDateBR(date);
  const studentName = myProfile.full_name || myProfile.email;
  const emailResult = await sendLessonNotification(
    adminProfile.email,
    adminProfile.full_name,
    `Aluno ${studentName} adicionou um material para ser usado na data ${dateFormatted}. Acesse o portal para conferir os detalhes.`
  );

  if (!emailResult.ok) {
    console.error('Erro ao enviar e-mail:', emailResult.err);
    showFeedback('Pedido salvo, mas não foi possível enviar o e-mail de aviso. (Verifique o console para detalhes)', false);
    loadMyRequests();
    return;
  }

  showFeedback('Pedido enviado! O professor foi avisado por e-mail.', true);
  document.getElementById('req-date').value = '';
  document.getElementById('req-file').value = '';
  document.getElementById('req-link').value = '';
  document.getElementById('req-notes').value = '';

  loadMyRequests();
}

async function loadMyRequests(){
  const { data, error } = await sb
    .from('material_requests')
    .select('*')
    .eq('student_id', myProfile.id)
    .order('created_at', { ascending: false });

  const list = document.getElementById('my-requests-list');

  if (error) {
    list.innerHTML = `<div class="empty-state">Não foi possível carregar seus pedidos.</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">Você ainda não enviou nenhum pedido de material.</div>`;
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="resource-row">
      <div class="resource-icon ic-pdf">${r.file_path ? 'Arq' : 'Link'}</div>
      <div class="resource-info">
        <div class="name">Para ${formatDateBR(r.requested_date)}</div>
        <div class="desc">${escapeHtml(r.notes || 'Sem observações')}</div>
      </div>
    </div>
  `).join('');
}

function formatDateBR(isoDate){
  if (!isoDate) return '(sem data)';
  const [y,m,d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
