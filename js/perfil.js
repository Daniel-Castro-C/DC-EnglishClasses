let myProfile = null;

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (myProfile.role !== 'student') { window.location.href = 'admin.html'; return; }

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('perfil');
  render();
})();

function render(){
  const avatarSrc = myProfile.avatar_url || '';
  const linkAula = myProfile.permanent_lesson_link;

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Perfil</h1>
        <div class="sub">Sua foto, seu nome e sua senha</div>
      </div>
    </div>

    <div class="lesson-card">
      <h3>Foto e nome</h3>
      <div class="avatar-row">
        ${avatarSrc
          ? `<img id="avatar-preview" class="avatar-preview" src="${avatarSrc}" alt="Sua foto">`
          : `<div id="avatar-preview" class="avatar-preview"></div>`}
        <div style="flex:1;">
          <input id="avatar-file" type="file" accept="image/*">
          <div class="small-note">Escolha uma foto e ela é enviada automaticamente.</div>
        </div>
      </div>
      <div id="avatar-feedback" class="feedback"></div>

      <label style="margin-top:18px;">Nome completo</label>
      <input id="full-name-input" value="${escapeHtml(myProfile.full_name || '')}">
      <button class="btn-dark-sm" onclick="saveName()">Salvar nome</button>
      <div id="name-feedback" class="feedback"></div>
    </div>

    <div class="lesson-card">
      <h3>Link fixo da sua aula</h3>
      <div class="meta">Este link é definido pelo seu professor e não muda a cada aula.</div>
      ${linkAula
        ? `<button class="btn-dark-sm" onclick="window.open('${escapeAttr(linkAula)}', '_blank')">Abrir link da aula</button>`
        : `<div class="empty-state">Seu professor ainda não configurou este link.</div>`}
    </div>

    <div class="lesson-card">
      <h3>Alterar senha</h3>
      <label>Nova senha</label>
      <input id="new-pass-1" type="password" placeholder="Mínimo 6 caracteres">
      <label>Confirmar nova senha</label>
      <input id="new-pass-2" type="password" placeholder="Repita a nova senha">
      <button class="btn-dark-sm" onclick="changePassword()">Salvar nova senha</button>
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

  showFeedback('avatar-feedback', 'Enviando foto...', true);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${myProfile.id}/avatar.${ext}`;

  const { error: uploadError } = await sb.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    showFeedback('avatar-feedback', 'Não foi possível enviar a foto.', false);
    return;
  }

  const { data: urlData } = sb.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl + '?t=' + Date.now(); // evita cache da foto antiga

  const { error: updateError } = await sb.from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', myProfile.id);

  if (updateError) {
    showFeedback('avatar-feedback', 'Foto enviada, mas não foi possível salvar.', false);
    return;
  }

  myProfile.avatar_url = publicUrl;
  document.getElementById('avatar-preview').outerHTML =
    `<img id="avatar-preview" class="avatar-preview" src="${publicUrl}" alt="Sua foto">`;
  showFeedback('avatar-feedback', 'Foto atualizada!', true);
}

async function saveName(){
  const name = document.getElementById('full-name-input').value.trim();
  if (!name) { showFeedback('name-feedback', 'Digite um nome.', false); return; }

  const { error } = await sb.from('profiles').update({ full_name: name }).eq('id', myProfile.id);
  if (error) { showFeedback('name-feedback', 'Não foi possível salvar.', false); return; }

  myProfile.full_name = name;
  showFeedback('name-feedback', 'Nome atualizado!', true);
}

async function changePassword(){
  const p1 = document.getElementById('new-pass-1').value;
  const p2 = document.getElementById('new-pass-2').value;

  if (p1.length < 6) { showFeedback('pass-feedback', 'A senha precisa ter pelo menos 6 caracteres.', false); return; }
  if (p1 !== p2) { showFeedback('pass-feedback', 'As senhas não coincidem.', false); return; }

  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { showFeedback('pass-feedback', 'Não foi possível alterar a senha.', false); return; }

  document.getElementById('new-pass-1').value = '';
  document.getElementById('new-pass-2').value = '';
  showFeedback('pass-feedback', 'Senha alterada com sucesso!', true);
}

function escapeAttr(str){ return escapeHtml(str); }
