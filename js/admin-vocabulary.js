/* Read-only student vocabulary history; no writes or permissions changes. */
(function () {
  'use strict';
  // Vocabulário do Termo do dia na ficha do aluno.
  const VOCAB_PER_PAGE = 15;
  let vocabAdmin = { rows: [], sub: 'nao_uso', term: '', page: 0, studentId: null };

  window.renderVocabTab = async function () {
    const studentId = currentStudent.id;
    const tab = document.getElementById('tab-content');
    tab.innerHTML = `<div class="empty-state">Carregando vocabulário...</div>`;

    let data, error;
    try { ({ data, error } = await sb
      .from('word_of_day_answers')
      .select('answer, updated_at, word_of_day(term, definition, example)')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false })); } catch (e) { error = e; }

    if (!tab.isConnected || currentView !== 'student' || currentTab !== 'vocab' || !currentStudent || currentStudent.id !== studentId) return;
    if (error) { tab.innerHTML = `<div class="empty-state">Não foi possível carregar o vocabulário.</div>`; console.error(error); return; }

    vocabAdmin = { rows: (data || []).filter(r => r.word_of_day), sub: 'nao_uso', term: '', page: 0, studentId };
    drawVocabTab();
  };

  function drawVocabTab() {
    const tab = document.getElementById('tab-content');
    if (!tab || currentView !== 'student' || currentTab !== 'vocab' || currentStudent?.id !== vocabAdmin.studentId) return;
    const v = vocabAdmin;
    const notUse = v.rows.filter(r => r.answer === 'nao_uso');
    const use = v.rows.filter(r => r.answer === 'uso');

    if (v.rows.length === 0) {
      tab.innerHTML = `<div class="empty-state">${escapeHtml(currentStudent.full_name || currentStudent.email)} ainda não respondeu nenhum Termo do dia.</div>`;
      return;
    }

    const list = (v.sub === 'nao_uso' ? notUse : use).filter(r => {
      const q = v.term.trim().toLowerCase();
      return !q || r.word_of_day.term.toLowerCase().includes(q) || r.word_of_day.definition.toLowerCase().includes(q);
    });
    const pages = Math.max(1, Math.ceil(list.length / VOCAB_PER_PAGE));
    if (v.page >= pages) v.page = pages - 1;
    const items = list.slice(v.page * VOCAB_PER_PAGE, (v.page + 1) * VOCAB_PER_PAGE);

    const rowsHtml = items.map(r => `
      <div class="resource-row">
        <div class="resource-info">
          <div class="name" style="text-transform:capitalize;">${escapeHtml(r.word_of_day.term)}</div>
          <div class="desc">${escapeHtml(r.word_of_day.definition)}</div>
          <div class="desc" style="font-style:italic;">&ldquo;${escapeHtml(r.word_of_day.example)}&rdquo;</div>
        </div>
        <div class="small-note" style="margin:0;white-space:nowrap;">${new Date(r.updated_at).toLocaleDateString('pt-BR')}</div>
      </div>`).join('');

    tab.innerHTML = `
      <div class="lesson-card">
        <h3>Vocabulário do Termo do dia</h3>
        <div class="meta">Palavras que o aluno marcou, da mais recente para a mais antiga</div>

        <div class="crm-vocab-switch" aria-label="Palavras marcadas">
          <button class="${v.sub === 'nao_uso' ? 'active' : ''}" onclick="vocabAdminSub('nao_uso')">Ainda não uso (${notUse.length})</button>
          <button class="${v.sub === 'uso' ? 'active' : ''}" onclick="vocabAdminSub('uso')">Já uso (${use.length})</button>
        </div>

        <input id="vocab-admin-search" placeholder="Buscar palavra ou significado..." value="${escapeHtml(v.term)}" oninput="vocabAdminSearch(this.value)">

        ${items.length ? rowsHtml : `<div class="empty-state">Nenhuma palavra encontrada.</div>`}

        ${pages > 1 ? `
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;">
          <button class="btn-ghost" onclick="vocabAdminPage(-1)" ${v.page === 0 ? 'disabled' : ''}>← Anterior</button>
          <span class="small-note" style="margin:0;">Página ${v.page + 1} de ${pages}</span>
          <button class="btn-ghost" onclick="vocabAdminPage(1)" ${v.page >= pages - 1 ? 'disabled' : ''}>Próxima →</button>
        </div>` : ''}
      </div>`;
  }

  window.vocabAdminSub = function (sub) { vocabAdmin.sub = sub; vocabAdmin.page = 0; drawVocabTab(); };
  window.vocabAdminPage = function (d) { vocabAdmin.page += d; drawVocabTab(); };
  window.vocabAdminSearch = function (val) {
    vocabAdmin.term = val; vocabAdmin.page = 0; drawVocabTab();
    const el = document.getElementById('vocab-admin-search');   // mantém o foco ao digitar
    if (el) { el.focus(); el.setSelectionRange(val.length, val.length); }
  };
})();
