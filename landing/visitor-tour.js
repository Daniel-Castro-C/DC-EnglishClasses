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
  banner.innerHTML='<span><b>MODO VISITANTE</b> · Ambiente demonstrativo, com dados de exemplo e sem acesso às contas dos alunos</span><span class="visitor-ribbon-actions"><button type="button" id="visitor-restart">↻ Rever tour</button><a href="../#horarios">Indicar disponibilidade →</a></span>';
  document.body.insertBefore(banner,document.body.firstChild);
  const notification=document.createElement('div');notification.id='visitor-readonly-alert';notification.className='visitor-readonly-alert';notification.hidden=true;notification.textContent='Esta ação está disponível somente para alunos matriculados. Nenhuma informação foi enviada.';
  document.body.appendChild(notification);
  // The visitor logo and the student sidebar are the original elements.
  const logo=document.querySelector('.sidebar .side-brand small');if(logo)logo.textContent='Portal do aluno · Demonstração';
  const steps=[
    {page:'home.html',target:'.dashboard-heading',title:'Bem-vindo ao seu portal',text:'Conheça o ambiente real do aluno.'},
    {page:'home.html',target:'.achievements-wall',title:'Mural de conquistas',text:'O mural mostra a quantidade de aulas que você já realizou.'},
    {page:'home.html',target:'.dashboard-hero',title:'Continue aprendendo',text:'Os conteúdos das aulas ficam organizados para você revisar quando quiser.'},
    {page:'aluno.html',target:'.student-lesson-item',title:'Materiais das aulas',text:'Aqui ficam todos os materiais das aulas realizadas.'},
    {page:'aluno.html',target:'.student-material-dropdown',title:'Materiais para experimentar',text:'Disponibilizamos slides e relatórios de desempenho de demonstração. Abra um material e use “Visualizar” ou “Baixar” para conhecer como são os arquivos.'},
    {page:'recursos.html?s=texto',target:'.student-writing-page .student-howto',title:'Aprimorando a Escrita',text:'Escreva em inglês e envie seu texto para o professor. Ele aponta os trechos que precisam de revisão e devolve uma correção para você aprender com seus próprios erros.'},
    {page:'recursos.html?s=texto',target:'#visitor-writing-example',title:'Exemplo de texto corrigido',text:'Este exemplo demonstra como você recebe a correção. Clique em “Visualizar exemplo” para abrir o PDF e conhecer as marcações e orientações.',showExample:true},
    {page:'recursos.html?s=texto',target:'#nav-container',title:'Explore o portal',text:'Use os mesmos menus do portal do aluno. Quando terminar, indique os horários compatíveis com sua rotina.'}
  ];
  const currentPage=location.pathname.split('/').pop();
  function isOnStepPage(page){
    const target=new URL(page,location.href);
    return target.pathname===location.pathname && target.search===location.search;
  }
  let index=-1,focused=null;
  const tourKey='dcVisitorTourStep',wasStarted='dcVisitorTourStarted';
  function removeHighlight(){if(focused){focused.classList.remove('visitor-tour-focus');focused=null}}
  function close(){removeHighlight();overlay.hidden=true;tip.hidden=true;index=-1;try{sessionStorage.removeItem(tourKey);sessionStorage.setItem(wasStarted,'yes')}catch(_){}}
  function goTo(i){
    if(i<0||i>=steps.length){close();return}
    if(!isOnStepPage(steps[i].page)){
      try{sessionStorage.setItem(tourKey,String(i))}catch(_){}
      location.href=steps[i].page;return;
    }
    index=i;tip.dataset.retry='false';overlay.hidden=false;tip.hidden=false;
    const next=tip.querySelector('[data-tour=example]');
    if(next)next.remove();
    if(steps[i].showExample){
      const btn=document.createElement('button');
      btn.type='button';btn.className='primary';
      btn.dataset.tour='example';btn.textContent='Visualizar exemplo ↗';
      const actions=tip.querySelector('.visitor-tour-actions');
      actions.insertBefore(btn,actions.querySelector('[data-tour=next]'));
    }tip.querySelector('.visitor-tour-counter').textContent='ETAPA '+(i+1)+' DE '+steps.length;
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
      // Expand the real lesson resource dropdown to reveal actual preview/download actions.
      if(i===4 && target.tagName==='DETAILS')target.open=true;
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
    if(action==='example'){
      const file='demo/Teamwork - Text Correction - Modo Demonstração.pdf';
      // Open immediately in the user's click to avoid popup blockers on async asset lookup.
      const tab=window.open('about:blank','_blank');
      Promise.resolve(window.__dcDemoPdfUrl?.(file)).then(url=>{
        if(!url){tab?.close();window.__dcDemoReadOnlyNotice?.();return}
        if(tab){tab.opener=null;tab.location.replace(url)}
        else window.location.href=url;
      }).catch(()=>{tab?.close();window.__dcDemoReadOnlyNotice?.()});
    }else if(action==='skip')close();else if(action==='back')goTo(index-1);else if(tip.dataset.retry==='true')goTo(index);else goTo(index+1);
  });
  banner.querySelector('#visitor-restart').addEventListener('click',()=>{
    try{sessionStorage.removeItem(wasStarted)}catch(_){}
    goTo(0);
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&index>=0)close()});
  addEventListener('resize',()=>{if(focused)position(focused)});
  // Visitor-only enhancements follow the actual portal renderer. Never change
  // authenticated student screens or leak supplied real student documents.
  function updateVisitorContent(){
    if(currentPage==='perfil.html'){
      // No lesson URL has been assigned to the fictional visitor.
      // The real student component stays intact; only its empty-state text disappears.
      document.querySelectorAll('.student-profile-unset').forEach(el=>el.remove());
    }
    if(currentPage==='recursos.html'){
      const page=document.querySelector('.student-writing-page');
      if(page&&!document.getElementById('visitor-writing-example')){
        const anchor=page.querySelector('.student-side-stack');
        if(anchor){
          const section=document.createElement('section');
          section.className='student-panel';
          section.id='visitor-writing-example';
          section.innerHTML='<div class="student-panel-head"><h2>Exemplo de texto corrigido</h2></div>'+
            '<p class="student-muted">Conheça um exemplo fictício do processo de correção: texto inicial, pontos a revisar e versão corrigida. Nenhuma informação de alunos reais é utilizada.</p>'+
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:13px">'+
            '<a class="btn-dark-sm" href="/visit/demo/Teamwork%20-%20Text%20Correction%20-%20Modo%20Demonstra%C3%A7%C3%A3o.pdf" data-visitor-example="preview" target="_blank" rel="noopener noreferrer">Visualizar exemplo ↗</a>'+
            '<a class="btn-ghost" href="/visit/demo/Teamwork%20-%20Text%20Correction%20-%20Modo%20Demonstra%C3%A7%C3%A3o.pdf" data-visitor-example="download" download="Teamwork - Text Correction - Modo Demonstração.pdf">Baixar PDF ↓</a></div>';
          anchor.append(section);
        }
      }
    }
  }
  // Observe content changes rather than imposing arbitrary delays on asynchronous modules.
  const contentRoot=document.getElementById('main-content');
  if(contentRoot){
    const observer=new MutationObserver(()=>{updateVisitorContent()});
    observer.observe(contentRoot,{childList:true,subtree:true});
    updateVisitorContent();
  }


  document.addEventListener('click',event=>{
    const a=event.target.closest('[data-visitor-example]');
    if(!a||!window.__dcDemoPdfUrl)return;
    event.preventDefault();
    const file='demo/Teamwork - Text Correction - Modo Demonstração.pdf';
    const type=a.dataset.visitorExample;
    const tab=type==='preview'?window.open('about:blank','_blank'):null;
    window.__dcDemoPdfUrl(file).then(url=>{
      if(!url){tab?.close();window.__dcDemoReadOnlyNotice?.();return}
      if(type==='preview'){if(tab){tab.opener=null;tab.location.replace(url)}else window.location.href=url}
      else{const link=document.createElement('a');link.href=url.startsWith('https:')?url+'?download='+encodeURIComponent('Teamwork - Text Correction - Modo Demonstração.pdf'):url;link.download='Teamwork - Text Correction - Modo Demonstração.pdf';document.body.append(link);link.click();link.remove()}
    }).catch(()=>tab?.close());
  });
  // Use the portal's existing download controls with explicit demonstration filenames.
  if(window.__dcGuestDemo){
    window.downloadResource=async function(filePath){
      const safeFiles={
        'demo/Productivity - Modo Demonstração.pdf':'Productivity - Modo Demonstração.pdf',
        'demo/Giving and Receiving Feedback - Modo Demonstração.pdf':'Giving and Receiving Feedback - Modo Demonstração.pdf',
        'demo/Productivity - Relatório de desempenho - Modo Demonstração.pdf':'Productivity - Relatório de desempenho - Modo Demonstração.pdf',
        'demo/Giving and Receiving Feedback - Relatório de desempenho - Modo Demonstração.pdf':'Giving and Receiving Feedback - Relatório de desempenho - Modo Demonstração.pdf'
      };
      const name=safeFiles[filePath];
      if(!name){window.__dcDemoReadOnlyNotice?.();return}
      const url=await window.__dcDemoPdfUrl(filePath);
      if(!url){window.__dcDemoReadOnlyNotice?.();return}
      const a=document.createElement('a');
      a.href=url.startsWith('https:')?url+'?download='+encodeURIComponent(name):url;
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
