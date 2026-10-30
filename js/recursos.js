let myProfile = null;
let grammarUnlocked = false;
let notifCounts = {};
let vocab = [];
let activeSection = 'vocab'; // 'vocab' | 'texto'
let mySubmissions = [];

const TEXT_MIN = 30;    // mínimo de caracteres para enviar
const TEXT_MAX = 2000;  // máximo de caracteres (cabe no e-mail e dá para o professor corrigir com calma)

// ---------- Textos (PT/EN) de "Aprimorando a Escrita" ----------
Object.assign(I18N.pt, {
  recursos_texto: 'Aprimorando a Escrita',
  texto_title: 'Aprimorando a Escrita',
  texto_sub: 'Escreva em inglês e receba a correção do professor',
  texto_howto_title: 'Como usar',
  texto_howto_1: 'Escreva seu texto direto no campo abaixo — ou escreva em outro editor de texto (Word, Google Docs, Bloco de Notas...) e cole aqui o texto já pronto.',
  texto_howto_2: 'Clique em "Enviar para correção". Eu recebo o seu texto por e-mail e aqui no portal.',
  texto_howto_3: 'Quando a correção ficar pronta, você recebe um aviso aqui no portal e por e-mail, e o arquivo da correção aparece na lista "Meus textos enviados".',
  texto_howto_4: 'Na correção, eu marco o que precisa ser revisado (ortografia, pontuação, gramática, clareza...) sem dar a resposta pronta. O seu desafio é descobrir o erro, reescrever o texto e, se quiser, enviar de novo.',
  texto_tip: 'Dica: escreva sobre situações reais — um e-mail de trabalho, uma mensagem para um colega, um parágrafo sobre o tema da aula. Textos curtos são muito bem-vindos!',
  texto_warning_title: 'Importante: não use corretores nem inteligência artificial antes de enviar',
  texto_warning: 'Não use corretores automáticos nem ferramentas de inteligência artificial (ChatGPT, Gemini, Copilot, Grammarly, o corretor do Word etc.) para corrigir o texto antes de enviar. Assim a correção mostra os seus erros de verdade e eu consigo te ajudar no que realmente precisa de atenção. Errar faz parte do aprendizado!',
  texto_form_title: 'Seu texto',
  texto_placeholder: 'Write your text here...',
  texto_counter: '{chars} / {max} caracteres · {words} palavra(s)',
  texto_send_btn: 'Enviar para correção',
  texto_too_short: 'Escreva um pouco mais antes de enviar (mínimo de {min} caracteres).',
  texto_too_long: 'O texto passou do limite de {max} caracteres. Divida em partes e envie separadamente.',
  texto_save_error: 'Não foi possível enviar seu texto. Tente novamente.',
  texto_admin_not_found: 'Texto salvo, mas não foi possível encontrar o e-mail do professor para avisá-lo. (Erro: {err})',
  texto_email_error: 'Texto salvo, mas não foi possível enviar o e-mail de aviso ao professor.',
  texto_sent_success: 'Texto enviado! O professor foi avisado por e-mail.',
  texto_my_title: 'Meus textos enviados',
  texto_empty: 'Você ainda não enviou nenhum texto.',
  texto_load_error: 'Não foi possível carregar seus textos.',
  texto_status_pending: 'Aguardando correção',
  texto_status_done: 'Correção pronta',
  texto_sent_on: 'Enviado em {date}',
  texto_words: '{n} palavra(s)',
  texto_correction_label: 'Sua correção',
});
Object.assign(I18N.en, {
  recursos_texto: 'Improving Your Writing',
  texto_title: 'Improving Your Writing',
  texto_sub: 'Write in English and get your teacher\'s correction',
  texto_howto_title: 'How to use',
  texto_howto_1: 'Write your text directly in the box below — or write it in another text editor (Word, Google Docs, Notepad...) and paste the finished text here.',
  texto_howto_2: 'Click "Send for correction". I receive your text by email and here in the portal.',
  texto_howto_3: 'When the correction is ready, you get a notice here in the portal and by email, and the correction file shows up in the "My submitted texts" list.',
  texto_howto_4: 'In the correction, I mark what needs to be reviewed (spelling, punctuation, grammar, clarity...) without giving the ready answer. Your challenge is to find the mistake, rewrite the text and, if you want, send it again.',
  texto_tip: 'Tip: write about real situations — a work email, a message to a colleague, a paragraph about the lesson topic. Short texts are very welcome!',
  texto_warning_title: 'Important: don\'t use correctors or artificial intelligence before sending',
  texto_warning: 'Please don\'t use automatic correctors or artificial intelligence tools (ChatGPT, Gemini, Copilot, Grammarly, Word\'s spell checker, etc.) to fix your text before sending it. That way the correction shows your real mistakes and I can help you with what really needs attention. Making mistakes is part of learning!',
  texto_form_title: 'Your text',
  texto_placeholder: 'Write your text here...',
  texto_counter: '{chars} / {max} characters · {words} word(s)',
  texto_send_btn: 'Send for correction',
  texto_too_short: 'Write a little more before sending (minimum of {min} characters).',
  texto_too_long: 'Your text is over the {max}-character limit. Split it into parts and send them separately.',
  texto_save_error: 'Couldn\'t send your text. Please try again.',
  texto_admin_not_found: 'Text saved, but we couldn\'t find the teacher\'s email to notify them. (Error: {err})',
  texto_email_error: 'Text saved, but the notification email to your teacher couldn\'t be sent.',
  texto_sent_success: 'Text sent! Your teacher has been notified by email.',
  texto_my_title: 'My submitted texts',
  texto_empty: 'You haven\'t sent any texts yet.',
  texto_load_error: 'Couldn\'t load your texts.',
  texto_status_pending: 'Waiting for correction',
  texto_status_done: 'Correction ready',
  texto_sent_on: 'Sent on {date}',
  texto_words: '{n} word(s)',
  texto_correction_label: 'Your correction',
});

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

  // Abre direto no corretor quando há uma correção nova (sininho) ou com recursos.html?s=texto
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('s') === 'texto' || (!params.get('s') && notifCounts.recursos)) activeSection = 'texto';
  } catch (e) {}

  renderNav();
  if (activeSection === 'texto') { await showTexto(); } else { await showVocab(); }

  // Se o aluno mudar a resposta no card flutuante, a lista de vocabulário se atualiza sozinha
  // (só quando ele está vendo o vocabulário, para não apagar o texto que está escrevendo)
  window.addEventListener('word-answer-changed', () => { if (activeSection === 'vocab') showVocab(); });
})();

