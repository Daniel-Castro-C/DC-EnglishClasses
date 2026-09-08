// ==========================================================
// CONFIGURAÇÃO DO EMAILJS — cole aqui os 3 códigos da sua conta
// (emailjs.com → Account → General / Email Services / Email Templates)
// ==========================================================
const EMAILJS_PUBLIC_KEY  = "COLE_AQUI_SUA_PUBLIC_KEY";
const EMAILJS_SERVICE_ID  = "COLE_AQUI_SEU_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "COLE_AQUI_SEU_TEMPLATE_ID";

(function(){
  if (window.emailjs) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }
})();

// Envia a notificação por e-mail para o aluno.
// message: o texto que aparece no corpo do e-mail (variável {{message}} no template do EmailJS)
async function sendLessonNotification(studentEmail, studentName, message){
  if (!window.emailjs) {
    console.error('EmailJS não carregado.');
    return { ok: false };
  }
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: studentEmail,
      to_name: studentName || studentEmail,
      message: message
    });
    return { ok: true };
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
    return { ok: false, err };
  }
}
