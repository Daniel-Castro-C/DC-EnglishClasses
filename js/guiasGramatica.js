let myProfile = null;
let activeLevel = null; // null = tela de seleção de nível
let grammarUnlocked = false;

const LEVEL_LABELS = { basico: 'Básico (A1/A2)', intermediario: 'Intermediário (B1/B2)', avancado: 'Avançado (C1/C2)' };

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (myProfile.role !== 'student') { window.location.href = 'admin.html'; return; }

  grammarUnlocked = await isGrammarUnlocked();

  document.getElementById('nav-container').innerHTML = buildStudentTopNav('gramatica', grammarUnlocked);

  if (!grammarUnlocked) {
    document.getElementById('main-content').innerHTML = `
      <div class="topline"><div><h1>Guias de Gramática</h1></div></div>
      <div class="empty-state">Este conteúdo ainda não está disponível. Fique de olho — em breve seu professor libera os materiais por aqui!</div>
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
        <h1>Guias de Gramática</h1>
        <div class="sub">Escolha um nível para ver os materiais disponíveis</div>
      </div>
    </div>
    <div class="level-cards">
      <div class="level-card" onclick="showLevel('basico')"><h3>Básico (A1/A2)</h3><p>Fundamentos da gramática</p></div>
      <div class="level-card" onclick="showLevel('intermediario')"><h3>Intermediário (B1/B2)</h3><p>Aprofundando as estruturas</p></div>
      <div class="level-card" onclick="showLevel('avancado')"><h3>Avançado (C1/C2)</h3><p>Nuances e usos mais complexos</p></div>
    </div>
  `;
}

function renderNav(){
  let html = buildStudentTopNav('gramatica', grammarUnlocked);
  html += `<div class="nav-label">Guias de Gramática</div>`;
  ['basico','intermediario','avancado'].forEach(level => {
    html += `<div class="nav-item ${activeLevel === level ? 'active' : ''}" onclick="showLevel('${level}')">
      <span>${LEVEL_LABELS[level]}</span>
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
}

async function showLevel(level){
  activeLevel = level;
  renderNav();

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${LEVEL_LABELS[level]}</h1>
        <div class="sub">Materiais de gramática deste nível</div>
      </div>
      <button class="btn-dark-sm" onclick="renderLevelSelection()">← Todos os níveis</button>
    </div>
    <div class="lesson-card">
      <div id="materials-list"><div class="empty-state">Carregando materiais...</div></div>
    </div>
  `;

  const { data, error } = await sb
    .from('grammar_materials')
    .select('*')
    .eq('level', level)
    .order('created_at', { ascending: true });

  const list = document.getElementById('materials-list');

  if (error) {
    list.innerHTML = `<div class="empty-state">Não foi possível carregar os materiais.</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">Nenhum material neste nível ainda.</div>`;
    return;
  }

  list.innerHTML = data.map(m => `
    <div class="resource-row">
      <div class="resource-icon ic-pdf">Arq</div>
      <div class="resource-info">
        <div class="name">${escapeHtml(m.title)}</div>
      </div>
      <button class="resource-action" onclick="downloadGrammarMaterial('${m.file_path}')">Baixar arquivo</button>
    </div>
  `).join('');
}

async function downloadGrammarMaterial(filePath){
  const displayName = filePath.split('/').pop().replace(/^\d+_/, '');
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 10, { download: displayName });

  if (error || !data) {
    alert('Não foi possível baixar este arquivo. Tente novamente.');
    return;
  }
  window.location.href = data.signedUrl;
}
