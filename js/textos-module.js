// ==========================================================
// Módulo "Textos para correção"
// Carregado automaticamente pelo final do js/recursos-module.js (document.write),
// que por sua vez é carregado pelo final do js/common.js.
// Faz 2 coisas:
//   1) ALUNO: mostra o sininho ao lado de "Recursos" (menu lateral) quando uma correção fica pronta
//   2) PROFESSOR: item "Textos para correção" no menu do painel + tela para ver os textos,
//      copiar o texto, anexar o PDF da correção e avisar o aluno (portal + e-mail)
// ==========================================================
(function () {
  'use strict';

  // ---------- 1) ALUNO: sininho em "Recursos" ----------
  if (typeof getNotificationCounts === 'function') {
    const origCounts = window.getNotificationCounts;
    window.getNotificationCounts = async function (studentId) {
      const counts = await origCounts(studentId);
      try {
        const { count } = await sb.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('type', 'text_corrected')
          .eq('read', false);
        if (count) counts.recursos = count;
      } catch (e) {
        console.error('Erro ao buscar notificações de correção:', e);
      }
      return counts;
    };
  }

  if (typeof buildStudentTopNav === 'function') {
    const origNav = window.buildStudentTopNav;
    window.buildStudentTopNav = function (activeKey, showGrammar, notifCounts) {
      let html = origNav(activeKey, showGrammar, notifCounts);
      if (notifCounts && notifCounts.recursos && typeof NOTIF_BELL_SVG !== 'undefined') {
        // coloca o sininho dentro do item "Recursos" (o item é criado pelo recursos-module.js)
        html = html.replace(/(onclick="window\.location\.href='recursos\.html'"><span>[^<]*<\/span>)/, '$1' + NOTIF_BELL_SVG);
      }
      return html;
    };
  }

  // ---------- 2) PROFESSOR: módulo "Textos para correção" ----------
  let pendingTotal = 0;
  let subTab = 'pending';     // 'pending' | 'done'
  let cache = {};             // id -> texto (para os botões "Copiar texto" e "Enviar correção")

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDateTime(iso) {
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Item do menu lateral (inserido logo antes do rótulo "Alunos"; recolocado sempre que o menu for refeito)
  function ensureNavItem() {
    const container = document.getElementById('nav-container');
    if (!container) return;
    let el = document.getElementById('nav-textos');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nav-textos';
      el.addEventListener('click', () => window.openTextosModule());
      const label = container.querySelector('.nav-label');
      if (label) container.insertBefore(el, label); else container.appendChild(el);
    }
    const active = (typeof currentView !== 'undefined' && currentView === 'textos');
    el.className = 'nav-item' + (active ? ' active' : '');
    el.innerHTML = `<span>Textos para correção</span>` +
      (pendingTotal > 0 ? `<span class="pill" style="background:var(--amber);color:#fff;font-size:11px;padding:2px 8px;">${pendingTotal}</span>` : '');
  }

  async function refreshPending() {
    try {
      const { count } = await sb.from('text_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      pendingTotal = count || 0;
    } catch (e) {
      console.error('Erro ao contar textos pendentes:', e);
    }
    ensureNavItem();
  }

  window.openTextosModule = async function () {
    currentStudent = null;
    currentView = 'textos';
    renderNav();                 // refaz o menu; o observador recoloca o nosso item, já destacado
    ensureNavItem();
    await renderTextosView();
  };

  async function renderTextosView() {
    document.getElementById('main-content').innerHTML = `
      <div class="topline">
        <div>
          <h1>Textos para correção</h1>
          <div class="sub">Textos enviados pelos alunos em “Aprimorando a Escrita” (aba Recursos)</div>
        </div>
      </div>

      <div class="role-switch" style="max-width:420px;margin-bottom:20px;">
        <button class="${subTab === 'pending' ? 'active' : ''}" onclick="textosSubTab('pending')">A corrigir${pendingTotal ? ' (' + pendingTotal + ')' : ''}</button>
        <button class="${subTab === 'done' ? 'active' : ''}" onclick="textosSubTab('done')">Corrigidos</button>
      </div>

      <div id="textos-content"></div>
    `;
    await renderTextosList();
  }

  window.textosSubTab = function (tab) { subTab = tab; renderTextosView(); };

  async function renderTextosList() {
    const container = document.getElementById('textos-content');
    if (!container) return;
    container.innerHTML = `<div class="empty-state">Carregando textos...</div>`;

    let query = sb.from('text_submissions').select('*, profiles(full_name, email)');
    query = subTab === 'pending'
      ? query.eq('status', 'pending').order('created_at', { ascending: true })
      : query.eq('status', 'corrected').order('corrected_at', { ascending: false }).limit(100);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      container.innerHTML = `<div class="empty-state">Não foi possível carregar os textos.</div>`;
      return;
    }

    cache = {};
    (data || []).forEach(s => { cache[s.id] = s; });

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state">${subTab === 'pending' ? 'Nenhum texto aguardando correção. 🎉' : 'Nenhum texto corrigido ainda.'}</div>`;
      return;
    }

    container.innerHTML = data.map(s => subTab === 'pending' ? pendingCardHtml(s) : doneCardHtml(s)).join('');

    if (subTab === 'pending') {
      pendingTotal = data.length;
      ensureNavItem();
    }
  }

  function studentLabel(s) {
    return (s.profiles && (s.profiles.full_name || s.profiles.email)) || 'Aluno';
  }

  const TEXT_BOX_STYLE = 'background:var(--paper);border-radius:8px;padding:14px 16px;white-space:pre-wrap;font-size:14.5px;line-height:1.65;margin:12px 0;';

  function pendingCardHtml(s) {
    const email = s.profiles ? s.profiles.email : '';
    return `
      <div class="lesson-card" id="txt-card-${s.id}">
        <h3 style="margin:0 0 4px;">${escapeHtml(studentLabel(s))}</h3>
        <div class="meta" style="margin-bottom:0;">${escapeHtml(email)} · Enviado em ${fmtDateTime(s.created_at)} · ${s.word_count || '?'} palavras</div>
        <div style="${TEXT_BOX_STYLE}">${escapeHtml(s.content)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <button class="btn-ghost" onclick="copyTextoAluno('${s.id}', this)">Copiar texto</button>
        </div>

        <label>Arquivo da correção (PDF)</label>
        <input id="txt-file-${s.id}" type="file" accept=".pdf,application/pdf">
        <div class="small-note" style="margin-top:-8px;margin-bottom:12px;">Gere a correção com a Claude, abra o HTML, clique em “Salvar como PDF” e anexe o PDF aqui.</div>
        <div class="row">
          <button id="txt-send-${s.id}" class="btn-dark-sm" style="flex:0 0 auto;" onclick="sendCorrection('${s.id}')">Enviar correção ao aluno</button>
          <button class="btn-ghost" style="flex:0 0 auto;" onclick="deleteTexto('${s.id}')">Excluir</button>
        </div>
        <div id="txt-fb-${s.id}" class="feedback"></div>
      </div>
    `;
  }

  function doneCardHtml(s) {
    const path = s.correction_file_path || '';
    return `
      <details class="lesson-card">
        <summary style="cursor:pointer;font-weight:600;font-size:15px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <span>${escapeHtml(studentLabel(s))} — ${fmtDateTime(s.created_at)}</span>
          <span class="pill" style="background:var(--sky-soft);">Corrigido</span>
        </summary>
        <div style="margin-top:14px;">
          <div class="meta" style="margin-bottom:0;">${s.word_count || '?'} palavras${s.corrected_at ? ' · correção enviada em ' + fmtDateTime(s.corrected_at) : ''}</div>
          <div style="${TEXT_BOX_STYLE}">${escapeHtml(s.content)}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${path && isPdfPath(path) ? `<button class="resource-action" onclick="previewFile('${path}')">Visualizar correção</button>` : ''}
            ${path ? `<button class="resource-action" onclick="downloadRequestFile('${path}')">Baixar correção</button>` : ''}
            <button class="btn-ghost" onclick="deleteTexto('${s.id}')">Excluir</button>
          </div>
        </div>
      </details>
    `;
  }

  window.copyTextoAluno = async function (id, btn) {
    const s = cache[id];
    if (!s) return;
    try {
      await navigator.clipboard.writeText(s.content);
      if (btn) {
        const old = btn.textContent;
        btn.textContent = 'Copiado!';
        setTimeout(() => { btn.textContent = old; }, 1500);
      }
    } catch (e) {
      alert('Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.');
    }
  };

  function setFb(id, msg, ok) {
    const el = document.getElementById('txt-fb-' + id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'feedback show ' + (ok ? 'ok' : 'err');
  }

  window.sendCorrection = async function (id) {
    const s = cache[id];
    if (!s) return;

    const input = document.getElementById('txt-file-' + id);
    const file = input && input.files[0];
    if (!file) { setFb(id, 'Escolha o PDF da correção.', false); return; }
    if (!/\.pdf$/i.test(file.name)) { setFb(id, 'Envie a correção em PDF (no HTML da correção, use “Salvar como PDF”).', false); return; }

    const name = studentLabel(s);
    if (!confirm(`Enviar a correção para ${name}? O aluno será avisado no portal e por e-mail.`)) return;

    const btn = document.getElementById('txt-send-' + id);
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${s.student_id}/corrections/${Date.now()}_${safeName}`;

    const { error: uploadError } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (uploadError) {
      console.error(uploadError);
      setFb(id, 'Não foi possível enviar o arquivo. Tente novamente.', false);
      btn.disabled = false; btn.textContent = 'Enviar correção ao aluno';
      return;
    }

    const { error: updateError } = await sb.from('text_submissions')
      .update({ status: 'corrected', correction_file_path: filePath, corrected_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error(updateError);
      await sb.storage.from(STORAGE_BUCKET).remove([filePath]);   // não deixa arquivo órfão
      setFb(id, 'O arquivo foi enviado, mas não foi possível registrar a correção. Tente novamente.', false);
      btn.disabled = false; btn.textContent = 'Enviar correção ao aluno';
      return;
    }

    // Sininho no portal do aluno (ao lado de "Recursos")
    try { await sb.from('notifications').insert({ student_id: s.student_id, type: 'text_corrected' }); }
    catch (e) { console.error('Erro ao criar notificação:', e); }

    // E-mail ao aluno
    let emailOk = true;
    if (s.profiles && s.profiles.email) {
      const result = await sendLessonNotification(
        s.profiles.email,
        s.profiles.full_name,
        'A correção do seu texto já está disponível no portal! Acesse Recursos > Aprimorando a Escrita para ver as marcações, reescrever o texto e, se quiser, enviar de novo.',
        'Sua correção de texto está pronta'
      );
      emailOk = result.ok;
    }

    if (!emailOk) alert('Correção enviada e aluno avisado no portal, mas não foi possível enviar o e-mail.');

    await refreshPending();
    await renderTextosView();
  };

  window.deleteTexto = async function (id) {
    const s = cache[id];
    if (!s) return;
    if (!confirm('Excluir este texto' + (s.correction_file_path ? ' e o PDF da correção' : '') + '? O aluno não será notificado.')) return;

    if (s.correction_file_path) {
      await sb.storage.from(STORAGE_BUCKET).remove([s.correction_file_path]);
    }
    const { error } = await sb.from('text_submissions').delete().eq('id', id);
    if (error) { alert('Não foi possível excluir.'); console.error(error); return; }

    await refreshPending();
    await renderTextosView();
  };

  // ---------- Inicialização (só no painel do professor) ----------
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof openDanielModule !== 'function' || typeof renderNav !== 'function') return;   // não é o admin.html
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data: prof } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
      if (!prof || prof.role !== 'admin') return;
    } catch (e) { return; }

    // Rótulos novos na aba "Atividade" de cada aluno
    if (typeof ACTIVITY_LABELS === 'object') {
      ACTIVITY_LABELS.text_submission = 'Enviou um texto para correção';
      ACTIVITY_LABELS.download_correction = 'Baixou a correção de um texto';
    }

    // O menu é refeito (innerHTML) a cada clique: o observador recoloca o nosso item toda vez
    const container = document.getElementById('nav-container');
    if (container) new MutationObserver(ensureNavItem).observe(container, { childList: true });

    await refreshPending();
  });
})();
