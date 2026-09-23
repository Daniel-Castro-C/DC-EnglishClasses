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

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('perfil', await isGrammarUnlocked());
  render();
})();

function render(){
  const avatarSrc = myProfile.avatar_url || '';
  const linkAula = myProfile.permanent_lesson_link;
  const WEEKDAY_KEYS = ['weekday_1', 'weekday_2', 'weekday_3', 'weekday_4', 'weekday_5', 'weekday_6', 'weekday_7'];
  const scheduleLabel = (myProfile.lesson_weekday && myProfile.lesson_time)
    ? `${t(WEEKDAY_KEYS[myProfile.lesson_weekday - 1])}, ${myProfile.lesson_time.slice(0,5)}`
    : '';

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${t('nav_perfil')}</h1>
        <div class="sub">${t('profile_sub')}</div>
      </div>
    </div>

    <div class="lesson-card">
      <h3>${t('photo_name_title')}</h3>
      <div class="avatar-row">
        ${avatarSrc
          ? `<img id="avatar-preview" class="avatar-preview" src="${avatarSrc}" alt="Sua foto">`
          : `<div id="avatar-preview" class="avatar-preview"></div>`}
        <div style="flex:1;">
          <input id="avatar-file" type="file" accept="image/*">
          <div class="small-note">${t('photo_hint')}</div>
        </div>
      </div>
      <div id="avatar-feedback" class="feedback"></div>

      <label style="margin-top:18px;">${t('full_name_label')}</label>
      <input id="full-name-input" value="${escapeHtml(myProfile.full_name || '')}">
      <button class="btn-dark-sm" onclick="saveName()">${t('save_name_btn')}</button>
      <div id="name-feedback" class="feedback"></div>
    </div>

    <div class="lesson-card">
      <h3>${t('lesson_link_title')}</h3>
      <div class="meta">${t('lesson_link_meta')}</div>
      ${linkAula
        ? `<button class="btn-dark-sm" onclick="window.open('${escapeAttr(linkAula)}', '_blank')">${t('open_lesson_link')}</button>`
        : `<div class="empty-state">${t('lesson_link_not_set')}</div>`}
      ${scheduleLabel ? `
        <div style="border-top:1px solid var(--line);margin:18px 0 12px;"></div>
        <h3 style="margin-bottom:4px;">${t('schedule_title')}</h3>
        <div style="font-size:15px;color:var(--ink);font-weight:600;">${scheduleLabel}</div>
      ` : ''}
    </div>

    <div class="lesson-card">
      <h3>${t('change_password_title')}</h3>
      <label>${t('new_password_label')}</label>
      <input id="new-pass-1" type="password" placeholder="${t('new_password_placeholder')}">
      <label>${t('confirm_password_label')}</label>
      <input id="new-pass-2" type="password" placeholder="${t('confirm_password_placeholder')}">
      <button class="btn-dark-sm" onclick="changePassword()">${t('save_password_btn')}</button>
      <div id="pass-feedback" class="feedback"></div>
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
  const name = document.getElementById('full-name-input').value.trim();
  if (!name) { showFeedback('name-feedback', t('name_empty_error'), false); return; }

  const { error } = await sb.from('profiles').update({ full_name: name }).eq('id', myProfile.id);
  if (error) { showFeedback('name-feedback', t('name_save_error'), false); return; }

  myProfile.full_name = name;
  showFeedback('name-feedback', t('name_updated'), true);
}

async function changePassword(){
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
