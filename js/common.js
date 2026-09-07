function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[m]));
}

function formatCurrencyBRL(value){
  if (value === null || value === undefined || value === '') return null;
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Constrói o menu principal (topo da barra lateral) usado em todas as páginas do aluno
function buildStudentTopNav(activeKey){
  const items = [
    { key: 'home',      label: 'Início',       href: 'home.html' },
    { key: 'perfil',    label: 'Perfil',        href: 'perfil.html' },
    { key: 'aulas',     label: 'Minhas aulas',  href: 'aluno.html' },
    { key: 'financeiro',label: 'Financeiro',    href: 'financeiro.html' },
  ];
  let html = `<div class="nav-label">Menu</div>`;
  items.forEach(it => {
    const active = it.key === activeKey ? 'active' : '';
    html += `<div class="nav-item ${active}" onclick="window.location.href='${it.href}'">
      <span>${it.label}</span>
    </div>`;
  });
  return html;
}
