function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[m]));
}

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

// Constrói o menu principal (topo da barra lateral) usado em todas as páginas do aluno
function buildStudentTopNav(activeKey, showGrammarGuides){
  const items = [
    { key: 'home',      label: 'Início',              href: 'home.html' },
    { key: 'perfil',    label: 'Perfil',               href: 'perfil.html' },
    { key: 'aulas',     label: 'Minhas aulas',         href: 'aluno.html' },
    { key: 'enviar',    label: 'Enviar material',      href: 'enviar-material.html' },
  ];
  if (showGrammarGuides) {
    items.push({ key: 'gramatica', label: 'Guias de Gramática', href: 'guias-gramatica.html' });
  }
  items.push({ key: 'daniel', label: 'Pergunte ao Daniel', href: 'pergunte-ao-daniel.html' });
  let html = `<div class="nav-label">Menu</div>`;
  items.forEach(it => {
    const active = it.key === activeKey ? 'active' : '';
    html += `<div class="nav-item ${active}" onclick="window.location.href='${it.href}'">
      <span>${it.label}</span>
    </div>`;
  });
  return html;
}
