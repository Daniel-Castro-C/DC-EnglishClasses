let myProfile = null;
let myQuestions = [];
let activeQuestionId = null; // null = formulário de nova pergunta
let grammarUnlocked = false;
let notifCounts = {};
let prefilledSubject = ''; // vem do botão "Enviar dúvida sobre este conteúdo" nos Guias de Gramática

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (!canAccessStudentPortal(myProfile)) { window.location.href = 'admin.html'; return; }
  myProfile = studentPortalProfile(myProfile);

  try {
    const params = new URLSearchParams(window.location.search);
    const subj = params.get('subject');
    if (subj) prefilledSubject = subj;
  } catch (e) {}

  await syncLanguageFromProfile(myProfile);
  document.getElementById('lang-switcher-container').innerHTML = buildLanguageSwitcher(myProfile.id);
  translateStaticChrome();

  await syncThemeFromProfile(myProfile);
  document.getElementById('theme-toggle-container').innerHTML = buildThemeToggle(myProfile.id);

  grammarUnlocked = await isGrammarUnlocked();

  // Aluno já está vendo "Pergunte ao Daniel" agora, então o aviso de pergunta respondida some.
  await markNotificationsRead(myProfile.id, 'daniel_answered');
  notifCounts = await getNotificationCounts(myProfile.id);

  await loadQuestions();
  renderNav();
  refreshQuestionHistory();
  renderNewQuestionForm();
})();

async function loadQuestions(){
  const { data, error } = await sb
    .from('daniel_questions')
    .select('*')
    .eq('student_id', myProfile.id)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); myQuestions = []; return; }
  myQuestions = data || [];
}


function renderNav(){
  document.getElementById('nav-container').innerHTML =
    buildStudentTopNav('daniel', grammarUnlocked, notifCounts);
}

function buildQuestionHistoryHtml(){
  if (!myQuestions.length) return '<p class="student-muted">' + t('questions_history_empty') + '</p>';
  return myQuestions.map(q => {
    const answered = !!q.answer;
    const status = answered ? t('questions_answered_status') : t('questions_pending_status');
    return `
      <button type="button" class="student-question-history-item" onclick="showQuestion('${q.id}')">
        <span class="student-question-history-top">
          <strong>${escapeHtml(q.subject)}</strong>
          <span class="student-status ${answered ? 'is-complete' : 'is-pending'}">${escapeHtml(status)}</span>
        </span>
        <span class="student-question-date">${escapeHtml(t('sent_on',{date:formatDateLocalized(q.created_at)}))}</span>
        ${answered ? `<span class="student-question-excerpt">${escapeHtml(q.answer.length > 170 ? q.answer.slice(0,170) + '…' : q.answer)}</span>` : ''}
      </button>`;
  }).join('');
}

function refreshQuestionHistory(){
  const el = document.getElementById('question-history-container');
  if (el) el.innerHTML = buildQuestionHistoryHtml();
}

function renderNewQuestionForm(){
  activeQuestionId = null;
  renderNav();
  const subjectValue = prefilledSubject;
  prefilledSubject = '';

  document.getElementById('main-content').innerHTML = `
    <div class="student-page student-questions-page">
      <header class="student-page-heading">
        <span class="student-page-kicker">${t('questions_kicker')}</span>
        <h1>${t('nav_daniel')}</h1>
        <p>${t('ask_daniel_intro')}</p>
      </header>
      <div class="student-info-strip">
        <span class="student-info-icon" aria-hidden="true">?</span>
        <div><strong>${t('questions_intro_title')}</strong><p>${t('questions_intro_desc')}</p></div>
      </div>
      <div class="student-section-grid student-grid-main">
        <section class="student-panel">
          <div class="student-panel-head">
            <h2>${t('new_question_title')}</h2>
            <span class="student-soft-tag">+${t('new_question_title')}</span>
          </div>
          <label for="q-subject">${t('subject_label')}</label>
          <input id="q-subject" placeholder="${t('subject_placeholder')}" value="${escapeHtml(subjectValue)}">
          <label for="q-question">${t('question_label')}</label>
          <textarea id="q-question" placeholder="${t('question_placeholder')}"></textarea>
          <button id="q-submit-btn" class="btn-dark-sm student-primary-action" onclick="submitQuestion()">${t('send_question_btn')} →</button>
          <div id="q-feedback" class="feedback" role="status" aria-live="polite"></div>
        </section>
        <section class="student-panel">
          <div class="student-panel-head"><h2>${t('questions_history_title')}</h2>
            <span class="student-soft-tag">${myQuestions.length}</span>
          </div>
          <div id="question-history-container">${buildQuestionHistoryHtml()}</div>
        </section>
      </div>
    </div>
  `;
}

function showFeedback(msg, ok){
  const el = document.getElementById('q-feedback');
  el.textContent = msg;
  el.className = 'feedback show ' + (ok ? 'ok' : 'err');
}

