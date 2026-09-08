let myProfile = null;
let myQuestions = [];
let activeQuestionId = null; // null = formulário de nova pergunta

(async function init(){
  const session = await requireSession();
  if (!session) return;

  myProfile = await getMyProfile(session.user.id);
  if (!myProfile) { await signOutAndRedirect(); return; }
  if (myProfile.role !== 'student') { window.location.href = 'admin.html'; return; }

  await loadQuestions();
  renderNav();
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
  let html = buildStudentTopNav('daniel');
  html += `<div class="nav-label">Minhas perguntas</div>`;
  html += `<div class="nav-item ${activeQuestionId === null ? 'active' : ''}" onclick="renderNewQuestionForm()">
    <span>+ Nova pergunta</span>
  </div>`;
  myQuestions.forEach(q => {
    html += `<div class="nav-item ${q.id === activeQuestionId ? 'active' : ''}" onclick="showQuestion('${q.id}')">
      <span>${escapeHtml(q.subject)}</span>
      <span class="dot" style="background:${q.answer ? 'var(--sage)' : 'var(--amber)'}"></span>
    </div>`;
  });
  document.getElementById('nav-container').innerHTML = html;
}

function renderNewQuestionForm(){
  activeQuestionId = null;
  renderNav();

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>Pergunte ao Daniel</h1>
      </div>
    </div>

    <div class="lesson-card">
      <p style="margin-top:0;font-size:14.5px;line-height:1.6;">
        Você não precisa esperar a próxima aula para tirar uma dúvida sobre inglês! Pergunte aqui sobre
        qualquer coisa — algo que você viu e não entendeu, um branco que você teve, ou algo que veio à
        cabeça agora mesmo. Esse é seu canal direto comigo. Suas perguntas e respostas ficam arquivadas
        aqui, pra você consultar sempre que quiser.
      </p>
    </div>

    <div class="lesson-card">
      <h3>Nova pergunta</h3>
      <label>Assunto</label>
      <input id="q-subject" placeholder="Ex: Uso do Present Perfect">
      <label>Sua pergunta</label>
      <textarea id="q-question" placeholder="Escreva aqui sua dúvida..."></textarea>
      <button id="q-submit-btn" class="btn-dark-sm" onclick="submitQuestion()">Enviar pergunta</button>
      <div id="q-feedback" class="feedback"></div>
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

  if (!subject) { showFeedback('Escreva um assunto para sua pergunta.', false); return; }
  if (!question) { showFeedback('Escreva sua pergunta.', false); return; }

  const btn = document.getElementById('q-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const { error: insertError } = await sb.from('daniel_questions').insert({
    student_id: myProfile.id,
    subject,
    question
  });

  if (insertError) {
    btn.disabled = false;
    btn.textContent = 'Enviar pergunta';
    showFeedback('Não foi possível registrar sua pergunta. Tente novamente.', false);
    console.error(insertError);
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
  btn.textContent = 'Enviar pergunta';

  if (adminError || !adminProfile) {
    console.error('Erro ao buscar perfil do professor:', adminError);
    showFeedback('Pergunta salva, mas não foi possível notificar o professor por e-mail.', false);
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
      showFeedback('Pergunta salva, mas não foi possível enviar o e-mail de aviso.', false);
    } else {
      showFeedback('Pergunta enviada! O professor foi avisado por e-mail.', true);
    }
  }

  document.getElementById('q-subject').value = '';
  document.getElementById('q-question').value = '';

  await loadQuestions();
  renderNav();
}

function showQuestion(id){
  activeQuestionId = id;
  renderNav();
  const q = myQuestions.find(item => item.id === id);

  document.getElementById('main-content').innerHTML = `
    <div class="topline">
      <div>
        <h1>${escapeHtml(q.subject)}</h1>
        <div class="sub">Enviada em ${new Date(q.created_at).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>

    <div class="lesson-card">
      <h3>Sua pergunta</h3>
      <p style="margin:0;font-size:14.5px;line-height:1.6;">${escapeHtml(q.question)}</p>

      ${q.answer ? `
        <div class="answer-box">
          <div class="label">Resposta do Daniel</div>
          <div style="font-size:14.5px;line-height:1.6;">${escapeHtml(q.answer)}</div>
        </div>
      ` : `
        <div class="waiting-note">Aguardando resposta do professor.</div>
      `}
    </div>
  `;
}