// Submenu do módulo: novos itens de "Recursos" entram aqui
function renderNav(){
  let html = buildStudentTopNav('recursos', grammarUnlocked, notifCounts);
  html += `<div class="nav-label">${t('nav_recursos')}</div>`;
  html += `<div class="nav-item ${activeSection === 'vocab' ? 'active' : ''}" onclick="showVocab()"><span>${t('recursos_vocab')}</span></div>`;
  html += `<div class="nav-item ${activeSection === 'texto' ? 'active' : ''}" onclick="showTexto()"><span>${t('recursos_texto')}</span>${notifCounts.recursos ? NOTIF_BELL_SVG : ''}</div>`;
  document.getElementById('nav-container').innerHTML = html;
}

// ==========================================================
// Novos Vocabulários
// ==========================================================
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
  if (activeSection !== 'vocab') { activeSection = 'vocab'; renderNav(); }

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

// ==========================================================
// Aprimorando a Escrita (envio de textos para correção)
// ==========================================================
function countWords(str){
  return (str || '').trim().split(/\s+/).filter(Boolean).length;
}

async function showTexto(){
  if (activeSection !== 'texto') { activeSection = 'texto'; renderNav(); }

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${t('texto_title')}</h1>
        <div class="sub">${t('texto_sub')}</div>
      </div>
    </div>

    <div class="lesson-card howto">
      <h3>${t('texto_howto_title')}</h3>
      <ol>
        <li>${t('texto_howto_1')}</li>
        <li>${t('texto_howto_2')}</li>
        <li>${t('texto_howto_3')}</li>
        <li>${t('texto_howto_4')}</li>
      </ol>
      <p class="tip">${t('texto_tip')}</p>
    </div>

    <div class="warn-box">
      <h4>${t('texto_warning_title')}</h4>
      <p>${t('texto_warning')}</p>
    </div>

    <div class="lesson-card">
      <h3>${t('texto_form_title')}</h3>
      <textarea id="texto-input" placeholder="${t('texto_placeholder')}"
        spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
        data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"></textarea>
      <div id="texto-counter" class="texto-counter"></div>
      <button id="texto-send-btn" class="btn-dark-sm" onclick="submitText()">${t('texto_send_btn')}</button>
      <div id="texto-feedback" class="feedback"></div>
    </div>

    <div class="lesson-card">
      <h3>${t('texto_my_title')}</h3>
      <div id="texto-list"><div class="empty-state">${t('loading')}</div></div>
    </div>
  `;

  document.getElementById('texto-input').addEventListener('input', updateTextoCounter);
  updateTextoCounter();

  await refreshSubmissions();

  // O aluno já está vendo "Aprimorando a Escrita": o aviso de correção pronta some (menu e submenu)
  if (notifCounts.recursos) {
    await markNotificationsRead(myProfile.id, 'text_corrected');
    notifCounts = await getNotificationCounts(myProfile.id);
    renderNav();
  }
}

function updateTextoCounter(){
  const input = document.getElementById('texto-input');
  const counter = document.getElementById('texto-counter');
  if (!input || !counter) return;
  const chars = input.value.trim().length;
  counter.textContent = t('texto_counter', { chars: chars, max: TEXT_MAX, words: countWords(input.value) });
  counter.classList.toggle('over', chars > TEXT_MAX);
}

function showTextoFeedback(msg, ok){
  const el = document.getElementById('texto-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className = 'feedback show ' + (ok ? 'ok' : 'err');
}

// Monta o bloco HTML do texto do aluno que vai dentro do e-mail de aviso ao professor
// (entra na variável {{attachment_html}} do template do EmailJS, logo antes do botão "Acessar o portal")
function buildTextEmailHtml(content){
  const body = escapeHtml(content).replace(/\r?\n/g, '<br>');
  return `
    <table role="presentation" width="100%" style="border-collapse:collapse;margin:4px 0 22px;">
      <tr><td style="font-size:11px;letter-spacing:1.5px;font-weight:bold;color:#5B93C4;padding:0 0 6px;">TEXTO DO ALUNO</td></tr>
      <tr><td style="background-color:#F7F9FC;border:1px solid #D3E1EF;border-left:4px solid #5B93C4;border-radius:8px;padding:16px 18px;font-size:14.5px;line-height:1.7;color:#23262B;">${body}</td></tr>
    </table>`;
}

async function submitText(){
  const input = document.getElementById('texto-input');
  const content = input.value.trim();

  if (content.length < TEXT_MIN) { showTextoFeedback(t('texto_too_short', { min: TEXT_MIN }), false); return; }
  if (content.length > TEXT_MAX) { showTextoFeedback(t('texto_too_long', { max: TEXT_MAX }), false); return; }

  const btn = document.getElementById('texto-send-btn');
  btn.disabled = true;
  btn.textContent = t('sending');

  const words = countWords(content);

  const { error: insertError } = await sb.from('text_submissions').insert({
    student_id: myProfile.id,
    content: content,
    word_count: words
  });

  if (insertError) {
    console.error(insertError);
    btn.disabled = false;
    btn.textContent = t('texto_send_btn');
    showTextoFeedback(t('texto_save_error'), false);
    return;
  }

  // O texto já está salvo: limpa o campo para o aluno não enviar duas vezes sem querer
  input.value = '';
  updateTextoCounter();
  await refreshSubmissions();

  // Avisa o professor por e-mail, com o texto completo no corpo da mensagem
  const { data: adminProfile, error: adminError } = await sb
    .from('profiles')
    .select('email, full_name')
    .eq('role', 'admin')
    .limit(1)
    .single();

  btn.disabled = false;
  btn.textContent = t('texto_send_btn');

  logActivity(myProfile.id, 'text_submission', t('texto_words', { n: words }));

  if (adminError || !adminProfile) {
    console.error('Erro ao buscar perfil do professor:', adminError);
    showTextoFeedback(t('texto_admin_not_found', { err: adminError ? adminError.message : 'perfil não encontrado' }), false);
    return;
  }

  const studentName = myProfile.full_name || myProfile.email;
  const emailResult = await sendLessonNotification(
    adminProfile.email,
    adminProfile.full_name,
    `${studentName} enviou um texto para correção pelo portal (${words} palavras). O texto completo está logo abaixo.`,
    `Novo texto para correção de ${studentName}`,
    buildTextEmailHtml(content)
  );

  if (!emailResult.ok) {
    console.error('Erro ao enviar e-mail:', emailResult.err);
    showTextoFeedback(t('texto_email_error'), false);
    return;
  }

  showTextoFeedback(t('texto_sent_success'), true);
}

async function refreshSubmissions(){
  const container = document.getElementById('texto-list');
  if (!container) return;

  const { data, error } = await sb
    .from('text_submissions')
    .select('*')
    .eq('student_id', myProfile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = `<div class="empty-state">${t('texto_load_error')}</div>`;
    return;
  }

  mySubmissions = data || [];

  if (mySubmissions.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('texto_empty')}</div>`;
    return;
  }

  container.innerHTML = mySubmissions.map(submissionItemHtml).join('');
}