async function submitQuestion(){
  const subject = document.getElementById('q-subject').value.trim();
  const question = document.getElementById('q-question').value.trim();

  if (!subject) { showFeedback(t('subject_required_error'), false); return; }
  if (!question) { showFeedback(t('question_required_error'), false); return; }

  const btn = document.getElementById('q-submit-btn');
  btn.disabled = true;
  btn.textContent = t('sending');

  const { error: insertError } = await sb.from('daniel_questions').insert({
    student_id: myProfile.id,
    subject,
    question
  });

  if (insertError) {
    btn.disabled = false;
    btn.textContent = t('send_question_btn');
    showFeedback(t('question_save_error'), false);
    console.error(insertError);
    return;
  }

  if (isTestStudentProfile(myProfile)) {
    btn.disabled = false;
    btn.textContent = t('send_question_btn');
    logActivity(myProfile.id, 'daniel_question', subject);
    showFeedback(t('question_sent_success'), true);
    document.getElementById('q-subject').value = '';
    document.getElementById('q-question').value = '';
    await loadQuestions();
    renderNav();
    return;
  }

  // Avisa o professor por e-mail
  const { data: adminProfile, error: adminError } = await sb
    .from('profiles')
    .select('email, full_name')
    .eq('role', 'admin')
    .limit(1)
    .single();

  btn.disabled = false;
  btn.textContent = t('send_question_btn');

  if (adminError || !adminProfile) {
    console.error('Erro ao buscar perfil do professor:', adminError);
    showFeedback(t('notify_error'), false);
  } else {
    const studentName = myProfile.full_name || myProfile.email;
    const emailResult = await sendLessonNotification(
      adminProfile.email,
      adminProfile.full_name,
      `${studentName} enviou uma nova pergunta pelo portal, sobre "${subject}". Acesse o painel para responder.`,
      `Nova dúvida de ${studentName} adicionada ao portal`
    );
    if (!emailResult.ok) {
      console.error('Erro ao enviar e-mail:', emailResult.err);
      showFeedback(t('question_email_send_error'), false);
    } else {
      logActivity(myProfile.id, 'daniel_question', subject);
      showFeedback(t('question_sent_success'), true);
    }
  }

  document.getElementById('q-subject').value = '';
  document.getElementById('q-question').value = '';

  await loadQuestions();
  renderNav();
  refreshQuestionHistory();
}

function showQuestion(id){
  activeQuestionId = id;
  renderNav();
  const q = myQuestions.find(item => item.id === id);

  const canEdit = !q.answer;

  document.getElementById('main-content').innerHTML = `
    <div class="student-page student-questions-page">
      <button class="student-back-link" type="button" onclick="renderNewQuestionForm()">← ${t('questions_history_title')}</button>
    <div class="topline">
      <div>
        <span class="student-page-kicker">${t('questions_kicker')}</span>
        <h1>${escapeHtml(q.subject)}</h1>
        <div class="sub">${t('sent_on', {date: formatDateLocalized(q.created_at)})}</div>
      </div>
    </div>

    <div class="lesson-card">
      <h3>${t('your_question_title')}</h3>
      <p style="margin:0;font-size:14.5px;line-height:1.6;">${escapeHtml(q.question)}</p>

      ${q.answer ? `
        <div class="answer-box">
          <div class="label">${t('daniel_answer_label')}</div>
          <div style="font-size:14.5px;line-height:1.6;">${escapeHtml(q.answer)}</div>
        </div>
      ` : `
        <div class="waiting-note">${t('waiting_answer')}</div>
      `}

      ${canEdit ? `
        <div class="row" style="margin-top:18px;">
          <button class="btn-ghost" style="flex:0 0 auto;" onclick="editQuestion('${q.id}')">${t('edit_question_btn')}</button>
          <button class="btn-ghost" style="flex:0 0 auto;" onclick="deleteQuestionByStudent('${q.id}')">${t('delete_question_btn')}</button>
        </div>
      ` : ''}
    </div>
    </div>
  `;
}

function editQuestion(id){
  const q = myQuestions.find(item => item.id === id);

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div><h1>${t('edit_question_title')}</h1></div>
    </div>

    <div class="lesson-card">
      <label>${t('subject_label')}</label>
      <input id="edit-q-subject" value="${escapeHtml(q.subject)}">
      <label>${t('question_label')}</label>
      <textarea id="edit-q-question">${escapeHtml(q.question)}</textarea>
      <div class="row">
        <button class="btn-dark-sm" onclick="saveQuestionEdit('${q.id}')">${t('save_changes_btn')}</button>
        <button class="btn-ghost" onclick="showQuestion('${q.id}')">${t('cancel_btn')}</button>
      </div>
      <div id="edit-feedback" class="feedback"></div>
    </div>
  `;
}

async function saveQuestionEdit(id){
  const subject = document.getElementById('edit-q-subject').value.trim();
  const question = document.getElementById('edit-q-question').value.trim();

  if (!subject || !question) {
    const el = document.getElementById('edit-feedback');
    el.textContent = t('fill_subject_question_error');
    el.className = 'feedback show err';
    return;
  }

  const { error } = await sb.from('daniel_questions').update({ subject, question }).eq('id', id);
  if (error) {
    const el = document.getElementById('edit-feedback');
    el.textContent = t('edit_save_error');
    el.className = 'feedback show err';
    console.error(error);
    return;
  }

  await loadQuestions();
  showQuestion(id);
}

async function deleteQuestionByStudent(id){
  if (!confirm(t('delete_confirm'))) return;

  const q = myQuestions.find(item => item.id === id);
  const subject = q ? q.subject : '';

  const { error } = await sb.from('daniel_questions').delete().eq('id', id);
  if (error) { alert(t('delete_error_alert')); console.error(error); return; }

  // Avisa o professor por e-mail sobre a exclusão
  const { data: adminProfile } = await sb.from('profiles').select('email, full_name').eq('role', 'admin').limit(1).single();
  if (adminProfile) {
    const studentName = myProfile.full_name || myProfile.email;
    await sendLessonNotification(
      adminProfile.email,
      adminProfile.full_name,
      `${studentName} excluiu a pergunta sobre "${subject}" no portal.`,
      `Pergunta excluída por ${studentName}`
    );
  }

  await loadQuestions();
  renderNewQuestionForm();
}
