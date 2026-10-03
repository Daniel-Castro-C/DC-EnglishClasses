// ==========================================================
// Módulo "Termo do dia interativo" + "Recursos"
// Carregado automaticamente pelo final do js/common.js (document.write).
// Faz 4 coisas:
//   1) Traduções (PT/EN) das novas telas
//   2) Adiciona "Recursos" ao menu lateral do aluno
//   3) Mostra o Termo do dia como card flutuante fixo (com "Já uso"/"Ainda não uso")
//   4) No painel do professor, mostra no Perfil do aluno as palavras "ainda não uso"
// ==========================================================
(function () {
  'use strict';

  // ---------- 1) Traduções ----------
  Object.assign(I18N.pt, {
    nav_recursos: 'Recursos',
    card_recursos_desc: 'Vocabulários e outros recursos para estudar no seu ritmo.',
    recursos_vocab: 'Novos Vocabulários',
    recursos_vocab_sub: 'Palavras do Termo do dia que você marcou como "ainda não uso"',
    recursos_empty: 'Nenhuma palavra por aqui ainda. Quando você marcar "Ainda não uso essa palavra" no Termo do dia, ela aparece nesta lista.',
    recursos_load_error: 'Não foi possível carregar suas palavras.',
    recursos_count: '{n} palavra(s) para praticar',
    word_use: 'Já uso essa palavra',
    word_not_use: 'Ainda não uso essa palavra',
    word_confirm: 'Confirmar resposta',
    word_change: 'Mudar resposta',
    word_saved: 'Resposta salva!',
    word_save_error: 'Não foi possível salvar. Tente de novo.',
    word_dock_collapse: 'Minimizar',
    word_dock_expand: 'Expandir',
  });
  Object.assign(I18N.en, {
    nav_recursos: 'Resources',
    card_recursos_desc: 'Vocabulary and other resources to study at your own pace.',
    recursos_vocab: 'New Vocabulary',
    recursos_vocab_sub: 'Words of the day you marked as "I don\'t use it yet"',
    recursos_empty: 'No words here yet. When you mark "I don\'t use this word yet" on the Word of the day, it shows up in this list.',
    recursos_load_error: 'Couldn\'t load your words.',
    recursos_count: '{n} word(s) to practice',
    word_use: 'I already use this word',
    word_not_use: 'I don\'t use this word yet',
    word_confirm: 'Confirm answer',
    word_change: 'Change answer',
    word_saved: 'Answer saved!',
    word_save_error: 'Couldn\'t save. Please try again.',
    word_dock_collapse: 'Minimize',
    word_dock_expand: 'Expand',
  });

  // ---------- 2) Menu lateral: item "Recursos" ----------
  const origNav = window.buildStudentTopNav;
  window.buildStudentTopNav = function (activeKey, showGrammar, notifCounts) {
    const html = origNav(activeKey, showGrammar, notifCounts);
    const active = activeKey === 'recursos' ? 'active' : '';
    return html + `<div class="nav-item ${active}" onclick="window.location.href='recursos.html'"><span>${t('nav_recursos')}</span></div>`;
  };

  // O card antigo (estático, no fim da home) é substituído pelo card flutuante
  window.buildWordOfDayCard = function () { return ''; };

  // ---------- CSS do card flutuante ----------
  const css = document.createElement('style');
  css.textContent = `
    .word-dock{position:fixed;left:274px;right:24px;bottom:16px;z-index:900;max-width:900px;
      background:linear-gradient(160deg,#16213E 0%,#0E1730 100%);color:#F1F0EA;border-radius:14px;
      padding:14px 20px;box-shadow:0 10px 30px rgba(14,23,48,.38);overflow:hidden;}
    .word-dock .wd-circle{position:absolute;right:-46px;top:-46px;width:130px;height:130px;
      border:1px solid rgba(127,168,217,.25);border-radius:50%;pointer-events:none;}
    .word-dock .wd-head{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;}
    .word-dock .wd-head-text{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;min-width:0;}
    .word-dock .wd-label{font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:#8FA0BF;font-weight:600;}
    .word-dock .wd-term{font-family:'Baskerville Old Face','Libre Baskerville',Georgia,serif;font-size:22px;font-weight:700;text-transform:capitalize;}
    .word-dock .wd-toggle{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#CBD6E8;
      border-radius:6px;width:30px;height:28px;cursor:pointer;font-size:11px;flex-shrink:0;font-family:inherit;}
    .word-dock .wd-toggle:hover{border-color:rgba(255,255,255,.45);}
    .word-dock .wd-body{position:relative;margin-top:8px;}
    .word-dock.collapsed .wd-body{display:none;}
    .word-dock .wd-def{font-size:13.5px;color:#AEBBD2;line-height:1.5;}
    .word-dock .wd-ex{font-size:13.5px;font-style:italic;color:#7FA8D9;line-height:1.5;margin-top:4px;}
    .word-dock .wd-options{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;}
    .word-dock label.wd-opt{display:flex;align-items:center;gap:9px;margin:0;padding:9px 13px;border-radius:8px;
      border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#E7ECF5;font-size:13px;cursor:pointer;}
    .word-dock label.wd-opt.checked{border-color:#7FA8D9;background:rgba(127,168,217,.2);}
    .word-dock label.wd-opt.locked{cursor:default;opacity:.85;}
    .word-dock label.wd-opt.locked:not(.checked){opacity:.45;}
    .word-dock input[type=checkbox]{width:17px;height:17px;margin:0;padding:0;flex:0 0 auto;accent-color:#7FA8D9;}
    .word-dock .wd-actions{display:flex;align-items:center;gap:12px;margin-top:10px;min-height:34px;flex-wrap:wrap;}
    .word-dock .wd-btn{font-family:inherit;font-size:13px;font-weight:600;padding:8px 16px;border-radius:7px;cursor:pointer;white-space:nowrap;}
    .word-dock .wd-btn.primary{background:#7FA8D9;color:#0E1730;border:none;}
    .word-dock .wd-btn.primary:disabled{opacity:.6;cursor:default;}
    .word-dock .wd-btn.ghost{background:none;color:#E7ECF5;border:1px solid rgba(255,255,255,.35);}
    .word-dock .wd-msg{font-size:12.5px;color:#9FD1A8;}
    .word-dock .wd-msg.err{color:#F2A99B;}
    /* Reserva espaço embaixo para o card nunca ficar na frente do conteúdo */
    .main{padding-bottom:calc(var(--dock-h,0px) + 40px) !important;}
    /* Botão do WhatsApp sobe para ficar acima do card */
    .whatsapp-fab{bottom:calc(var(--dock-h,0px) + 6px) !important;}
    @media (max-width:860px){
      .word-dock{left:12px;right:12px;bottom:12px;padding:12px 16px;}
      .word-dock .wd-term{font-size:19px;}
    }
  `;
  document.head.appendChild(css);

  // ---------- 3) Card flutuante do Termo do dia ----------
  const DOCK_KEY = 'portal_word_dock_collapsed';
  let dock = null, entry = null, profile = null;
  let selected = null, confirmed = false, busy = false, msg = '', msgErr = false, collapsed = false;

  function updateOffset() {
    if (!dock) return;
    const bottom = parseInt(getComputedStyle(dock).bottom, 10) || 0;
    document.documentElement.style.setProperty('--dock-h', (dock.offsetHeight + bottom) + 'px');
  }

  function renderDock() {
    if (!dock || !entry) return;
    const locked = confirmed;
    const opt = (val, label) => `
      <label class="wd-opt ${selected === val ? 'checked' : ''} ${locked ? 'locked' : ''}">
        <input type="checkbox" data-val="${val}" ${selected === val ? 'checked' : ''} ${locked ? 'disabled' : ''}>
        <span>${label}</span>
      </label>`;

    let actions = '';
    if (confirmed) {
      actions = `<button type="button" class="wd-btn ghost" data-act="change">${t('word_change')}</button>`;
    } else if (selected) {
      actions = `<button type="button" class="wd-btn primary" data-act="confirm" ${busy ? 'disabled' : ''}>${t('word_confirm')}</button>`;
    }
    if (msg) actions += `<span class="wd-msg ${msgErr ? 'err' : ''}">${msg}</span>`;

    dock.className = 'word-dock' + (collapsed ? ' collapsed' : '');
    dock.innerHTML = `
      <div class="wd-circle"></div>
      <div class="wd-head">
        <div class="wd-head-text">
          <span class="wd-label">${t('word_of_day_title')}</span>
          <span class="wd-term">${escapeHtml(entry.term)}</span>
        </div>
        <button type="button" class="wd-toggle" data-act="toggle" aria-label="${collapsed ? t('word_dock_expand') : t('word_dock_collapse')}" title="${collapsed ? t('word_dock_expand') : t('word_dock_collapse')}">${collapsed ? '▲' : '▼'}</button>
      </div>
      <div class="wd-body">
        <div class="wd-def">${escapeHtml(entry.definition)}</div>
        <div class="wd-ex">&ldquo;${escapeHtml(entry.example)}&rdquo;</div>
        <div class="wd-options">
          ${opt('uso', t('word_use'))}
          ${opt('nao_uso', t('word_not_use'))}
        </div>
        <div class="wd-actions">${actions}</div>
      </div>`;
    updateOffset();
  }

  async function loadSavedAnswer() {
    selected = null; confirmed = false;
    try {
      const { data } = await sb.from('word_of_day_answers').select('answer')
        .eq('student_id', profile.id).eq('day_index', entry.day_index).maybeSingle();
      if (data && data.answer) { selected = data.answer; confirmed = true; }
    } catch (e) { /* sem resposta salva */ }
  }

  async function confirmAnswer() {
    if (!selected || busy) return;
    busy = true; msg = ''; renderDock();
    const { error } = await sb.from('word_of_day_answers').upsert(
      { student_id: profile.id, day_index: entry.day_index, answer: selected, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,day_index' }
    );
    busy = false;
    if (error) {
      console.error('Erro ao salvar resposta do termo do dia:', error);
      msg = t('word_save_error'); msgErr = true;
    } else {
      confirmed = true; msg = t('word_saved'); msgErr = false;
      window.dispatchEvent(new CustomEvent('word-answer-changed'));
      setTimeout(() => { if (msg === t('word_saved')) { msg = ''; renderDock(); } }, 2500);
    }
    renderDock();
  }

  window.refreshWordDock = async function () {
    if (!dock) return;
    await loadSavedAnswer();
    msg = '';
    renderDock();
  };

  async function initWordDock() {
    if (!document.getElementById('nav-container')) return;          // não é página de aluno
    if (typeof renderPerfilTab === 'function') return;               // painel do professor
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      profile = await getMyProfile(session.user.id);
      if (!profile || profile.role !== 'student') return;
      await syncLanguageFromProfile(profile);
      entry = await getTodayWordOfDay();
      if (!entry) return;

      const stored = localStorage.getItem(DOCK_KEY);
      collapsed = stored === '1' ? true : stored === '0' ? false : window.innerWidth <= 860;

      dock = document.createElement('div');
      dock.id = 'word-dock';
      document.body.appendChild(dock);

      dock.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.getAttribute('data-act');
        if (act === 'toggle') {
          collapsed = !collapsed;
          try { localStorage.setItem(DOCK_KEY, collapsed ? '1' : '0'); } catch (err) {}
          renderDock();
        } else if (act === 'confirm') {
          confirmAnswer();
        } else if (act === 'change') {
          confirmed = false; msg = ''; renderDock();
        }
      });
      dock.addEventListener('change', (e) => {
        const input = e.target.closest('input[data-val]');
        if (!input || confirmed) return;
        selected = input.checked ? input.getAttribute('data-val') : null;
        msg = '';
        renderDock();
      });

      await loadSavedAnswer();
      renderDock();

      if (window.ResizeObserver) new ResizeObserver(updateOffset).observe(dock);
      window.addEventListener('resize', updateOffset);
    } catch (e) {
      console.error('Erro ao iniciar o Termo do dia:', e);
    }
  }

  // ---------- Card "Recursos" na home (inserido assim que a grade de cards aparece) ----------
  function injectHomeCard() {
    const grid = document.querySelector('.home-cards');
    if (!grid || grid.querySelector('[data-recursos-card]')) return;
    const el = document.createElement('div');
    el.className = 'home-card';
    el.setAttribute('data-recursos-card', '1');
    el.onclick = () => { window.location.href = 'recursos.html'; };
    el.innerHTML = `
      <div class="icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" fill="#16213E"/>
          <rect x="13" y="3.5" width="7.5" height="7.5" rx="2" fill="#5B93C4"/>
          <rect x="3.5" y="13" width="7.5" height="7.5" rx="2" fill="#5B93C4"/>
          <rect x="13" y="13" width="7.5" height="7.5" rx="2" fill="#16213E"/>
        </svg>
      </div>
      <h3>${t('nav_recursos')}</h3>
      <p>${t('card_recursos_desc')}</p>`;
    grid.appendChild(el);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initWordDock();
    if (/home\.html$/.test(window.location.pathname)) {
      const main = document.getElementById('main-content');
      if (main) new MutationObserver(injectHomeCard).observe(main, { childList: true, subtree: true });
    }
  });

  // ---------- 4) Painel do professor: aba "Vocabulário" entre "Materiais do aluno" e "Atividade" ----------
  const VOCAB_PER_PAGE = 15;
  let vocabAdmin = { rows: [], sub: 'nao_uso', term: '', page: 0, studentId: null };

  window.addEventListener('load', () => {
    if (typeof renderStudentDetail !== 'function' || typeof renderAtividadeTab !== 'function') return; // só no admin.html

    // Insere o botão da nova aba antes de "Atividade"
    const origDetail = window.renderStudentDetail;
    window.renderStudentDetail = function () {
      origDetail();
      const bar = document.querySelector('.role-switch');
      if (!bar) return;
      bar.style.maxWidth = '900px';
      const btn = document.createElement('button');
      btn.textContent = 'Vocabulário';
      btn.className = currentTab === 'vocab' ? 'active' : '';
      btn.onclick = () => switchTab('vocab');
      const atividadeBtn = Array.from(bar.children).find(b => /Atividade/.test(b.textContent));
      if (atividadeBtn) bar.insertBefore(btn, atividadeBtn); else bar.appendChild(btn);
    };

    // Quando a aba atual é "vocab", o admin.js cai no ramo "else" (Atividade): desviamos aqui
    const origAtividade = window.renderAtividadeTab;
    window.renderAtividadeTab = function () {
      if (currentTab === 'vocab') { renderVocabTab(); return; }
      origAtividade();
    };
  });

  async function renderVocabTab() {
    const studentId = currentStudent.id;
    const tab = document.getElementById('tab-content');
    tab.innerHTML = `<div class="empty-state">Carregando vocabulário...</div>`;

    const { data, error } = await sb
      .from('word_of_day_answers')
      .select('answer, updated_at, word_of_day(term, definition, example)')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false });

    if (currentTab !== 'vocab' || !currentStudent || currentStudent.id !== studentId) return;
    if (error) { tab.innerHTML = `<div class="empty-state">Não foi possível carregar o vocabulário.</div>`; console.error(error); return; }

    vocabAdmin = { rows: (data || []).filter(r => r.word_of_day), sub: 'nao_uso', term: '', page: 0, studentId };
    drawVocabTab();
  }

  function drawVocabTab() {
    const tab = document.getElementById('tab-content');
    if (!tab) return;
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

        <div class="role-switch" style="max-width:420px;margin-bottom:14px;">
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