function submissionItemHtml(s){
  const done = s.status === 'corrected';
  const flat = (s.content || '').replace(/\s+/g, ' ').trim();
  const short = flat.length > 70 ? flat.slice(0, 70) + '…' : flat;
  const pill = `<span class="status-pill ${done ? 'done' : 'pending'}">${t(done ? 'texto_status_done' : 'texto_status_pending')}</span>`;

  const correction = (done && s.correction_file_path) ? `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid var(--line);">
      <span style="font-size:13px;font-weight:600;">${t('texto_correction_label')}</span>
      ${isPdfPath(s.correction_file_path) ? `<button class="resource-action" onclick="previewFile('${s.correction_file_path}')">${t('preview_file')}</button>` : ''}
      <button class="resource-action" onclick="downloadCorrection('${s.correction_file_path}')">${t('download_file')}</button>
    </div>` : '';

  return `
    <details class="lesson-card" style="padding:14px 18px;margin-bottom:10px;">
      <summary class="sub-summary">
        <span class="sub-title">${escapeHtml(short)}
          <span class="sub-date">${t('texto_sent_on', { date: formatDateLocalized(s.created_at) })} · ${t('texto_words', { n: s.word_count || countWords(s.content) })}</span>
        </span>
        ${pill}
      </summary>
      <div class="sub-text">${escapeHtml(s.content)}</div>
      ${correction}
    </details>
  `;
}

async function downloadCorrection(filePath){
  const displayName = filePath.split('/').pop().replace(/^\d+_/, '');
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 10, { download: displayName });

  if (error || !data) { alert(t('download_error_alert')); return; }

  logActivity(myProfile.id, 'download_correction', displayName);
  window.location.href = data.signedUrl;
}
