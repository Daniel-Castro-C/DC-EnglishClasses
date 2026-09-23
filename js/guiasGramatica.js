let myProfile = null;
let activeLevel = null; // null = tela de seleção de nível
let grammarUnlocked = false;

function levelLabel(level){
  return t('level_' + level);
}

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (myProfile.role !== 'student') { window.location.href = 'admin.html'; return; }

  await syncLanguageFromProfile(myProfile);
  document.getElementById('lang-switcher-container').innerHTML = buildLanguageSwitcher(myProfile.id);
  translateStaticChrome();

  grammarUnlocked = await isGrammarUnlocked();

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('gramatica', grammarUnlocked);

  if (!grammarUnlocked) {
    document.getElementById('main-content').innerHTML = `
      <div class="topline"><div><h1>${t('nav_gramatica')}</h1></div></div>
      <div class="empty-state">${t('grammar_locked_msg')}</div>
    `;
    return;
  }

  renderLevelSelection();
})();

function renderLevelSelection(){
  activeLevel = null;
  renderNav();

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${t('nav_gramatica')}</h1>
        <div class="sub">${t('choose_level_sub')}</div>
      </div>
    </div>
    <div class="level-cards">
      <div class="level-card" onclick="showLevel('basico')"><h3>${t('level_basico')}</h3><p>${t('level_basico_desc')}</p></div>
      <div class="level-card" onclick="showLevel('intermediario')"><h3>${t('level_intermediario')}</h3><p>${t('level_intermediario_desc')}</p></div>
      <div class="level-card" onclick="showLevel('avancado')"><h3>${t('level_avancado')}</h3><p>${t('level_avancado_desc')}</p></div>
    </div>
  `;
}

function renderNav(){
  let html = buildStudentTopNav('gramatica', grammarUnlocked);
  html += `<div class="nav-label">${t('nav_gramatica')}</div>`;
  ['basico','intermediario','avancado'].forEach(level => {
    html += `<div class="nav-item ${activeLevel === level ? 'active' : ''}" onclick="showLevel('${level}')">
      <span>${levelLabel(level)}</span>
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
}

let currentMaterials = [];

async function showLevel(level){
  activeLevel = level;
  renderNav();

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${levelLabel(level)}</h1>
        <div class="sub">${t('level_materials_sub')}</div>
      </div>
      <button class="btn-dark-sm" onclick="renderLevelSelection()">${t('back_to_levels')}</button>
    </div>
    <div class="lesson-card" style="padding:14px 16px;">
      <div id="materials-list"><div class="empty-state">${t('loading_materials')}</div></div>
    </div>
  `;

  const { data, error } = await sb
    .from('grammar_materials')
    .select('*')
    .eq('level', level)
    .order('created_at', { ascending: true });

  const list = document.getElementById('materials-list');

  if (error) {
    list.innerHTML = `<div class="empty-state">${t('materials_load_error2')}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">${t('no_materials_level')}</div>`;
    return;
  }

  currentMaterials = data;

  list.innerHTML = data.map(m => `
    <div class="resource-row" style="padding:8px 0;">
      <div class="resource-icon ic-pdf" style="width:26px;height:26px;font-size:10.5px;flex-shrink:0;">${escapeHtml(m.sublevel || '')}</div>
      <div class="resource-info">
        <div class="name">${escapeHtml(m.title)}</div>
      </div>
      ${m.video_visible && m.youtube_link ? `<button class="resource-action" onclick="openYoutubeLink('${m.id}')">${t('watch_video')}</button>` : ''}
      ${m.file_path_en
        ? `<button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path}')">${t('download_pt')}</button>
           <button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path_en}')">${t('download_en')}</button>`
        : `<button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path}')">${t('download_file')}</button>`
      }
    </div>
  `).join('');
}

function openYoutubeLink(materialId){
  const m = currentMaterials.find(item => item.id === materialId);
  if (!m || !m.youtube_link) return;
  window.open(m.youtube_link, '_blank');
}

async function downloadGrammarMaterial(filePath){
  const displayName = filePath.split('/').pop().replace(/^\d+_/, '');
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 10, { download: displayName });

  if (error || !data) {
    alert(t('download_error_alert'));
    return;
  }

  const material = currentMaterials.find(m => m.file_path === filePath || m.file_path_en === filePath);
  logActivity(myProfile.id, 'download_grammar', material ? material.title : displayName);

  window.location.href = data.signedUrl;
}
