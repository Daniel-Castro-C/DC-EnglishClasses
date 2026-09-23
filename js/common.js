function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[m]));
}

// Registra uma ação do aluno no log de atividades (visível só para o professor)
async function logActivity(studentId, action, details){
  try {
    await sb.from('activity_log').insert({ student_id: studentId, action, details: details || null });
  } catch (e) {
    console.error('Erro ao registrar atividade:', e);
  }
}

// ---------- Menu mobile (hambúrguer) ----------
function toggleMobileSidebar(){
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  sidebar.classList.toggle('open');
  backdrop.classList.toggle('open');
}

function closeMobileSidebar(){
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove('open');
  backdrop.classList.remove('open');
}

// Fecha o menu automaticamente ao clicar em qualquer item de navegação (no celular)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 860 && e.target.closest('.nav-item')) {
    closeMobileSidebar();
  }
});

function formatCurrencyBRL(value){
  if (value === null || value === undefined || value === '') return null;
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Verifica se os Guias de Gramática estão liberados para os alunos
async function isGrammarUnlocked(){
  try {
    const { data, error } = await sb.from('app_settings').select('value').eq('key', 'grammar_guides_locked').single();
    if (error || !data) return false;
    return data.value === 'false';
  } catch (e) {
    return false;
  }
}

// ==========================================================
// ---------- Idioma do portal (i18n) — PT / EN ----------
// ==========================================================
const LANG_STORAGE_KEY = 'portal_lang';

const I18N = {
  pt: {
    // chrome / navegação
    lang_choose: 'Escolha o idioma',
    menu_label: 'Menu',
    nav_home: 'Início',
    nav_perfil: 'Perfil',
    nav_aulas: 'Minhas aulas',
    nav_enviar: 'Enviar material',
    nav_gramatica: 'Guias de Gramática',
    nav_daniel: 'Pergunte ao Daniel',
    area_aluno: 'Área do aluno',
    painel_aluno: 'Painel do aluno',
    logout: 'Sair',
    whatsapp_support: 'Fale com o suporte do professor',
    loading: 'Carregando...',
    cancel_btn: 'Cancelar',

    // home.html
    welcome_greeting: 'Olá, {name}',
    welcome_sub: 'Bem-vindo(a) à sua área do aluno',
    card_perfil_desc: 'Sua foto, seu nome, sua senha e o link fixo da sua aula.',
    card_aulas_desc: 'Slides, PDFs, exercícios e relatórios de cada aula já dada.',
    card_enviar_desc: 'Quer usar algo específico na próxima aula? Envie aqui pro professor.',
    card_gramatica_desc: 'Materiais de gramática organizados por nível, pra estudar no seu ritmo.',
    card_daniel_desc: 'Tire dúvidas de inglês a qualquer momento, sem esperar a próxima aula.',

    // aluno.js (Minhas aulas)
    search_placeholder: 'Buscar aula...',
    no_lessons_found: 'Nenhuma aula encontrada.',
    prev_page: '← Anterior',
    next_page: 'Próxima →',
    page_of: 'Página {a} de {b}',
    no_lessons_title: 'Ainda não há aulas por aqui',
    no_lessons_sub: 'Assim que seu professor cadastrar sua primeira aula, ela aparece aqui.',
    load_lessons_error: 'Não foi possível carregar suas aulas. Tente recarregar a página.',
    only_you_pill: 'Só você vê esta aula',
    materials_title: 'Materiais e acompanhamento',
    materials_meta: 'Tudo o que foi usado e passado nesta aula',
    loading_materials: 'Carregando materiais...',
    materials_load_error: 'Não foi possível carregar os materiais desta aula.',
    no_materials: 'Nenhum material adicionado a esta aula ainda.',
    download_file: 'Baixar arquivo',
    download_error_alert: 'Não foi possível baixar este arquivo. Tente novamente.',

    // perfil.js
    profile_sub: 'Sua foto, seu nome e sua senha',
    photo_name_title: 'Foto e nome',
    photo_hint: 'Escolha uma foto e ela é enviada automaticamente.',
    full_name_label: 'Nome completo',
    save_name_btn: 'Salvar nome',
    lesson_link_title: 'Link fixo da sua aula',
    lesson_link_meta: 'Este link é definido pelo seu professor e não muda a cada aula.',
    open_lesson_link: 'Abrir link da aula',
    lesson_link_not_set: 'Seu professor ainda não configurou este link.',
    schedule_title: 'Dia e horário fixo',
    change_password_title: 'Alterar senha',
    new_password_label: 'Nova senha',
    new_password_placeholder: 'Mínimo 6 caracteres',
    confirm_password_label: 'Confirmar nova senha',
    confirm_password_placeholder: 'Repita a nova senha',
    save_password_btn: 'Salvar nova senha',
    weekday_1: 'Segunda-feira', weekday_2: 'Terça-feira', weekday_3: 'Quarta-feira',
    weekday_4: 'Quinta-feira', weekday_5: 'Sexta-feira', weekday_6: 'Sábado', weekday_7: 'Domingo',
    uploading_photo: 'Enviando foto...',
    photo_upload_error: 'Não foi possível enviar a foto.',
    photo_save_error: 'Foto enviada, mas não foi possível salvar.',
    photo_updated: 'Foto atualizada!',
    name_empty_error: 'Digite um nome.',
    name_save_error: 'Não foi possível salvar.',
    name_updated: 'Nome atualizado!',
    password_min_length_error: 'A senha precisa ter pelo menos 6 caracteres.',
    password_mismatch_error: 'As senhas não coincidem.',
    password_change_error: 'Não foi possível alterar a senha.',
    password_changed: 'Senha alterada com sucesso!',

    // enviarMaterial.js
    send_material_title: 'Enviar material para uma aula',
    send_material_sub: 'Quer usar algo específico numa próxima aula? Envie aqui e o professor será avisado.',
    new_request_title: 'Novo pedido de material',
    request_date_label: 'Para qual data você quer usar este material?',
    file_label: 'Arquivo (opcional)',
    file_hint: 'Aceita PPT, PDF, Word, imagens, etc.',
    link_label: 'Ou, em vez de um arquivo, um link (opcional)',
    link_placeholder: 'https://... (ex: link de um artigo ou vídeo)',
    usage_label: 'Como você gostaria de usar esse material?',
    usage_placeholder: 'Conte pra gente como imagina usar esse material na aula — por exemplo: simular uma apresentação, praticar vocabulário, treinar leitura em voz alta, conversar sobre o assunto, tirar dúvidas específicas, etc.',
    notify_btn: 'Avisar ao professor',
    sending: 'Enviando...',
    my_requests_title: 'Meus pedidos enviados',
    date_required_error: 'Escolha a data em que quer usar o material.',
    file_or_link_required_error: 'Envie um arquivo ou informe um link.',
    file_upload_error: 'Não foi possível enviar o arquivo. Tente novamente.',
    request_save_error: 'Não foi possível registrar seu pedido. Tente novamente.',
    admin_email_not_found_error: 'Pedido salvo, mas não foi possível encontrar o e-mail do professor para notificar. (Erro: {err})',
    request_email_send_error: 'Pedido salvo, mas não foi possível enviar o e-mail de aviso. (Verifique o console para detalhes)',
    request_sent_success: 'Pedido enviado! O professor foi avisado por e-mail.',
    load_requests_error: 'Não foi possível carregar seus pedidos.',
    no_requests: 'Você ainda não enviou nenhum pedido de material.',
    file_tag: 'Arq',
    link_tag: 'Link',
    for_date: 'Para {date}',
    no_notes: 'Sem observações',
    no_date: '(sem data)',

    // guiasGramatica.js
    grammar_locked_msg: 'Este conteúdo ainda não está disponível. Fique de olho — em breve seu professor libera os materiais por aqui!',
    choose_level_sub: 'Escolha um nível para ver os materiais disponíveis',
    level_basico: 'Básico (A1/A2)',
    level_basico_desc: 'Fundamentos da gramática',
    level_intermediario: 'Intermediário (B1/B2)',
    level_intermediario_desc: 'Aprofundando as estruturas',
    level_avancado: 'Avançado (C1)',
    level_avancado_desc: 'Nuances e usos mais complexos',
    level_materials_sub: 'Materiais de gramática deste nível',
    back_to_levels: '← Todos os níveis',
    materials_load_error2: 'Não foi possível carregar os materiais.',
    no_materials_level: 'Nenhum material neste nível ainda.',
    watch_video: 'Assistir videoaula',
    download_pt: 'Baixar (Português)',
    download_en: 'Baixar (English)',

    // perguntaAoDaniel.js
    my_questions_label: 'Minhas perguntas',
    new_question_nav: '+ Nova pergunta',
    ask_daniel_intro: 'Você não precisa esperar a próxima aula para tirar uma dúvida sobre inglês! Pergunte aqui sobre qualquer coisa — algo que você viu e não entendeu, um branco que você teve, ou algo que veio à cabeça agora mesmo. Esse é seu canal direto comigo. Suas perguntas e respostas ficam arquivadas aqui, pra você consultar sempre que quiser.',
    new_question_title: 'Nova pergunta',
    subject_label: 'Assunto',
    subject_placeholder: 'Ex: Uso do Present Perfect',
    question_label: 'Sua pergunta',
    question_placeholder: 'Escreva aqui sua dúvida...',
    send_question_btn: 'Enviar pergunta',
    subject_required_error: 'Escreva um assunto para sua pergunta.',
    question_required_error: 'Escreva sua pergunta.',
    question_save_error: 'Não foi possível registrar sua pergunta. Tente novamente.',
    notify_error: 'Pergunta salva, mas não foi possível notificar o professor por e-mail.',
    question_email_send_error: 'Pergunta salva, mas não foi possível enviar o e-mail de aviso.',
    question_sent_success: 'Pergunta enviada! O professor foi avisado por e-mail.',
    sent_on: 'Enviada em {date}',
    your_question_title: 'Sua pergunta',
    daniel_answer_label: 'Resposta do Daniel',
    waiting_answer: 'Aguardando resposta do professor.',
    edit_question_btn: 'Editar pergunta',
    delete_question_btn: 'Excluir pergunta',
    edit_question_title: 'Editar pergunta',
    save_changes_btn: 'Salvar alterações',
    fill_subject_question_error: 'Preencha assunto e pergunta.',
    edit_save_error: 'Não foi possível salvar as alterações.',
    delete_confirm: 'Excluir esta pergunta? Essa ação não pode ser desfeita.',
    delete_error_alert: 'Não foi possível excluir a pergunta.',
  },
  en: {
    lang_choose: 'Choose the language',
    menu_label: 'Menu',
    nav_home: 'Home',
    nav_perfil: 'Profile',
    nav_aulas: 'My lessons',
    nav_enviar: 'Send material',
    nav_gramatica: 'Grammar Guides',
    nav_daniel: 'Ask Daniel',
    area_aluno: 'Student area',
    painel_aluno: 'Student panel',
    logout: 'Log out',
    whatsapp_support: 'Chat with the teacher support',
    loading: 'Loading...',
    cancel_btn: 'Cancel',

    welcome_greeting: 'Hi, {name}',
    welcome_sub: 'Welcome to your student area',
    card_perfil_desc: 'Your photo, name, password, and your fixed lesson link.',
    card_aulas_desc: 'Slides, PDFs, exercises and reports from every lesson given.',
    card_enviar_desc: 'Want to use something specific in your next lesson? Send it here to your teacher.',
    card_gramatica_desc: 'Grammar materials organized by level, so you can study at your own pace.',
    card_daniel_desc: 'Ask English questions anytime, without waiting for your next lesson.',

    search_placeholder: 'Search lesson...',
    no_lessons_found: 'No lesson found.',
    prev_page: '← Previous',
    next_page: 'Next →',
    page_of: 'Page {a} of {b}',
    no_lessons_title: 'No lessons here yet',
    no_lessons_sub: 'As soon as your teacher registers your first lesson, it will show up here.',
    load_lessons_error: 'Couldn\'t load your lessons. Try reloading the page.',
    only_you_pill: 'Only you can see this lesson',
    materials_title: 'Materials and follow-up',
    materials_meta: 'Everything used and covered in this lesson',
    loading_materials: 'Loading materials...',
    materials_load_error: 'Couldn\'t load this lesson\'s materials.',
    no_materials: 'No materials added to this lesson yet.',
    download_file: 'Download file',
    download_error_alert: 'Couldn\'t download this file. Please try again.',

    profile_sub: 'Your photo, name and password',
    photo_name_title: 'Photo and name',
    photo_hint: 'Choose a photo and it will be uploaded automatically.',
    full_name_label: 'Full name',
    save_name_btn: 'Save name',
    lesson_link_title: 'Your fixed lesson link',
    lesson_link_meta: 'This link is set by your teacher and doesn\'t change every lesson.',
    open_lesson_link: 'Open lesson link',
    lesson_link_not_set: 'Your teacher hasn\'t set up this link yet.',
    schedule_title: 'Fixed day and time',
    change_password_title: 'Change password',
    new_password_label: 'New password',
    new_password_placeholder: 'At least 6 characters',
    confirm_password_label: 'Confirm new password',
    confirm_password_placeholder: 'Repeat the new password',
    save_password_btn: 'Save new password',
    weekday_1: 'Monday', weekday_2: 'Tuesday', weekday_3: 'Wednesday',
    weekday_4: 'Thursday', weekday_5: 'Friday', weekday_6: 'Saturday', weekday_7: 'Sunday',
    uploading_photo: 'Uploading photo...',
    photo_upload_error: 'Couldn\'t upload the photo.',
    photo_save_error: 'Photo uploaded, but couldn\'t be saved.',
    photo_updated: 'Photo updated!',
    name_empty_error: 'Enter a name.',
    name_save_error: 'Couldn\'t save.',
    name_updated: 'Name updated!',
    password_min_length_error: 'Password must be at least 6 characters.',
    password_mismatch_error: 'Passwords don\'t match.',
    password_change_error: 'Couldn\'t change the password.',
    password_changed: 'Password changed successfully!',

    send_material_title: 'Send material for a lesson',
    send_material_sub: 'Want to use something specific in an upcoming lesson? Send it here and your teacher will be notified.',
    new_request_title: 'New material request',
    request_date_label: 'Which date do you want to use this material?',
    file_label: 'File (optional)',
    file_hint: 'Accepts PPT, PDF, Word, images, etc.',
    link_label: 'Or, instead of a file, a link (optional)',
    link_placeholder: 'https://... (e.g. a link to an article or video)',
    usage_label: 'How would you like to use this material?',
    usage_placeholder: 'Tell us how you imagine using this material in the lesson — for example: simulate a presentation, practice vocabulary, train reading aloud, talk about the topic, clear up specific doubts, etc.',
    notify_btn: 'Notify teacher',
    sending: 'Sending...',
    my_requests_title: 'My sent requests',
    date_required_error: 'Choose the date you want to use the material.',
    file_or_link_required_error: 'Send a file or provide a link.',
    file_upload_error: 'Couldn\'t upload the file. Please try again.',
    request_save_error: 'Couldn\'t register your request. Please try again.',
    admin_email_not_found_error: 'Request saved, but we couldn\'t find the teacher\'s email to notify them. (Error: {err})',
    request_email_send_error: 'Request saved, but the notification email couldn\'t be sent. (Check the console for details)',
    request_sent_success: 'Request sent! Your teacher has been notified by email.',
    load_requests_error: 'Couldn\'t load your requests.',
    no_requests: 'You haven\'t sent any material requests yet.',
    file_tag: 'File',
    link_tag: 'Link',
    for_date: 'For {date}',
    no_notes: 'No notes',
    no_date: '(no date)',

    grammar_locked_msg: 'This content isn\'t available yet. Stay tuned — your teacher will unlock the materials here soon!',
    choose_level_sub: 'Choose a level to see the available materials',
    level_basico: 'Basic (A1/A2)',
    level_basico_desc: 'Grammar fundamentals',
    level_intermediario: 'Intermediate (B1/B2)',
    level_intermediario_desc: 'Deepening the structures',
    level_avancado: 'Advanced (C1)',
    level_avancado_desc: 'Nuances and more complex uses',
    level_materials_sub: 'Grammar materials for this level',
    back_to_levels: '← All levels',
    materials_load_error2: 'Couldn\'t load the materials.',
    no_materials_level: 'No materials in this level yet.',
    watch_video: 'Watch video lesson',
    download_pt: 'Download (Portuguese)',
    download_en: 'Download (English)',

    my_questions_label: 'My questions',
    new_question_nav: '+ New question',
    ask_daniel_intro: 'You don\'t need to wait for your next lesson to clear up an English doubt! Ask here about anything — something you saw and didn\'t understand, something you blanked on, or something that just came to mind. This is your direct channel with me. Your questions and answers stay archived here, so you can check them whenever you want.',
    new_question_title: 'New question',
    subject_label: 'Subject',
    subject_placeholder: 'E.g.: Present Perfect usage',
    question_label: 'Your question',
    question_placeholder: 'Write your question here...',
    send_question_btn: 'Send question',
    subject_required_error: 'Write a subject for your question.',
    question_required_error: 'Write your question.',
    question_save_error: 'Couldn\'t register your question. Please try again.',
    notify_error: 'Question saved, but we couldn\'t notify your teacher by email.',
    question_email_send_error: 'Question saved, but the notification email couldn\'t be sent.',
    question_sent_success: 'Question sent! Your teacher has been notified by email.',
    sent_on: 'Sent on {date}',
    your_question_title: 'Your question',
    daniel_answer_label: 'Daniel\'s answer',
    waiting_answer: 'Waiting for your teacher\'s answer.',
    edit_question_btn: 'Edit question',
    delete_question_btn: 'Delete question',
    edit_question_title: 'Edit question',
    save_changes_btn: 'Save changes',
    fill_subject_question_error: 'Fill in the subject and the question.',
    edit_save_error: 'Couldn\'t save the changes.',
    delete_confirm: 'Delete this question? This action cannot be undone.',
    delete_error_alert: 'Couldn\'t delete the question.',
  }
};

// Retorna o idioma atualmente ativo (cache local no navegador)
function getLang(){
  const lang = localStorage.getItem(LANG_STORAGE_KEY);
  return (lang === 'pt' || lang === 'en') ? lang : 'pt';
}

// Salva o idioma só no cache local deste dispositivo
function setLangLocal(lang){
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

// Traduz uma chave para o idioma ativo, com suporte a variáveis: t('welcome_greeting', {name:'Ana'})
function t(key, vars){
  const dict = I18N[getLang()] || I18N.pt;
  let str = (dict[key] !== undefined) ? dict[key] : (I18N.pt[key] !== undefined ? I18N.pt[key] : key);
  if (vars) {
    Object.keys(vars).forEach(k => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    });
  }
  return str;
}

// No carregamento da página, sincroniza o cache local com o idioma salvo no perfil do aluno
// (o perfil no banco é a fonte de verdade — assim o idioma "segue" o aluno em qualquer aparelho)
async function syncLanguageFromProfile(profile){
  if (!profile) return getLang();
  if (profile.preferred_language === 'pt' || profile.preferred_language === 'en') {
    if (profile.preferred_language !== getLang()) setLangLocal(profile.preferred_language);
  } else {
    // Perfil ainda não tem idioma salvo: grava o padrão/local atual no perfil (auto-cura)
    try { await sb.from('profiles').update({ preferred_language: getLang() }).eq('id', profile.id); } catch (e) {}
  }
  return getLang();
}

// Troca o idioma do portal: salva local + no perfil do aluno (persiste pro próximo acesso), e recarrega a página
async function changeLanguage(lang, profileId){
  if (lang === getLang()) return;
  setLangLocal(lang);
  if (profileId) {
    try {
      await sb.from('profiles').update({ preferred_language: lang }).eq('id', profileId);
    } catch (e) {
      console.error('Erro ao salvar idioma no perfil:', e);
    }
  }
  window.location.reload();
}

// Constrói o seletor de idioma (bandeiras 🇧🇷 / 🇺🇸) mostrado no topo da barra lateral
function buildLanguageSwitcher(profileId){
  const lang = getLang();
  return `
    <div class="lang-switcher">
      <div class="lang-switcher-label">${t('lang_choose')}</div>
      <div class="lang-switcher-flags">
        <button type="button" class="lang-flag-btn ${lang === 'pt' ? 'active' : ''}" title="Português" aria-label="Português" onclick="changeLanguage('pt', '${profileId}')">🇧🇷</button>
        <button type="button" class="lang-flag-btn ${lang === 'en' ? 'active' : ''}" title="English" aria-label="English" onclick="changeLanguage('en', '${profileId}')">🇺🇸</button>
      </div>
    </div>
  `;
}

// Traduz os elementos estáticos do "chrome" comum a todas as páginas do aluno (marcados com data-i18n)
function translateStaticChrome(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.documentElement.lang = (getLang() === 'en') ? 'en-US' : 'pt-BR';
}

// Formata uma data ISO (YYYY-MM-DD ou timestamp) no idioma ativo
function formatDateLocalized(dateObjOrIso){
  const d = (dateObjOrIso instanceof Date) ? dateObjOrIso : new Date(dateObjOrIso);
  return d.toLocaleDateString(getLang() === 'en' ? 'en-US' : 'pt-BR');
}

// Constrói o menu principal (topo da barra lateral) usado em todas as páginas do aluno
function buildStudentTopNav(activeKey, showGrammarGuides){
  const items = [
    { key: 'home',      label: t('nav_home'),      href: 'home.html' },
    { key: 'perfil',    label: t('nav_perfil'),    href: 'perfil.html' },
    { key: 'aulas',     label: t('nav_aulas'),     href: 'aluno.html' },
    { key: 'enviar',    label: t('nav_enviar'),    href: 'enviar-material.html' },
  ];
  if (showGrammarGuides) {
    items.push({ key: 'gramatica', label: t('nav_gramatica'), href: 'guias-gramatica.html' });
  }
  items.push({ key: 'daniel', label: t('nav_daniel'), href: 'pergunte-ao-daniel.html' });
  let html = `<div class="nav-label">${t('menu_label')}</div>`;
  items.forEach(it => {
    const active = it.key === activeKey ? 'active' : '';
    html += `<div class="nav-item ${active}" onclick="window.location.href='${it.href}'">
      <span>${it.label}</span>
    </div>`;
  });
  return html;
}
