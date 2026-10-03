let myProfile = null;
let grammarUnlocked = false;
let notifCounts = {};
let vocab = [];

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

  renderNav();
  await showVocab();

  // Se o aluno mudar a resposta no card flutuante, a lista se atualiza sozinha
  window.addEventListener('word-answer-changed', showVocab);
})();

// Submenu do módulo: novos itens de "Recursos" entram aqui, no futuro
function renderNav(){
  let html = buildStudentTopNav('recursos', grammarUnlocked, notifCounts);
  html += `<div class="nav-label">${t('nav_recursos')}</div>`;
  html += `<div class="nav-item active"><span>${t('recursos_vocab')}</span></div>`;
  document.getElementById('nav-container').innerHTML = html;
}

async function loadVocab(){
  const { data, error } = await sb
    .from('word_of_day_answers')
    .select('day_index, updated_at, word_of_day(term, definition, example)')
    .eq('student_id', myProfile.id)
    .eq('answer', 'nao_uso')
    .order('updated_at', { ascending: false });

  if (error) { console.error(error); return null; }
  return (data || []).filter(r => r.word_of_day);
}

async function showVocab(){
  const rows = await loadVocab();
  const main = document.getElementById('main-content');

  if (rows === null) {
    main.innerHTML = `<div class="empty-state">${t('recursos_load_error')}</div>`;
    return;
  }
  vocab = rows;

  const cards = vocab.map(r => `
    <div class="lesson-card">
      <div class="vocab-term">${escapeHtml(r.word_of_day.term)}</div>
      <div class="vocab-def">${escapeHtml(r.word_of_day.definition)}</div>
      <div class="vocab-ex">&ldquo;${escapeHtml(r.word_of_day.example)}&rdquo;</div>
      <button class="btn-ghost" onclick="markAsUsed(${r.day_index})">${t('word_use')}</button>
    </div>
  `).join('');

  main.innerHTML = `
    <div class="topline">
      <div>
        <h1>${t('recursos_vocab')}</h1>
        <div class="sub">${t('recursos_vocab_sub')}</div>
      </div>
      ${vocab.length ? `<div class="pill">${t('recursos_count', {n: vocab.length})}</div>` : ''}
    </div>
    ${vocab.length ? cards : `<div class="empty-state">${t('recursos_empty')}</div>`}
  `;
}

// Aluno passou a usar a palavra: ela sai da lista
async function markAsUsed(dayIndex){
  const { error } = await sb.from('word_of_day_answers')
    .update({ answer: 'uso', updated_at: new Date().toISOString() })
    .eq('student_id', myProfile.id)
    .eq('day_index', dayIndex);

  if (error) { alert(t('word_save_error')); console.error(error); return; }

  if (window.refreshWordDock) window.refreshWordDock();
  await showVocab();
}
