let myProfile = null;

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (myProfile.role !== 'student') { window.location.href = 'admin.html'; return; }

  await syncLanguageFromProfile(myProfile);
  document.getElementById('lang-switcher-container').innerHTML = buildLanguageSwitcher(myProfile.id);
  translateStaticChrome();

  await syncThemeFromProfile(myProfile);
  document.getElementById('theme-toggle-container').innerHTML = buildThemeToggle(myProfile.id);

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('enviar', await isGrammarUnlocked());
  render();
})();

function render(){
  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${t('send_material_title')}</h1>
        <div class="sub">${t('send_material_sub')}</div>
      </div>
    </div>

    <div class="lesson-card">
      <h3>${t('new_request_title')}</h3>

      <label>${t('request_date_label')}</label>
      <input id="req-date" type="date">

      <label>${t('file_label')}</label>
      <input id="req-file" type="file">
      <div class="small-note" style="margin-bottom:16px;">${t('file_hint')}</div>

      <label>${t('link_label')}</label>
      <input id="req-link" type="url" placeholder="${t('link_placeholder')}">

      <label>${t('usage_label')}</label>
      <textarea id="req-notes" placeholder="${t('usage_placeholder')}"></textarea>

      <button id="req-submit-btn" class="btn-dark-sm" onclick="submitRequest()">${t('notify_btn')}</button>
      <div id="req-feedback" class="feedback"></div>
    </div>

    <div class="lesson-card">
      <h3>${t('my_requests_title')}</h3>
      <div id="my-requests-list"><div class="empty-state">${t('loading')}</div></div>
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

  if (!date) { showFeedback(t('date_required_error'), false); return; }
  if (!file && !link) { showFeedback(t('file_or_link_required_error'), false); return; }

  const btn = document.getElementById('req-submit-btn');
  btn.disabled = true;
  btn.textContent = t('sending');

  let filePath = null;
  let fileName = null;

  if (file) {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    filePath = `${myProfile.id}/requests/${Date.now()}_${safeFileName}`;
    fileName = file.name;

    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) {
      showFeedback(t('file_upload_error'), false);
      btn.disabled = false;
      btn.textContent = t('notify_btn');
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
  btn.textContent = t('notify_btn');

  if (insertError) {
    showFeedback(t('request_save_error'), false);
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
    showFeedback(t('admin_email_not_found_error', {err: adminError ? adminError.message : 'perfil não encontrado'}), false);
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
    showFeedback(t('request_email_send_error'), false);
    loadMyRequests();
    return;
  }

  logActivity(myProfile.id, 'material_request', `Para ${formatDateBR(date)}`);
  showFeedback(t('request_sent_success'), true);
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
    list.innerHTML = `<div class="empty-state">${t('load_requests_error')}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">${t('no_requests')}</div>`;
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="resource-row">
      <div class="resource-icon ic-pdf">${r.file_path ? t('file_tag') : t('link_tag')}</div>
      <div class="resource-info">
        <div class="name">${t('for_date', {date: formatDateBR(r.requested_date)})}</div>
        <div class="desc">${escapeHtml(r.notes || t('no_notes'))}</div>
      </div>
    </div>
  `).join('');
}

function formatDateBR(isoDate){
  if (!isoDate) return t('no_date');
  const [y,m,d] = isoDate.split('-');
  return (getLang() === 'en') ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}
