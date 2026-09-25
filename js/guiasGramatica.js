let myProfile = null;
let activeLevel = null; // null = tela de seleção de nível
let grammarUnlocked = false;
let notifCounts = {};
let allMaterialsCache = null; // usado só pela busca (todos os níveis, carregado sob demanda)
let searchTerm = '';
let myStatusMap = {}; // material_id -> 'estudado' | 'estudar_mais'
let studyFilter = 'all'; // 'all' | 'estudado' | 'estudar_mais'

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

  await syncThemeFromProfile(myProfile);
  document.getElementById('theme-toggle-container').innerHTML = buildThemeToggle(myProfile.id);

  grammarUnlocked = await isGrammarUnlocked();
  notifCounts = await getNotificationCounts(myProfile.id);

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('gramatica', grammarUnlocked, notifCounts);

  if (!grammarUnlocked) {
    document.getElementById('main-content').innerHTML = `
      <div class="topline"><div><h1>${t('nav_gramatica')}</h1></div></div>
      <div class="empty-state">${t('grammar_locked_msg')}</div>
    `;
    return;
  }

  await loadMyStatusMap();
  renderLevelSelection();
})();

// Carrega, de uma vez, o status ("estudado"/"estudar_mais") que o próprio aluno já marcou
async function loadMyStatusMap(){
  try {
    const { data } = await sb.from('grammar_material_status').select('material_id, status').eq('student_id', myProfile.id);
    myStatusMap = {};
    (data || []).forEach(row => { myStatusMap[row.material_id] = row.status; });
  } catch (e) {
    myStatusMap = {};
  }
}

