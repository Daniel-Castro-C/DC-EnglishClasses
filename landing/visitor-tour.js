// Guided tour layered over the real portal HTML, not a mock UI.
// No changes are made to the student pages themselves.
(function(){
  'use strict';
  const overlay=document.createElement('div');
  overlay.className='visitor-tour-overlay';
  overlay.setAttribute('hidden','');
  const tip=document.createElement('section');
  tip.className='visitor-tour-tooltip';tip.setAttribute('hidden','');tip.setAttribute('role','dialog');tip.setAttribute('aria-label','Tour guiado');
  tip.innerHTML='<div class="visitor-tour-counter"></div><h3></h3><p></p><div class="visitor-tour-progress"></div><div class="visitor-tour-actions"><button type="button" data-tour="skip">Pular</button><button type="button" data-tour="back">Anterior</button><button type="button" class="primary" data-tour="next">Próximo →</button></div>';
  document.body.append(overlay,tip);
  const banner=document.createElement('div');banner.className='visitor-ribbon';
  banner.innerHTML='<span><b>MODO VISITANTE</b> · Ambiente demonstrativo, com dados de exemplo e sem acesso às contas dos alunos</span><span class="visitor-ribbon-actions"><button type="button" id="visitor-restart">↻ Rever tour</button><a href="../#horarios">Consultar horários →</a></span>';
  document.body.insertBefore(banner,document.body.firstChild);
  const notification=document.createElement('div');notification.id='visitor-readonly-alert';notification.className='visitor-readonly-alert';notification.hidden=true;notification.textContent='Esta ação está disponível somente para alunos matriculados. Nenhuma informação foi enviada.';
  document.body.appendChild(notification);
  // The visitor logo and the student sidebar are the original elements.
  const logo=document.querySelector('.sidebar .side-brand small');if(logo)logo.textContent='Área do aluno · Demonstração';
  const steps=[
    {page:'home.html',target:'.dashboard-heading',title:'Bem-vindo ao seu portal',text:'Conheça o ambiente real do aluno.'},
    {page:'home.html',target:'.achievements-wall',title:'Mural de conquistas',text:'O mural mostra a quantidade de aulas que você já realizou.'},
    {page:'home.html',target:'.dashboard-hero',title:'Continue aprendendo',text:'Os conteúdos das aulas ficam organizados para você revisar quando quiser.'},
    {page:'aluno.html',target:'.student-lesson-item',title:'Materiais das aulas',text:'Aqui ficam todos os materiais das aulas realizadas.'},
    {page:'aluno.html',target:'#nav-container',title:'Explore o portal',text:'Use os mesmos menus da área do aluno. Quando terminar, consulte nossos horários disponíveis.'}
  ];
  const currentPage=location.pathname.split('/').pop();
  let index=-1,focused=null;
  const tourKey='dcVisitorTourStep',wasStarted='dcVisitorTourStarted';
  function removeHighlight(){if(focused){focused.classList.remove('visitor-tour-focus');focused=null}}
  function close(){removeHighlight();overlay.hidden=true;tip.hidden=true;index=-1;try{sessionStorage.removeItem(tourKey);sessionStorage.setItem(wasStarted,'yes')}catch(_){}}
  function goTo(i){
    if(i<0||i>=steps.length){close();return}
    if(steps[i].page!==currentPage){
      try{sessionStorage.setItem(tourKey,String(i))}catch(_){}
      location.href=steps[i].page;return;
    }
    index=i;tip.dataset.retry='false';overlay.hidden=false;tip.hidden=false;tip.querySelector('.visitor-tour-counter').textContent='ETAPA '+(i+1)+' DE '+steps.length;
    tip.querySelector('h3').textContent=steps[i].title;tip.querySelector('p').textContent=steps[i].text;
    tip.querySelector('.visitor-tour-progress').innerHTML=steps.map((_,k)=>'<i class="'+(k<=i?'on':'')+'"></i>').join('');
    tip.querySelector('[data-tour=back]').disabled=i===0;
    tip.querySelector('[data-tour=next]').textContent=i===steps.length-1?'Concluir ✓':'Próximo →';
    removeHighlight();
    const start=Date.now();
    const findTarget=()=>{
      if(index!==i)return;
      const target=document.querySelector(steps[i].target);
      if(!target){
        // Wait for the real asynchronous lesson renderer, rather than showing a
        // grey overlay for ten seconds and skipping an unseen step.
        if(Date.now()-start<12000){setTimeout(findTarget,160);return}
        tip.querySelector('p').textContent='Os materiais ainda estão carregando. Use Próximo para tentar novamente ou Pular para explorar livremente.';
        tip.querySelector('[data-tour=next]').textContent='Tentar novamente ↻';
        tip.dataset.retry='true';
        return;
      }
      focused=target;target.classList.add('visitor-tour-focus');
      target.scrollIntoView({block:'nearest',behavior:'instant'});
      position(target);
    };
    findTarget();
  }
  function position(target){
    if(tip.hidden)return;
    if(innerWidth<=860){tip.style.left='16px';tip.style.top='auto';tip.style.bottom='16px';return}
    const r=target.getBoundingClientRect(),w=Math.min(360,innerWidth-32),h=tip.offsetHeight||230;
    const left=r.right+w+20<innerWidth-10?r.right+17:Math.max(16,r.left-w-17);
    tip.style.left=Math.min(Math.max(16,left),innerWidth-w-12)+'px';
    tip.style.top=Math.max(16,Math.min(innerHeight-h-16,r.top))+'px';
    tip.style.bottom='auto';
  }
  tip.addEventListener('click',e=>{
    const action=e.target.closest('[data-tour]')?.dataset.tour;
    if(!action)return;
    if(action==='skip')close();else if(action==='back')goTo(index-1);else if(tip.dataset.retry==='true')goTo(index);else goTo(index+1);
  });
  banner.querySelector('#visitor-restart').addEventListener('click',()=>{
    try{sessionStorage.removeItem(wasStarted)}catch(_){}
    goTo(0);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&index>=0)close()});
  addEventListener('resize',()=>{if(focused)position(focused)});
  // Use the portal's existing download controls with explicit demonstration filenames.
  if(window.__dcGuestDemo){
    window.downloadResource=function(filePath){
      const safeFiles={
        'demo/Productivity - Modo Demonstração.pdf':'Productivity - Modo Demonstração.pdf',
        'demo/Giving and Receiving Feedback - Modo Demonstração.pdf':'Giving and Receiving Feedback - Modo Demonstração.pdf',
        'demo/Productivity - Relatório de Performance - Modo Demonstração.pdf':'Productivity - Relatório de Performance - Modo Demonstração.pdf',
        'demo/Giving and Receiving Feedback - Relatório de Performance - Modo Demonstração.pdf':'Giving and Receiving Feedback - Relatório de Performance - Modo Demonstração.pdf'
      };
      const name=safeFiles[filePath];
      if(!name){window.__dcDemoReadOnlyNotice?.();return}
      const a=document.createElement('a');
      a.href='/visit/'+filePath.split('/').map(encodeURIComponent).join('/');
      a.download=name;
      document.body.append(a);a.click();a.remove();
    };
  }
  try{
    const saved=sessionStorage.getItem(tourKey);
    if(saved!==null){goTo(Number(saved))}
    else if(currentPage==='home.html'&&!sessionStorage.getItem(wasStarted)){goTo(0)}
  }catch(_){if(currentPage==='home.html')goTo(0)}
})();
