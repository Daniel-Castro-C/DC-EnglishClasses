let myProfile = null;

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (!canAccessStudentPortal(myProfile)) { window.location.href = 'admin.html'; return; }
  myProfile = studentPortalProfile(myProfile);

  await syncLanguageFromProfile(myProfile);
  document.getElementById('lang-switcher-container').innerHTML = buildLanguageSwitcher(myProfile.id);
  translateStaticChrome();

  await syncThemeFromProfile(myProfile);
  document.getElementById('theme-toggle-container').innerHTML = buildThemeToggle(myProfile.id);

  const [grammarUnlocked,notifCounts]=await Promise.all([isGrammarUnlocked(),getNotificationCounts(myProfile.id)]);
  document.getElementById('nav-container').innerHTML = buildStudentTopNav('perfil', grammarUnlocked, notifCounts);
  render();
})();


function render(){
  // A versão de teste continua totalmente protegida: não exibe formulários
  // que poderiam modificar nome, foto, senha ou preferências do professor.
  if (isTestStudentProfile(myProfile)) {
    document.getElementById('main-content').innerHTML = `
      <div class="student-page student-profile-page">
        <header class="student-page-heading">
          <span class="student-page-kicker">${t('profile_kicker')}</span>
          <h1>${t('nav_perfil')}</h1>
          <p>${t('profile_sub')}</p>
        </header>
        <div class="student-profile-hero">
          <span class="student-profile-initial" aria-hidden="true">T</span>
          <div><h2>${escapeHtml(TEACHER_TEST_NAME)}</h2><p>Perfil de demonstração vinculado ao professor</p></div>
          <span class="student-soft-tag">TESTE</span>
        </div>
        <section class="student-panel">
          <div class="student-panel-head"><h2>${escapeHtml(TEACHER_TEST_NAME)}</h2></div>
          <p>Você está explorando o portal como aluno sem trocar de conta.</p>
          <p class="student-muted">E-mail de comunicados: <strong>${escapeHtml(TEACHER_TEST_EMAIL)}</strong></p>
          <p class="student-muted">As configurações de nome, foto, senha e horários da sua conta real ficam protegidas nesta visualização.</p>
          <button type="button" class="btn-dark-sm student-primary-action" onclick="leaveStudentTestMode()">← Voltar ao painel do professor</button>
        </section>
      </div>
    `;
    return;
  }

  const avatarSrc = myProfile.avatar_url || '';
  const linkAula = myProfile.permanent_lesson_link;
  const WEEKDAY_KEYS = ['weekday_1','weekday_2','weekday_3','weekday_4','weekday_5','weekday_6','weekday_7'];
  const scheduleLabel = myProfile.lesson_weekday && myProfile.lesson_time
    ? `${t(WEEKDAY_KEYS[myProfile.lesson_weekday - 1])}, ${myProfile.lesson_time.slice(0,5)}` : '';

  document.getElementById('main-content').innerHTML = `
    <div class="student-page student-profile-page">
      <header class="student-page-heading">
        <span class="student-page-kicker">${t('profile_kicker')}</span>
        <h1>${t('nav_perfil')}</h1>
        <p>${t('profile_sub')}</p>
      </header>
      <div class="student-profile-hero">
        ${avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" alt="" class="student-profile-initial student-profile-hero-photo">` :
          `<span class="student-profile-initial" aria-hidden="true">${escapeHtml((myProfile.full_name || myProfile.email || 'A').trim().charAt(0).toUpperCase())}</span>`}
        <div><h2>${escapeHtml(myProfile.full_name || myProfile.email || '')}</h2>
          <p>${t('area_aluno')}</p></div>
        <span class="student-soft-tag">${t('area_aluno')}</span>
      </div>
      <div class="student-section-grid student-grid-main">
        <section class="student-panel">
          <div class="student-panel-head"><h2>${t('profile_personal_heading')}</h2></div>
          <div class="avatar-row student-profile-avatar-row">
            ${avatarSrc ? `<img id="avatar-preview" class="avatar-preview" src="${escapeHtml(avatarSrc)}" alt="${t('photo_name_title')}">` :
              '<div id="avatar-preview" class="avatar-preview"></div>'}
            <div class="student-avatar-picker">
              <label for="avatar-file">${t('photo_name_title')}</label>
              <input id="avatar-file" type="file" accept="image/*">
              <div class="student-muted">${t('photo_hint')}</div>
            </div>
          </div>
          <div id="avatar-feedback" class="feedback" role="status" aria-live="polite"></div>
          <label for="full-name-input">${t('full_name_label')}</label>
          <input id="full-name-input" value="${escapeHtml(myProfile.full_name || '')}">
          <button class="btn-dark-sm student-primary-action" onclick="saveName()">${t('save_name_btn')}</button>
          <div id="name-feedback" class="feedback" role="status" aria-live="polite"></div>
        </section>
        <section class="student-panel">
          <div class="student-panel-head"><h2>${t('profile_class_heading')}</h2></div>
          <label>${t('lesson_link_title')}</label>
          <p class="student-muted">${t('lesson_link_meta')}</p>
          ${linkAula ? `
            <a class="btn-dark-sm student-secondary-link" href="${escapeHtml(linkAula)}" target="_blank" rel="noopener noreferrer">${t('open_lesson_link')} ↗</a>
          ` : `<div class="student-muted student-profile-unset">${t('lesson_link_not_set')}</div>`}
          ${scheduleLabel ? `
            <div class="student-profile-schedule">
              <label>${t('schedule_title')}</label>
              <strong>${escapeHtml(scheduleLabel)}</strong>
            </div>
          ` : ''}
        </section>
      </div>
      <!-- Segurança sempre após informações pessoais e informações de aula. -->
      <section class="student-panel student-profile-security">
        <div class="student-panel-head"><h2>${t('profile_security_heading')}</h2></div>
        <div class="student-security-fields">
          <div><label for="new-pass-1">${t('new_password_label')}</label>
            <input id="new-pass-1" type="password" placeholder="${t('new_password_placeholder')}"></div>
          <div><label for="new-pass-2">${t('confirm_password_label')}</label>
            <input id="new-pass-2" type="password" placeholder="${t('confirm_password_placeholder')}"></div>
        </div>
        <button class="btn-dark-sm student-primary-action" onclick="changePassword()">${t('save_password_btn')}</button>
        <div id="pass-feedback" class="feedback" role="status" aria-live="polite"></div>
      </section>
    </div>
  `;

  document.getElementById('avatar-file').addEventListener('change', uploadAvatar);
}

function showFeedback(id, msg, ok){
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'feedback show ' + (ok ? 'ok' : 'err');
}

async function uploadAvatar(e){
  if (isTestStudentProfile(myProfile)) return;
  const file = e.target.files[0];
  if (!file) return;

  showFeedback('avatar-feedback', t('uploading_photo'), true);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${myProfile.id}/avatar.${ext}`;

  const { error: uploadError } = await sb.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    showFeedback('avatar-feedback', t('photo_upload_error'), false);
    return;
  }

  const { data: urlData } = sb.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // evita cache da foto antiga

  const { error: updateError } = await sb.from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', myProfile.id);

  if (updateError) {
    showFeedback('avatar-feedback', t('photo_save_error'), false);
    return;
  }

  myProfile.avatar_url = publicUrl;
  document.getElementById('avatar-preview').outerHTML =
    `<img id="avatar-preview" class="avatar-preview" src="${publicUrl}" alt="Sua foto">`;
  showFeedback('avatar-feedback', t('photo_updated'), true);
}

async function saveName(){
  if (isTestStudentProfile(myProfile)) return;
  const name = document.getElementById('full-name-input').value.trim();
  if (!name) { showFeedback('name-feedback', t('name_empty_error'), false); return; }

  const { error } = await sb.from('profiles').update({ full_name: name }).eq('id', myProfile.id);
  if (error) { showFeedback('name-feedback', t('name_save_error'), false); return; }

  myProfile.full_name = name;
  showFeedback('name-feedback', t('name_updated'), true);
}

async function changePassword(){
  if (isTestStudentProfile(myProfile)) return;
  const p1 = document.getElementById('new-pass-1').value;
  const p2 = document.getElementById('new-pass-2').value;

  if (p1.length < 6) { showFeedback('pass-feedback', t('password_min_length_error'), false); return; }
  if (p1 !== p2) { showFeedback('pass-feedback', t('password_mismatch_error'), false); return; }

  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { showFeedback('pass-feedback', t('password_change_error'), false); return; }

  document.getElementById('new-pass-1').value = '';
  document.getElementById('new-pass-2').value = '';
  showFeedback('pass-feedback', t('password_changed'), true);
}

function escapeAttr(str){ return escapeHtml(str); }