async function setStudyStatus(materialId, status){
  // clique no botão já marcado: desmarca (volta pro estado "sem marcador")
  if (myStatusMap[materialId] === status) {
    await sb.from('grammar_material_status').delete().eq('student_id', myProfile.id).eq('material_id', materialId);
    delete myStatusMap[materialId];
  } else {
    await sb.from('grammar_material_status').upsert(
      { student_id: myProfile.id, material_id: materialId, status, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,material_id' }
    );
    myStatusMap[materialId] = status;
  }
  // re-renderiza só a tela atual, sem recarregar tudo de novo
  if (searchTerm) {
    renderSearchResults();
  } else if (activeLevel) {
    showLevel(activeLevel);
  }
}

// Aplica o filtro "Todos / Já estudei / Estudar mais" a uma lista de materiais
function applyStudyFilter(materials){
  if (studyFilter === 'all') return materials;
  return materials.filter(m => myStatusMap[m.id] === studyFilter);
}

function setStudyFilter(filter){
  studyFilter = filter;
  if (searchTerm) {
    renderSearchResults();
  } else if (activeLevel) {
    showLevel(activeLevel);
  }
}

function studyFilterControlHtml(){
  return `
    <div class="role-switch" style="max-width:460px;margin-bottom:16px;">
      <button class="${studyFilter === 'all' ? 'active' : ''}" onclick="setStudyFilter('all')">${t('filter_all')}</button>
      <button class="${studyFilter === 'estudado' ? 'active' : ''}" onclick="setStudyFilter('estudado')">${t('mark_studied')}</button>
      <button class="${studyFilter === 'estudar_mais' ? 'active' : ''}" onclick="setStudyFilter('estudar_mais')">${t('mark_study_more')}</button>
    </div>
  `;
}

function renderLevelSelection(){
  activeLevel = null;
  searchTerm = '';
  renderNav();

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${t('nav_gramatica')}</h1>
        <div class="sub">${t('choose_level_sub')}</div>
      </div>
    </div>
    <input id="grammar-search-input" placeholder="${t('grammar_search_placeholder')}" value=""
      oninput="onGrammarSearchInput(this.value)" style="margin-bottom:18px;">
    <div id="grammar-search-results"></div>
    <div id="grammar-level-cards" class="level-cards">
      <div class="level-card" onclick="showLevel('basico')"><h3>${t('level_basico')}</h3><p>${t('level_basico_desc')}</p></div>
      <div class="level-card" onclick="showLevel('intermediario')"><h3>${t('level_intermediario')}</h3><p>${t('level_intermediario_desc')}</p></div>
      <div class="level-card" onclick="showLevel('avancado')"><h3>${t('level_avancado')}</h3><p>${t('level_avancado_desc')}</p></div>
    </div>
  `;
}

// Busca nos 3 níveis de uma vez. Carrega todos os materiais uma única vez (cache em memória)
// e filtra localmente a cada tecla digitada, do mesmo jeito que a busca de "Minhas aulas".
async function onGrammarSearchInput(value){
  searchTerm = value;

  if (!searchTerm.trim()) {
    document.getElementById('grammar-search-results').innerHTML = '';
    document.getElementById('grammar-level-cards').style.display = '';
    return;
  }

  document.getElementById('grammar-level-cards').style.display = 'none';

  if (allMaterialsCache === null) {
    document.getElementById('grammar-search-results').innerHTML = `<div class="empty-state">${t('loading_materials')}</div>`;
    const { data, error } = await sb.from('grammar_materials').select('*').order('created_at', { ascending: true });
    allMaterialsCache = error ? [] : (data || []);
  }

  renderSearchResults();
}

function renderSearchResults(){
  const term = searchTerm.trim().toLowerCase();
  const container = document.getElementById('grammar-search-results');
  if (!container) return;

  if (!term) { container.innerHTML = ''; return; }

  const textMatches = (allMaterialsCache || []).filter(m => m.title.toLowerCase().includes(term));
  const matches = applyStudyFilter(textMatches);

  container.innerHTML = `
    <div class="lesson-card" style="padding:14px 16px;">
      <h3 style="margin-bottom:10px;">${t('grammar_search_results_label')}</h3>
      ${studyFilterControlHtml()}
      ${matches.length ? matches.map(m => materialItemHtml(m, true)).join('') : `<div class="empty-state">${t('grammar_search_no_results')}</div>`}
    </div>
  `;
}

function renderNav(){
  let html = buildStudentTopNav('gramatica', grammarUnlocked, notifCounts);
  html += `<div class="nav-label">${t('nav_gramatica')}</div>`;
  ['basico','intermediario','avancado'].forEach(level => {
    html += `<div class="nav-item ${activeLevel === level ? 'active' : ''}" onclick="showLevel('${level}')">
      <span>${levelLabel(level)}</span>
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
}

let currentMaterials = [];

// Monta o bloco de um material: linha principal (download/preview/vídeo) + status de
// estudo + botão de dúvida. showLevelTag: usado nos resultados de busca (cross-nível),
// onde mostramos também o nível do material.
function materialItemHtml(m, showLevelTag){
  const levelTag = showLevelTag ? `<span class="pill" style="margin-right:8px;">${levelLabel(m.level)}</span>` : '';
  const previewBtns = [
    isPdfPath(m.file_path) ? `<button class="resource-action" onclick="previewFile('${m.file_path}')">${t('preview_file')}</button>` : '',
    m.file_path_en && isPdfPath(m.file_path_en) ? `<button class="resource-action" onclick="previewFile('${m.file_path_en}')">${t('preview_file')} (EN)</button>` : '',
  ].join('');
  const status = myStatusMap[m.id];
  const askUrl = 'pergunte-ao-daniel.html?subject=' + encodeURIComponent(t('ask_about_prefix') + ' ' + m.title);

  return `
    <div class="grammar-material-item">
      <div class="resource-row" style="padding:8px 0;">
        <div class="resource-icon ic-pdf" style="width:26px;height:26px;font-size:10.5px;flex-shrink:0;">${escapeHtml(m.sublevel || '')}</div>
        <div class="resource-info">
          <div class="name">${levelTag}${escapeHtml(m.title)}</div>
        </div>
        ${m.video_visible && m.youtube_link ? `<button class="resource-action" onclick="openYoutubeLink('${m.id}')">${t('watch_video')}</button>` : ''}
        ${previewBtns}
        ${m.file_path_en
          ? `<button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path}')">${t('download_pt')}</button>
             <button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path_en}')">${t('download_en')}</button>`
          : `<button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path}')">${t('download_file')}</button>`
        }
      </div>
      <div class="study-status-row">
        <button class="study-btn ${status === 'estudado' ? 'active-good' : ''}" onclick="setStudyStatus('${m.id}','estudado')">✓ ${t('mark_studied')}</button>
        <button class="study-btn ${status === 'estudar_mais' ? 'active-warn' : ''}" onclick="setStudyStatus('${m.id}','estudar_mais')">↻ ${t('mark_study_more')}</button>
        <button class="study-btn" onclick="window.location.href='${askUrl}'">? ${t('ask_about_material')}</button>
      </div>
    </div>
  `;
}

async function showLevel(level){
  activeLevel = level;
  searchTerm = '';
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
      ${studyFilterControlHtml()}
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
  const filtered = applyStudyFilter(data);

  list.innerHTML = filtered.length
    ? filtered.map(m => materialItemHtml(m, false)).join('')
    : `<div class="empty-state">${t('grammar_search_no_results')}</div>`;
}

function openYoutubeLink(materialId){
  const pool = (allMaterialsCache && allMaterialsCache.length ? allMaterialsCache : currentMaterials);
  const m = pool.find(item => item.id === materialId);
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

  const pool = (allMaterialsCache && allMaterialsCache.length ? allMaterialsCache : currentMaterials);
  const material = pool.find(m => m.file_path === filePath || m.file_path_en === filePath);
  logActivity(myProfile.id, 'download_grammar', material ? material.title : displayName);

  window.location.href = data.signedUrl;
}
